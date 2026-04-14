// src/loop/autonomous-loop.ts
// Core autonomous loop: Perception -> Reasoning -> Action -> Observation -> repeat (5 min)

import { buildPerceptionContext } from '../perception/context-aggregator';
import { decidNextAction } from '../reasoning/action-planner';
import { recordObservation } from './observation-recorder';
import { runTask } from '../agents/coordinator';
import { runAutonomous } from '../agents/autonomous-runner';
import { sendTelegramMessage } from '../channels/telegram';
import { broadcastWS } from '../server';
import { LoopState, LoopAction, AgentResult } from '../types';
import { logger } from '../utils/logger';
import { runREMCycle } from '../memory/dreaming';

const PERCEPTION_INTERVAL_MS = 5 * 60 * 1000;  // 5 min
const MIN_ACTION_GAP_MS       = 30 * 1000;       // 30s min between actions
const MAX_CONSECUTIVE_WAIT    = 6;               // 30 min idle -> notify

let _state: LoopState = {
  running: false, iteration: 0, startedAt: new Date().toISOString(),
  lastPerceptionAt: null, lastActionAt: null, lastActionType: null,
  consecutiveFailures: 0, totalActionsToday: 0, paused: false,
};
let _consecutiveWaits = 0;
let _loopTimeout: NodeJS.Timeout | null = null;
let _lastREMDate: string | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

export function getLoopState(): LoopState { return { ..._state }; }

export function pauseLoop(reason: string): void {
  _state.paused = true;
  _state.pauseReason = reason;
  logger.info('AutonomousLoop', `Paused: ${reason}`);
}

export function resumeLoop(): void {
  _state.paused = false;
  _state.pauseReason = undefined;
  logger.info('AutonomousLoop', 'Resumed');
}

export async function startAutonomousLoop(): Promise<void> {
  if (_state.running) {
    logger.warn('AutonomousLoop', 'Already running');
    return;
  }
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  logger.info('AutonomousLoop', '=== Autonomous loop started ===');
  await tick();
}

export function stopAutonomousLoop(): void {
  _state.running = false;
  if (_loopTimeout) { clearTimeout(_loopTimeout); _loopTimeout = null; }
  logger.info('AutonomousLoop', 'Stopped');
}

// ─── Core tick ──────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!_state.running) return;
  _state.iteration++;
  const tickStart = Date.now();

  try {
    // ── Paused? Skip this cycle ─────────────────────────────────────────
    if (_state.paused) {
      logger.info('AutonomousLoop', `Paused (${_state.pauseReason}) — skipping`);
      scheduleNext(PERCEPTION_INTERVAL_MS);
      return;
    }

    // ── REM Cycle: nocturnal memory consolidation (3h00-3h05) ────────
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const today = now.toISOString().slice(0, 10);

    if (hour === 3 && minute < 5 && _lastREMDate !== today) {
      _lastREMDate = today;
      logger.info('AutonomousLoop', 'Triggering nightly REM cycle...');
      try {
        const remReport = await runREMCycle();
        logger.info('AutonomousLoop', `REM cycle completed: ${remReport.actionsReviewed} actions reviewed, ${remReport.patternsFound.length} patterns found`);
        broadcastWS({ type: 'rem_cycle_done', report: remReport });
      } catch (err) {
        logger.error('AutonomousLoop', 'REM cycle failed', err instanceof Error ? err.message : err);
      }
    }

    // ── Phase 1: Perception ─────────────────────────────────────────────
    logger.info('AutonomousLoop', `=== Tick #${_state.iteration} — Perceiving... ===`);
    const ctx = await buildPerceptionContext();
    _state.lastPerceptionAt = ctx.timestamp;
    broadcastWS({ type: 'loop_perception', iteration: _state.iteration, ctx });

    // ── Phase 2: Reasoning ──────────────────────────────────────────────
    const action = await decidNextAction(ctx);
    broadcastWS({ type: 'loop_decision', action });

    // ── Wait decision ───────────────────────────────────────────────────
    if (action.type === 'wait') {
      _consecutiveWaits++;
      logger.info('AutonomousLoop', `Wait #${_consecutiveWaits} — ${action.reason}`);
      if (_consecutiveWaits >= MAX_CONSECUTIVE_WAIT) {
        _consecutiveWaits = 0;
        await sendTelegramMessage(
          `🤖 IntraClaw en veille depuis ${MAX_CONSECUTIVE_WAIT * 5} min. Pipeline calme.`
        ).catch(() => {});
      }
      scheduleNext(PERCEPTION_INTERVAL_MS);
      return;
    }

    // ── Throttle: min gap between actions ───────────────────────────────
    _consecutiveWaits = 0;
    const sinceLastAction = _state.lastActionAt
      ? Date.now() - new Date(_state.lastActionAt).getTime() : Infinity;

    if (sinceLastAction < MIN_ACTION_GAP_MS) {
      scheduleNext(MIN_ACTION_GAP_MS - sinceLastAction + 1000);
      return;
    }

    // ── Phase 3: Action ─────────────────────────────────────────────────
    if (action.type === 'notify_user') {
      if (action.notificationMessage) {
        await sendTelegramMessage(action.notificationMessage).catch(() => {});
      }
      _state.lastActionAt = new Date().toISOString();
      _state.lastActionType = 'notify_user';
      broadcastWS({ type: 'loop_action', action, success: true });
    } else if (action.agentTask) {
      await executeAgentTask(action);
    }

  } catch (err) {
    _state.consecutiveFailures++;
    logger.error('AutonomousLoop', `Tick error #${_state.consecutiveFailures}`, err instanceof Error ? err.message : err);
    if (_state.consecutiveFailures >= 5) {
      await sendTelegramMessage(
        `🚨 IntraClaw: ${_state.consecutiveFailures} erreurs consécutives dans la boucle.`
      ).catch(() => {});
    }
  }

  scheduleNext(Math.max(1000, PERCEPTION_INTERVAL_MS - (Date.now() - tickStart)));
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

function scheduleNext(delayMs: number): void {
  if (!_state.running) return;
  _loopTimeout = setTimeout(() => tick().catch(err =>
    logger.error('AutonomousLoop', 'Unhandled tick error', err instanceof Error ? err.message : err)
  ), delayMs);
}

// ─── Agent task execution ───────────────────────────────────────────────────

async function executeAgentTask(action: LoopAction): Promise<void> {
  if (!action.agentTask) return;
  const startMs = Date.now();
  const startedAt = new Date().toISOString();
  logger.info('AutonomousLoop', `Executing: ${action.type} — ${action.reason}`);
  broadcastWS({ type: 'loop_action_start', action });

  let result: AgentResult | null = null;
  try {
    // runAutonomous(task, runner, notifyFn) — delegates to coordinator's runTask
    result = await runAutonomous(action.agentTask, runTask, sendTelegramMessage);
    if (result.success) {
      _state.consecutiveFailures = 0;
      _state.totalActionsToday++;
    } else {
      _state.consecutiveFailures++;
    }
  } catch (err) {
    _state.consecutiveFailures++;
    result = {
      task: action.agentTask, success: false,
      error: err instanceof Error ? err.message : 'unknown',
      durationMs: Date.now() - startMs, model: 'none', timestamp: new Date().toISOString(),
    };
  }

  _state.lastActionAt = new Date().toISOString();
  _state.lastActionType = action.type;

  // ── Phase 4: Observation ──────────────────────────────────────────────
  await recordObservation({
    action, result, startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
  }).catch(err => logger.warn('AutonomousLoop', 'recordObservation failed', err instanceof Error ? err.message : err));

  broadcastWS({ type: 'loop_action_done', action, result });
}
