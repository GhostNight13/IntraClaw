import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Claude pricing (EUR) — claude-3-5-sonnet-20241022
// Input: $3.00 / 1M tokens | Output: $15.00 / 1M tokens
// Using ~1.09 USD→EUR conversion as approximation
const COST_PER_INPUT_TOKEN_EUR  = (3.00  / 1_000_000) / 1.09;
const COST_PER_OUTPUT_TOKEN_EUR = (15.00 / 1_000_000) / 1.09;

const DAILY_BUDGET_EUR = 5.0;
const ALERT_THRESHOLD  = 0.85; // alert at 85% of budget

interface CostState {
  date: string; // YYYY-MM-DD
  totalCostEur: number;
  callCount: number;
  alertSent: boolean;
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
  return { date: getToday(), totalCostEur: 0, callCount: 0, alertSent: false };
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
    _state = { date: getToday(), totalCostEur: 0, callCount: 0, alertSent: false };
    saveState(_state);
  }
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * COST_PER_INPUT_TOKEN_EUR + outputTokens * COST_PER_OUTPUT_TOKEN_EUR;
}

export const costTracker = {
  /**
   * Record a Claude API call cost.
   * @returns false if the budget is exceeded (call should be blocked BEFORE calling this)
   */
  record(inputTokens: number, outputTokens: number): { costEur: number; budgetExceeded: boolean } {
    refreshIfNewDay();

    const costEur = estimateCost(inputTokens, outputTokens);
    _state.totalCostEur += costEur;
    _state.callCount++;
    saveState(_state);

    logger.info('CostTracker', `Call #${_state.callCount} cost ${costEur.toFixed(4)}€`, {
      total: `${_state.totalCostEur.toFixed(4)}€`,
      budget: `${DAILY_BUDGET_EUR}€`,
    });

    const usageRatio = _state.totalCostEur / DAILY_BUDGET_EUR;

    if (usageRatio >= ALERT_THRESHOLD && !_state.alertSent) {
      _state.alertSent = true;
      saveState(_state);
      logger.warn('CostTracker', `BUDGET ALERT: ${(usageRatio * 100).toFixed(1)}% of daily budget used`, {
        spent: `${_state.totalCostEur.toFixed(4)}€`,
        budget: `${DAILY_BUDGET_EUR}€`,
      });
    }

    const budgetExceeded = _state.totalCostEur >= DAILY_BUDGET_EUR;
    if (budgetExceeded) {
      logger.error('CostTracker', 'DAILY BUDGET EXCEEDED — blocking further Claude calls', {
        spent: `${_state.totalCostEur.toFixed(4)}€`,
      });
    }

    return { costEur, budgetExceeded };
  },

  /**
   * Check if budget allows a call BEFORE making it.
   * Optionally pass estimated tokens to check more precisely.
   */
  canAfford(estimatedInputTokens = 1000, estimatedOutputTokens = 500): boolean {
    refreshIfNewDay();
    const estimated = estimateCost(estimatedInputTokens, estimatedOutputTokens);
    return (_state.totalCostEur + estimated) <= DAILY_BUDGET_EUR;
  },

  getStatus(): { spentEur: number; budgetEur: number; remainingEur: number; callCount: number } {
    refreshIfNewDay();
    return {
      spentEur:    _state.totalCostEur,
      budgetEur:   DAILY_BUDGET_EUR,
      remainingEur: Math.max(0, DAILY_BUDGET_EUR - _state.totalCostEur),
      callCount:   _state.callCount,
    };
  },
};
