import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export type ServiceName = 'claude' | 'gmail' | 'scraping';

interface ServiceConfig {
  maxPerDay: number;
}

const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  claude:   { maxPerDay: Infinity }, // Max subscription — no artificial cap; Ollama fallback triggered by real rate-limit errors only
  gmail:    { maxPerDay: 50 },
  scraping: { maxPerDay: 100 },
};

interface RateLimitState {
  counts: Record<ServiceName, number>;
  date: string; // YYYY-MM-DD
}

const STATE_PATH = path.resolve(process.cwd(), 'data', 'rate-limit-state.json');

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): RateLimitState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf8');
      const state = JSON.parse(raw) as RateLimitState;
      if (state.date === getToday()) {
        return state;
      }
    }
  } catch {
    logger.warn('RateLimiter', 'Failed to load state, starting fresh');
  }

  return {
    counts: { claude: 0, gmail: 0, scraping: 0 },
    date: getToday(),
  };
}

function saveState(state: RateLimitState): void {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logger.error('RateLimiter', 'Failed to save state', err);
  }
}

let _state: RateLimitState = loadState();

function refreshIfNewDay(): void {
  if (_state.date !== getToday()) {
    logger.info('RateLimiter', 'New day detected — resetting counters');
    _state = {
      counts: { claude: 0, gmail: 0, scraping: 0 },
      date: getToday(),
    };
    saveState(_state);
  }
}

export const rateLimiter = {
  /**
   * Returns true if the call is allowed and increments the counter.
   * Returns false if the daily limit is reached.
   */
  check(service: ServiceName): boolean {
    refreshIfNewDay();
    const config = SERVICE_CONFIGS[service];
    if (_state.counts[service] >= config.maxPerDay) {
      logger.warn('RateLimiter', `Daily limit reached for ${service}`, {
        count: _state.counts[service],
        max: config.maxPerDay,
      });
      return false;
    }
    _state.counts[service]++;
    saveState(_state);
    logger.info('RateLimiter', `${service} call #${_state.counts[service]}/${config.maxPerDay}`);
    return true;
  },

  getCount(service: ServiceName): number {
    refreshIfNewDay();
    return _state.counts[service];
  },

  getRemaining(service: ServiceName): number {
    refreshIfNewDay();
    return SERVICE_CONFIGS[service].maxPerDay - _state.counts[service];
  },

  getStatus(): Record<ServiceName, { count: number; max: number; remaining: number }> {
    refreshIfNewDay();
    const result = {} as Record<ServiceName, { count: number; max: number; remaining: number }>;
    for (const svc of Object.keys(SERVICE_CONFIGS) as ServiceName[]) {
      result[svc] = {
        count: _state.counts[svc],
        max: SERVICE_CONFIGS[svc].maxPerDay,
        remaining: SERVICE_CONFIGS[svc].maxPerDay - _state.counts[svc],
      };
    }
    return result;
  },
};
