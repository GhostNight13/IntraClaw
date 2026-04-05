import { logger } from './utils/logger';
import type { AIRequest, AIResponse } from './types';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 120_000;

// Available local models — prefer Gemma 4, fall back to Llama
export const OLLAMA_MODELS = {
  primary:  'gemma3:latest',
  fallback: 'llama3.2:latest',
} as const;

type OllamaModelKey = keyof typeof OLLAMA_MODELS;

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: false;
  options?: {
    num_predict?: number;
    temperature?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
  total_duration?: number;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(modelKey: OllamaModelKey, request: AIRequest): Promise<AIResponse> {
  const start = Date.now();
  const modelName = OLLAMA_MODELS[modelKey];
  const aiModelName = modelKey === 'primary' ? 'gemma' : 'llama';

  const payload: OllamaChatRequest = {
    model: modelName,
    messages: request.messages as OllamaChatMessage[],
    stream: false,
    options: {
      num_predict: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    },
  };

  logger.info('Ollama', `Calling ${modelName}`);

  const response = await fetchWithTimeout(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama HTTP ${response.status}: ${text}`);
  }

  const data = await response.json() as OllamaChatResponse;

  if (!data.done || !data.message?.content) {
    throw new Error('Ollama returned incomplete response');
  }

  const durationMs = Date.now() - start;
  const inputTokens  = data.prompt_eval_count ?? Math.ceil(
    request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4
  );
  const outputTokens = data.eval_count ?? Math.ceil(data.message.content.length / 4);

  logger.info('Ollama', `${modelName} responded in ${durationMs}ms`, { inputTokens, outputTokens });

  return {
    content: data.message.content.trim(),
    model: aiModelName,
    inputTokens,
    outputTokens,
    durationMs,
  };
}

export async function callGemma(request: AIRequest): Promise<AIResponse> {
  return callModel('primary', request);
}

export async function callLlama(request: AIRequest): Promise<AIResponse> {
  return callModel('fallback', request);
}

/**
 * Check if Ollama is reachable (quick ping).
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, {}, 3000);
    return response.ok;
  } catch {
    return false;
  }
}
