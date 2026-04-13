import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Claude CLI uses your Max subscription — no per-token billing.
// These constants are kept for informational logging only (not for blocking).
const COST_PER_INPUT_TOKEN_EUR  = (3.00  / 1_000_000) / 1.09;
const COST_PER_OUTPUT_TOKEN_EUR = (15.00 / 1_000_000) / 1.09;

interface CostState {
  date: string; // YYYY-MM-DD
  totalCostEur: number;
  callCount: number;
}

const STATE_PATH = path.resolve(process.cwd(), 'data', 'cost-state.json');

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): CostState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf8');
      const state = JSON.parse(raw) as CostState;
      if (state.date === getToday()) return state;
    }
  } catch {
    logger.warn('CostTracker', 'Failed to load state, starting fresh');
  }
  return { date: getToday(), totalCostEur: 0, callCount: 0 };
}

function saveState(state: CostState): void {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logger.error('CostTracker', 'Failed to save state', err);
  }
}

let _state: CostState = loadState();

function refreshIfNewDay(): void {
  if (_state.date !== getToday()) {
    logger.info('CostTracker', 'New day — resetting cost counter');
    _state = { date: getToday(), totalCostEur: 0, callCount: 0 };
    saveState(_state);
  }
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * COST_PER_INPUT_TOKEN_EUR + outputTokens * COST_PER_OUTPUT_TOKEN_EUR;
}

export const costTracker = {
  /**
   * Record a Claude CLI call for tracking purposes only.
   * Never blocks — with a Max subscription there's no per-call cost.
   */
  record(inputTokens: number, outputTokens: number): { costEur: number; budgetExceeded: false } {
    refreshIfNewDay();

    const costEur = estimateCost(inputTokens, outputTokens);
    _state.totalCostEur += costEur;
    _state.callCount++;
    saveState(_state);

    logger.info('CostTracker', `Call #${_state.callCount} (~${costEur.toFixed(4)}€ equiv.)`, {
      totalEquiv: `${_state.totalCostEur.toFixed(4)}€`,
    });

    // Always false — we never block on budget with a Max subscription
    return { costEur, budgetExceeded: false };
  },

  /**
   * Always returns true — Max subscription has no per-call cost gate.
   * Kept for API compatibility; Ollama fallback is triggered only on real rate limits.
   */
  canAfford(_estimatedInputTokens = 1000, _estimatedOutputTokens = 500): true {
    return true;
  },

  getStatus(): { spentEur: number; budgetEur: number; remainingEur: number; callCount: number; isSubscription: true } {
    refreshIfNewDay();
    return {
      spentEur:       _state.totalCostEur,
      budgetEur:      0,        // 0 = Max subscription sentinel (no cap)
      remainingEur:   0,        // not applicable with Max subscription
      callCount:      _state.callCount,
      isSubscription: true,
    };
  },
};
