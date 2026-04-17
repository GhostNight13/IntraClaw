import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from './utils/logger';
import type { AIRequest, AIResponse, ModelTier } from './types';

const TIMEOUT_MS   = 180_000; // 3 min (planning tasks can be slow)
const MAX_BUFFER   = 10 * 1024 * 1024; // 10 MB (some plans are verbose)

/** Maps ModelTier to Claude CLI model aliases (v2.1+) */
const MODEL_BY_TIER: Record<ModelTier, string> = {
  fast:      'haiku',
  balanced:  'sonnet',
  powerful:  'opus',
};

function resolveModel(tier?: ModelTier): string {
  return MODEL_BY_TIER[tier ?? 'balanced'];
}

/**
 * Thrown when the Claude CLI explicitly hits Anthropic's rate limit.
 * `ai.ts` catches this to fall back to Ollama instead of failing hard.
 */
export class ClaudeRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeRateLimitError';
  }
}

/** Keywords that indicate a real rate-limit response from Anthropic */
const RATE_LIMIT_SIGNALS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  '429',
  'usage limit',
  'quota exceeded',
  'overloaded',
];

function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return RATE_LIMIT_SIGNALS.some(sig => lower.includes(sig));
}

/**
 * Calls Claude Code CLI via `claude` command.
 * Writes the prompt to a temp file to avoid shell injection.
 * Throws ClaudeRateLimitError when Anthropic rate-limits us.
 */
export async function callClaude(request: AIRequest): Promise<AIResponse> {
  const start = Date.now();

  // Build the full prompt: system + conversation
  const systemMessages = request.messages.filter(m => m.role === 'system');
  const conversationMessages = request.messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
  const conversationText = conversationMessages
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${conversationText}`
    : conversationText;

  // Write to temp file to avoid arg length limits and injection
  const tmpFile = path.join(os.tmpdir(), `intraclaw-prompt-${Date.now()}.txt`);
  let output: string;

  try {
    fs.writeFileSync(tmpFile, fullPrompt, 'utf8');

    const model = resolveModel(request.modelTier);
    const cmd = `claude --print --model "${model}" < "${tmpFile}"`;
    logger.info('Claude', `Calling Claude CLI (tier=${request.modelTier ?? 'balanced'}, model=${model})`);

    const result = execSync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
      env: { ...process.env },
    });

    output = result.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish rate-limit errors from other failures
    if (isRateLimitError(message)) {
      logger.warn('Claude', 'Rate limit hit — will fall back to Ollama', message);
      throw new ClaudeRateLimitError(`Claude rate limited: ${message}`);
    }

    logger.error('Claude', 'CLI call failed', message);
    throw new Error(`Claude CLI error: ${message}`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  const durationMs = Date.now() - start;

  // Rough token estimation (1 token ≈ 4 chars)
  const inputTokens  = Math.ceil(fullPrompt.length / 4);
  const outputTokens = Math.ceil(output.length / 4);

  logger.info('Claude', `Response received in ${durationMs}ms`, {
    inputTokens,
    outputTokens,
    chars: output.length,
  });

  return {
    content: output,
    model: 'claude',
    providerId: 'claude-cli',
    inputTokens,
    outputTokens,
    durationMs,
  };
}
