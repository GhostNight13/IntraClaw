import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { callClaude, ClaudeRateLimitError } from '../claude';
import { callGemma, callLlama, isOllamaAvailable } from '../ollama';
import { callCodex } from './codex-cli';
import { callGeminiCli } from './gemini-cli';
import { callAnthropicAPI, callOpenAIAPI, callGeminiAPI } from './api-fallback';
import type { AIRequest, AIResponse, ModelTier } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProviderType = 'cli' | 'api' | 'local';

export type ProviderId =
  | 'claude-cli'
  | 'codex-cli'
  | 'gemini-cli'
  | 'ollama-gemma'
  | 'ollama-llama'
  | 'claude-api'
  | 'openai-api'
  | 'gemini-api';

export interface Provider {
  id: ProviderId;
  type: ProviderType;
  name: string;
  available: boolean;
  priority: number; // lower = tried first
  tiers: ModelTier[];
  call: (request: AIRequest) => Promise<AIResponse>;
}

export interface ProviderStatus {
  id: ProviderId;
  type: ProviderType;
  name: string;
  available: boolean;
  priority: number;
  tiers: ModelTier[];
  lastCheckedAt: string;
}

// ─── Discovery cache ─────────────────────────────────────────────────────────

const DISCOVERY_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cachedProviders: Provider[] | null = null;
let _lastDiscoveryAt = 0;

// ─── CLI detection ───────────────────────────────────────────────────────────

function isCliAvailable(cliName: string): boolean {
  try {
    execSync(`which ${cliName}`, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Gemini CLI is installed on most Macs but requires auth (GEMINI_API_KEY env,
// Vertex AI config, or ~/.gemini/settings.json with an auth method). Without
// auth it fails every call — better to mark it unavailable upfront.
function isGeminiCliAuthed(): boolean {
  if (process.env.GEMINI_API_KEY) return true;
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === '1') return true;
  if (process.env.GOOGLE_GENAI_USE_GCA === '1') return true;
  try {
    const home = process.env.HOME ?? '';
    const cfg = execSync(`cat ${home}/.gemini/settings.json 2>/dev/null`, {
      encoding: 'utf8', timeout: 2000,
    });
    // Minimal check: file exists and contains an "auth" or "apiKey" field
    return /"(auth|apiKey|authMethod|selectedAuthType)"\s*:/.test(cfg);
  } catch { return false; }
}

// ─── Provider definitions ────────────────────────────────────────────────────

function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  // 1. Claude CLI (priority 10)
  const claudeCliAvailable = isCliAvailable('claude');
  if (claudeCliAvailable) {
    providers.push({
      id: 'claude-cli',
      type: 'cli',
      name: 'Claude CLI',
      available: true,
      priority: 10,
      tiers: ['fast', 'balanced', 'powerful'],
      call: async (req: AIRequest): Promise<AIResponse> => {
        const resp = await callClaude(req);
        return { ...resp, providerId: 'claude-cli' };
      },
    });
  }
  logger.info('MultiProvider', `claude CLI: ${claudeCliAvailable ? 'available' : 'not found'}`);

  // 2. Codex CLI (priority 20)
  const codexCliAvailable = isCliAvailable('codex');
  if (codexCliAvailable) {
    providers.push({
      id: 'codex-cli',
      type: 'cli',
      name: 'Codex CLI (OpenAI)',
      available: true,
      priority: 20,
      tiers: ['fast', 'balanced', 'powerful'],
      call: callCodex,
    });
  }
  logger.info('MultiProvider', `codex CLI: ${codexCliAvailable ? 'available' : 'not found'}`);

  // 3. Gemini CLI (priority 30) — only if authed
  const geminiCliFound = isCliAvailable('gemini');
  const geminiCliAuthed = geminiCliFound && isGeminiCliAuthed();
  if (geminiCliAuthed) {
    providers.push({
      id: 'gemini-cli',
      type: 'cli',
      name: 'Gemini CLI (Google)',
      available: true,
      priority: 30,
      tiers: ['fast', 'balanced', 'powerful'],
      call: callGeminiCli,
    });
  }
  logger.info(
    'MultiProvider',
    `gemini CLI: ${geminiCliFound ? (geminiCliAuthed ? 'available' : 'found but not authed — skipping') : 'not found'}`,
  );

  // 4. Ollama — Gemma (priority 40)
  // Ollama availability is checked async at call time, but we register it optimistically
  providers.push({
    id: 'ollama-gemma',
    type: 'local',
    name: 'Ollama (Gemma)',
    available: true, // checked dynamically before call
    priority: 40,
    tiers: ['fast', 'balanced'],
    call: async (req: AIRequest): Promise<AIResponse> => {
      const up = await isOllamaAvailable();
      if (!up) throw new Error('Ollama not running');
      const resp = await callGemma(req);
      return { ...resp, providerId: 'ollama-gemma' };
    },
  });

  // 5. Ollama — Llama (priority 45)
  providers.push({
    id: 'ollama-llama',
    type: 'local',
    name: 'Ollama (Llama)',
    available: true, // checked dynamically before call
    priority: 45,
    tiers: ['fast'],
    call: async (req: AIRequest): Promise<AIResponse> => {
      const up = await isOllamaAvailable();
      if (!up) throw new Error('Ollama not running');
      const resp = await callLlama(req);
      return { ...resp, providerId: 'ollama-llama' };
    },
  });

  // 6. Claude API (priority 50)
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      id: 'claude-api',
      type: 'api',
      name: 'Anthropic API',
      available: true,
      priority: 50,
      tiers: ['fast', 'balanced', 'powerful'],
      call: callAnthropicAPI,
    });
  }
  logger.info('MultiProvider', `Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'not set'}`);

  // 7. OpenAI API (priority 60)
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      id: 'openai-api',
      type: 'api',
      name: 'OpenAI API',
      available: true,
      priority: 60,
      tiers: ['fast', 'balanced', 'powerful'],
      call: callOpenAIAPI,
    });
  }
  logger.info('MultiProvider', `OpenAI API key: ${process.env.OPENAI_API_KEY ? 'set' : 'not set'}`);

  // 8. Gemini API (priority 70)
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      id: 'gemini-api',
      type: 'api',
      name: 'Google AI (Gemini) API',
      available: true,
      priority: 70,
      tiers: ['fast', 'balanced', 'powerful'],
      call: callGeminiAPI,
    });
  }
  logger.info('MultiProvider', `Gemini API key: ${process.env.GEMINI_API_KEY ? 'set' : 'not set'}`);

  // Sort by priority
  providers.sort((a, b) => a.priority - b.priority);

  logger.info('MultiProvider', `Discovered ${providers.length} providers: ${providers.map(p => p.id).join(', ')}`);

  return providers;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns all discovered providers. Discovery results are cached for 5 minutes.
 */
