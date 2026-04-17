import { logger } from '../utils/logger';
import type { AIRequest, AIResponse, ModelTier } from '../types';

const TIMEOUT_MS = 120_000;

// ─── Anthropic API ───────────────────────────────────────────────────────────

const ANTHROPIC_MODELS: Record<ModelTier, string> = {
  fast:      'claude-3-5-haiku-20241022',
  balanced:  'claude-3-5-sonnet-20241022',
  powerful:  'claude-3-7-sonnet-20250219',
};

export async function callAnthropicAPI(request: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const start = Date.now();
  const model = ANTHROPIC_MODELS[request.modelTier ?? 'balanced'];

  const systemMessages = request.messages.filter(m => m.role === 'system');
  const conversationMessages = request.messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessages.map(m => m.content).join('\n\n') || undefined;

  logger.info('AnthropicAPI', `Calling ${model}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: conversationMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        throw new Error(`Anthropic API rate limited (429): ${text}`);
      }
      throw new Error(`Anthropic API HTTP ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const content = data.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    const durationMs = Date.now() - start;
    logger.info('AnthropicAPI', `Response received in ${durationMs}ms`);

    return {
      content,
      model: 'claude',
      providerId: 'claude-api',
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── OpenAI API ──────────────────────────────────────────────────────────────

const OPENAI_MODELS: Record<ModelTier, string> = {
  fast:      'gpt-4o-mini',
  balanced:  'gpt-4o',
  powerful:  'o3',
};

export async function callOpenAIAPI(request: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const start = Date.now();
  const model = OPENAI_MODELS[request.modelTier ?? 'balanced'];

  logger.info('OpenAI_API', `Calling ${model}`);

  const messages = request.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        throw new Error(`OpenAI API rate limited (429): ${text}`);
      }
      throw new Error(`OpenAI API HTTP ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content ?? '';
    const durationMs = Date.now() - start;
    logger.info('OpenAI_API', `Response received in ${durationMs}ms`);

    return {
      content,
      model: 'openai',
      providerId: 'openai-api',
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Google AI (Gemini) API ──────────────────────────────────────────────────

const GEMINI_API_MODELS: Record<ModelTier, string> = {
  fast:      'gemini-2.5-flash',
  balanced:  'gemini-2.5-flash',
  powerful:  'gemini-2.5-pro',
};

export async function callGeminiAPI(request: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const start = Date.now();
  const model = GEMINI_API_MODELS[request.modelTier ?? 'balanced'];

  const systemMessages = request.messages.filter(m => m.role === 'system');
  const conversationMessages = request.messages.filter(m => m.role !== 'system');

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join('\n\n') }] }
    : undefined;

  const contents = conversationMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  logger.info('GeminiAPI', `Calling ${model}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        throw new Error(`Gemini API rate limited (429): ${text}`);
      }
      throw new Error(`Gemini API HTTP ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
      };
    };

    const content = data.candidates?.[0]?.content?.parts
      ?.map((p: { text: string }) => p.text)
      .join('') ?? '';

    const durationMs = Date.now() - start;
    const inputTokens = data.usageMetadata?.promptTokenCount
      ?? Math.ceil(request.messages.reduce((s, m) => s + m.content.length, 0) / 4);
    const outputTokens = data.usageMetadata?.candidatesTokenCount
      ?? Math.ceil(content.length / 4);

    logger.info('GeminiAPI', `Response received in ${durationMs}ms`);

    return {
      content,
      model: 'gemini',
      providerId: 'gemini-api',
      inputTokens,
      outputTokens,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}
