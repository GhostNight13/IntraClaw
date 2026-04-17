import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { AIRequest, AIResponse, ModelTier } from '../types';

const TIMEOUT_MS = 120_000;
const MAX_BUFFER = 1024 * 1024;

/** Maps ModelTier to Codex (OpenAI) model identifiers */
const MODEL_BY_TIER: Record<ModelTier, string> = {
  fast:      'o4-mini',
  balanced:  'o4-mini',
  powerful:  'o3',
};

function resolveModel(tier?: ModelTier): string {
  return MODEL_BY_TIER[tier ?? 'balanced'];
}

/** Rate-limit signals */
const RATE_LIMIT_SIGNALS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  '429',
  'usage limit',
  'quota exceeded',
];

function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return RATE_LIMIT_SIGNALS.some(sig => lower.includes(sig));
}

/**
 * Calls Codex CLI via `codex` command.
 * Writes the prompt to a temp file to avoid shell injection.
 */
export async function callCodex(request: AIRequest): Promise<AIResponse> {
  const start = Date.now();

  const systemMessages = request.messages.filter(m => m.role === 'system');
  const conversationMessages = request.messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
  const conversationText = conversationMessages
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${conversationText}`
    : conversationText;

  const tmpFile = path.join(os.tmpdir(), `intraclaw-codex-${Date.now()}.txt`);
  let output: string;

  try {
    fs.writeFileSync(tmpFile, fullPrompt, 'utf8');

    const model = resolveModel(request.modelTier);
    const cmd = `codex --print --model "${model}" < "${tmpFile}"`;
    logger.info('Codex', `Calling Codex CLI (tier=${request.modelTier ?? 'balanced'}, model=${model})`);

    const result = execSync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
      env: { ...process.env },
    });

    output = result.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (isRateLimitError(message)) {
      logger.warn('Codex', 'Rate limit hit', message);
      throw new Error(`Codex rate limited: ${message}`);
    }

    logger.error('Codex', 'CLI call failed', message);
    throw new Error(`Codex CLI error: ${message}`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  const durationMs = Date.now() - start;
  const inputTokens = Math.ceil(fullPrompt.length / 4);
  const outputTokens = Math.ceil(output.length / 4);

  logger.info('Codex', `Response received in ${durationMs}ms`, { inputTokens, outputTokens });

  return {
    content: output,
    model: 'codex',
    providerId: 'codex-cli',
    inputTokens,
    outputTokens,
    durationMs,
  };
}