export function getAvailableProviders(): Provider[] {
  const now = Date.now();
  if (_cachedProviders && (now - _lastDiscoveryAt) < DISCOVERY_TTL_MS) {
    return _cachedProviders;
  }

  _cachedProviders = buildProviders();
  _lastDiscoveryAt = now;
  return _cachedProviders;
}

/**
 * Force re-discovery (e.g., after installing a new CLI).
 */
export function refreshProviders(): Provider[] {
  _cachedProviders = null;
  _lastDiscoveryAt = 0;
  return getAvailableProviders();
}

/**
 * Returns a dashboard-friendly status of all providers.
 */
export function getProviderStatus(): ProviderStatus[] {
  const providers = getAvailableProviders();
  return providers.map(p => ({
    id: p.id,
    type: p.type,
    name: p.name,
    available: p.available,
    priority: p.priority,
    tiers: p.tiers,
    lastCheckedAt: new Date(_lastDiscoveryAt).toISOString(),
  }));
}

/**
 * Calls providers in priority order until one succeeds.
 * Skips providers that don't support the requested tier.
 * Handles rate limits by moving to the next provider.
 */
export async function callWithFallback(request: AIRequest): Promise<AIResponse> {
  const providers = getAvailableProviders();
  const requestedTier = request.modelTier ?? 'balanced';

  // Filter to providers that support the requested tier
  const eligible = providers.filter(p => p.tiers.includes(requestedTier));

  if (eligible.length === 0) {
    throw new Error(`No providers available for tier "${requestedTier}". Discovered providers: ${providers.map(p => p.id).join(', ') || 'none'}`);
  }

  const errors: string[] = [];

  for (const provider of eligible) {
    try {
      logger.info('MultiProvider', `Trying provider: ${provider.id} (priority=${provider.priority})`);
      const response = await provider.call(request);
      logger.info('MultiProvider', `Success with ${provider.id} in ${response.durationMs}ms`);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.toLowerCase().includes('rate limit') ||
                          message.includes('429') ||
                          err instanceof ClaudeRateLimitError;

      if (isRateLimit) {
        logger.warn('MultiProvider', `${provider.id} rate limited — skipping to next`, message);
      } else {
        logger.warn('MultiProvider', `${provider.id} failed — skipping to next`, message);
      }
      errors.push(`${provider.id}: ${message}`);
    }
  }

  throw new Error(
    `All ${eligible.length} providers failed for tier "${requestedTier}".\n` +
    errors.map(e => `  - ${e}`).join('\n')
  );
}
