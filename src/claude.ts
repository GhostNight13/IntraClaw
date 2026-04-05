import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from './utils/logger';
import type { AIRequest, AIResponse } from './types';

const TIMEOUT_MS   = 120_000; // 2 min
const MAX_BUFFER   = 1024 * 1024; // 1 MB

/**
 * Calls Claude Code CLI via `claude` command.
 * Writes the prompt to a temp file to avoid shell injection.
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

    const cmd = `claude --print < "${tmpFile}"`;
    logger.info('Claude', 'Calling Claude Code CLI');

    const result = execSync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
      env: { ...process.env },
    });

    output = result.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
    inputTokens,
    outputTokens,
    durationMs,
  };
}
