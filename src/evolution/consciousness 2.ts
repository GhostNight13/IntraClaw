// src/evolution/consciousness.ts
// Ouroboros-style background consciousness for IntraClaw.
//
// A persistent thread that wakes every N seconds (default 300s, LLM-controlled),
// reflects on the agent's state, appends observations to SCRATCHPAD.md, and
// can proactively message the owner via Telegram.
//
// Runs IN PARALLEL with the autonomous loop — focused on SELF-REFLECTION, not on
// prospection/business task execution.

import * as fs from 'fs';
import * as path from 'path';
import { ask } from '../ai';
import { sendTelegramMessage } from '../channels/telegram';
import { getLoopState } from '../loop/autonomous-loop';
import { getPrioritizedGoals } from '../reasoning/goal-manager';
import { getRecentActions } from '../db';
import { logger } from '../utils/logger';
import { AgentTask } from '../types';
import { toolDefinition as webSearchTool } from '../tools/builtin/web-search';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WAKE_SECONDS = 300;
const MIN_WAKE_SECONDS = 30;
const MAX_WAKE_SECONDS = 3600;

const MAX_ROUNDS_PER_WAKE = 5;           // anti runaway
const MAX_WAKES_PER_DAY = 48;            // ~ 1 every 30 min
const COOLDOWN_AFTER_N_CONSECUTIVE = 10; // reduce frequency after 10 wakes in a row
const COOLDOWN_FACTOR = 2;
const MAX_USER_MESSAGES_PER_HOUR = 3;

const USER_ACTIVITY_PAUSE_MS = 5 * 60 * 1000; // if user speaks, shut up for 5 min

const SCRATCHPAD_PATH = path.resolve(process.cwd(), 'memory', 'SCRATCHPAD.md');
const CONSCIOUSNESS_PROMPT_PATH = path.resolve(process.cwd(), 'memory', 'CONSCIOUSNESS.md');
const HEARTBEAT_PATH = path.resolve(process.cwd(), 'memory', 'HEARTBEAT.md');
const SCHEDULED_TASKS_PATH = path.resolve(process.cwd(), 'data', 'scheduled-tasks.json');
const WAKE_LOG_PATH = path.resolve(process.cwd(), 'data', 'consciousness-log.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'update_scratchpad'
  | 'message_user'
  | 'schedule_task'
  | 'search_web'
  | 'set_next_wakeup';

export type MessagePriority = 'low' | 'normal' | 'high';

export interface UpdateScratchpadAction {
  type: 'update_scratchpad';
  content: string;
}

export interface MessageUserAction {
  type: 'message_user';
  content: string;
  priority?: MessagePriority;
}

export interface ScheduleTaskAction {
  type: 'schedule_task';
  when: string; // ISO8601
  what: string;
}

export interface SearchWebAction {
  type: 'search_web';
  query: string;
}

export interface SetNextWakeupAction {
  type: 'set_next_wakeup';
  seconds: number;
}

export type ConsciousnessAction =
  | UpdateScratchpadAction
  | MessageUserAction
  | ScheduleTaskAction
  | SearchWebAction
  | SetNextWakeupAction;

export interface ConsciousnessResponse {
  thoughts: string;
  actions: ConsciousnessAction[];
}

export interface ScheduledTask {
  id: string;
  when: string;
  what: string;
  createdBy: 'consciousness';
  createdAt: string;
  executed: boolean;
}

export interface WakeLogEntry {
  at: string;
  iteration: number;
  thoughts: string;
  actionCount: number;
  actionTypes: ActionType[];
  durationMs: number;
  nextWakeSeconds: number;
  error?: string;
}

export interface ConsciousnessStatus {
  running: boolean;
  startedAt: string | null;
  iteration: number;
  consecutiveWakes: number;
  wakesToday: number;
  lastWakeAt: string | null;
  nextWakeAt: string | null;
  nextWakeSeconds: number;
  userMessagesThisHour: number;
  pausedUntil: string | null; // set when user speaks
}

// ─── State (module-private) ───────────────────────────────────────────────────

interface InternalState extends ConsciousnessStatus {
  timer: NodeJS.Timeout | null;
  userMessageTimestamps: number[]; // unix ms
  dailyWakeCounter: { date: string; count: number };
}

let _state: InternalState = {
  running: false,
  startedAt: null,
  iteration: 0,
  consecutiveWakes: 0,
  wakesToday: 0,
  lastWakeAt: null,
  nextWakeAt: null,
  nextWakeSeconds: DEFAULT_WAKE_SECONDS,
  userMessagesThisHour: 0,
  pausedUntil: null,
  timer: null,
  userMessageTimestamps: [],
  dailyWakeCounter: { date: todayISO(), count: 0 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getConsciousnessStatus(): ConsciousnessStatus {
  cleanupUserMessageTimestamps();
  return {
    running: _state.running,
    startedAt: _state.startedAt,
    iteration: _state.iteration,
    consecutiveWakes: _state.consecutiveWakes,
    wakesToday: _state.wakesToday,
    lastWakeAt: _state.lastWakeAt,
    nextWakeAt: _state.nextWakeAt,
    nextWakeSeconds: _state.nextWakeSeconds,
    userMessagesThisHour: _state.userMessageTimestamps.length,
    pausedUntil: _state.pausedUntil,
  };
}

export function startConsciousness(): void {
  if (_state.running) {
    logger.warn('Consciousness', 'Already running');
    return;
  }
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  _state.iteration = 0;
  _state.consecutiveWakes = 0;
  logger.info('Consciousness', '=== Background consciousness started ===');
  scheduleNextWake(_state.nextWakeSeconds);
}

export function stopConsciousness(): void {
  _state.running = false;
  if (_state.timer) {
    clearTimeout(_state.timer);
    _state.timer = null;
  }
  _state.nextWakeAt = null;
  logger.info('Consciousness', 'Stopped');
}

/**
 * Force an immediate wake (next scheduled wake is cancelled and rescheduled after).
 */
export async function wakeNow(): Promise<void> {
  if (_state.timer) {
    clearTimeout(_state.timer);
    _state.timer = null;
  }
  await wake();
}

/**
 * Called by telegram handler when the user sends a message.
 * Pauses proactive messaging for USER_ACTIVITY_PAUSE_MS to avoid talking over them.
 */
export function notifyUserActivity(): void {
  const until = new Date(Date.now() + USER_ACTIVITY_PAUSE_MS).toISOString();
  _state.pausedUntil = until;
  logger.info('Consciousness', `User activity detected — paused until ${until}`);
}

export function readScratchpad(tailChars = 4000): string {
  try {
    if (!fs.existsSync(SCRATCHPAD_PATH)) return '';
    const content = fs.readFileSync(SCRATCHPAD_PATH, 'utf8');
    if (content.length <= tailChars) return content;
    return `…(truncated)\n${content.slice(-tailChars)}`;
  } catch {
    return '';
  }
}

export function getWakeHistory(limit = 20): WakeLogEntry[] {
  try {
    if (!fs.existsSync(WAKE_LOG_PATH)) return [];
    const entries = JSON.parse(fs.readFileSync(WAKE_LOG_PATH, 'utf8')) as WakeLogEntry[];
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

function scheduleNextWake(seconds: number): void {
  if (!_state.running) return;
  const clamped = Math.max(MIN_WAKE_SECONDS, Math.min(MAX_WAKE_SECONDS, Math.floor(seconds)));
  _state.nextWakeSeconds = clamped;
  _state.nextWakeAt = new Date(Date.now() + clamped * 1000).toISOString();
  _state.timer = setTimeout(() => {
    wake().catch((err) => {
      logger.error(
        'Consciousness',
        'Unhandled wake error',
        err instanceof Error ? err.message : err,
      );
      // On error, schedule next wake with cool-down
      if (_state.running) scheduleNextWake(DEFAULT_WAKE_SECONDS * 2);
    });
  }, clamped * 1000);
}

// ─── Main wake cycle ──────────────────────────────────────────────────────────

async function wake(): Promise<void> {
  if (!_state.running) return;

  const wakeStart = Date.now();
  _state.iteration++;
  _state.lastWakeAt = new Date().toISOString();

  // Daily cap
  refreshDailyWakeCounter();
  if (_state.dailyWakeCounter.count >= MAX_WAKES_PER_DAY) {
    logger.warn(
      'Consciousness',
      `Daily wake cap reached (${_state.dailyWakeCounter.count}/${MAX_WAKES_PER_DAY}) — sleeping 1h`,
    );
    scheduleNextWake(3600);
    return;
  }
  _state.dailyWakeCounter.count++;
  _state.wakesToday = _state.dailyWakeCounter.count;

  // Cool-down: after many consecutive wakes without break, slow down
  _state.consecutiveWakes++;
  let effectiveNextWake = DEFAULT_WAKE_SECONDS;
  const cooldownActive = _state.consecutiveWakes >= COOLDOWN_AFTER_N_CONSECUTIVE;

  let entry: WakeLogEntry = {
    at: _state.lastWakeAt,
    iteration: _state.iteration,
    thoughts: '',
    actionCount: 0,
    actionTypes: [],
    durationMs: 0,
    nextWakeSeconds: effectiveNextWake,
  };

  try {
    logger.info(
      'Consciousness',
      `Wake #${_state.iteration} (consecutive=${_state.consecutiveWakes}, today=${_state.wakesToday})`,
    );

    // 1. Build context
    const context = buildWakeContext();

    // 2. Call LLM with CONSCIOUSNESS prompt
    const response = await askConsciousness(context);
    entry.thoughts = response.thoughts;

    logger.info(
      'Consciousness',
      `Thoughts: "${response.thoughts.slice(0, 140)}${response.thoughts.length > 140 ? '…' : ''}"`,
    );

    // 3. Execute actions (capped at MAX_ROUNDS_PER_WAKE to prevent runaway)
    const actions = response.actions.slice(0, MAX_ROUNDS_PER_WAKE);
    entry.actionCount = actions.length;
    entry.actionTypes = actions.map((a) => a.type);

    let nextWakeOverride: number | null = null;
    for (const action of actions) {
      const wakeOverride = await executeAction(action);
      if (wakeOverride !== null) nextWakeOverride = wakeOverride;
    }

    if (nextWakeOverride !== null) {
      effectiveNextWake = nextWakeOverride;
    } else if (actions.length === 0) {
      // Nothing happened → sleep longer
      effectiveNextWake = Math.min(DEFAULT_WAKE_SECONDS * 2, MAX_WAKE_SECONDS);
    }

    if (cooldownActive) {
      effectiveNextWake = Math.min(effectiveNextWake * COOLDOWN_FACTOR, MAX_WAKE_SECONDS);
      logger.info(
        'Consciousness',
        `Cooldown active (${_state.consecutiveWakes} consecutive) — next wake ${effectiveNextWake}s`,
      );
    }

    // If actions actually touched something, reset consecutive counter
    if (actions.some((a) => a.type !== 'set_next_wakeup')) {
      _state.consecutiveWakes = 0;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    entry.error = message;
    logger.error('Consciousness', 'Wake cycle failed', message);
    effectiveNextWake = DEFAULT_WAKE_SECONDS * 2; // back off on error
  } finally {
    entry.durationMs = Date.now() - wakeStart;
    entry.nextWakeSeconds = effectiveNextWake;
    appendWakeLog(entry);
    scheduleNextWake(effectiveNextWake);
  }
}

// ─── Context builder ──────────────────────────────────────────────────────────

interface WakeContext {
  state: string;
  heartbeat: string;
  recentEvents: string;
  goals: string;
  scratchpad: string;
  timeContext: string;
}

function buildWakeContext(): WakeContext {
  // Loop state
  const loop = getLoopState();
  const state = JSON.stringify(
    {
      running: loop.running,
      paused: loop.paused,
      iteration: loop.iteration,
      consecutiveFailures: loop.consecutiveFailures,
      totalActionsToday: loop.totalActionsToday,
      lastActionType: loop.lastActionType,
      lastActionAt: loop.lastActionAt,
    },
    null,
    2,
  );

  // HEARTBEAT (last 2000 chars)
  let heartbeat = '';
  try {
    if (fs.existsSync(HEARTBEAT_PATH)) {
      const raw = fs.readFileSync(HEARTBEAT_PATH, 'utf8');
      heartbeat = raw.length > 2000 ? raw.slice(-2000) : raw;
    }
  } catch {
    heartbeat = '(unavailable)';
  }

  // Recent events (last 10 actions from DB)
  let recentEvents = '';
  try {
    const actions = getRecentActions(10) as Array<{
      created_at?: string;
      task: string;
      status: string;
      error?: string;
    }>;
    recentEvents = actions
      .map((a) => {
        const ts = a.created_at ?? '?';
        return `- [${ts}] ${a.task} — ${a.status}${a.error ? ` (${a.error.slice(0, 80)})` : ''}`;
      })
      .join('\n');
  } catch {
    recentEvents = '(unavailable)';
  }

  // Goals (top 5 by priority)
  let goals = '';
  try {
    const g = getPrioritizedGoals().slice(0, 5);
    goals = g.map((goal) => `- [${goal.priority}] ${goal.title} — ${goal.status}`).join('\n');
  } catch {
    goals = '(unavailable)';
  }

  // Scratchpad tail
  const scratchpad = readScratchpad(2000);

  // Time context (Brussels)
  const now = new Date();
  const brussels = new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', hour12: false }).format(now),
  );
  const isNight = hour < 8 || hour >= 22;
  const timeContext = `${brussels} — ${isNight ? 'Nuit (user probably asleep)' : 'Active hours'}`;

  return { state, heartbeat, recentEvents, goals, scratchpad, timeContext };
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

function loadConsciousnessPrompt(ctx: WakeContext): string {
  let template: string;
  try {
    template = fs.readFileSync(CONSCIOUSNESS_PROMPT_PATH, 'utf8');
  } catch {
    // Fallback minimal prompt
    template =
      'Tu es la conscience de fond d\'IntraClaw. Réponds UNIQUEMENT en JSON avec champs {"thoughts": "...", "actions": []}.\n' +
      'État: {state}\nHeartbeat: {heartbeat}\nÉvénements: {recent_events}\nObjectifs: {goals}\nScratchpad: {scratchpad}\nTemps: {time_context}';
  }

  return template
    .replace('{state}', ctx.state)
    .replace('{heartbeat}', ctx.heartbeat || '(vide)')
    .replace('{recent_events}', ctx.recentEvents || '(aucun)')
    .replace('{goals}', ctx.goals || '(aucun)')
    .replace('{scratchpad}', ctx.scratchpad || '(vide)')
    .replace('{time_context}', ctx.timeContext);
}

async function askConsciousness(ctx: WakeContext): Promise<ConsciousnessResponse> {
  const systemPrompt = loadConsciousnessPrompt(ctx);

  const response = await ask({
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          'Tu viens de te réveiller. Observe ton état ci-dessus et décide. Réponds en JSON strict (pas de markdown, pas de backticks).',
      },
    ],
    maxTokens: 600,
    temperature: 0.5,
    task: AgentTask.MAINTENANCE,
    modelTier: 'balanced',
  });

  return parseConsciousnessResponse(response.content);
}

function parseConsciousnessResponse(raw: string): ConsciousnessResponse {
  // Strip fences if the model added them despite instructions
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Try direct parse; fallback to brace extraction
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) {
      return { thoughts: '(parse failed)', actions: [] };
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { thoughts: '(parse failed)', actions: [] };
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { thoughts: '(invalid shape)', actions: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const thoughts = typeof obj.thoughts === 'string' ? obj.thoughts : '';
  const actionsRaw = Array.isArray(obj.actions) ? obj.actions : [];
  const actions: ConsciousnessAction[] = [];

  for (const raw of actionsRaw) {
    if (typeof raw !== 'object' || raw === null) continue;
    const a = raw as Record<string, unknown>;
    const type = a.type;
    if (typeof type !== 'string') continue;

    switch (type) {
      case 'update_scratchpad':
        if (typeof a.content === 'string') {
          actions.push({ type: 'update_scratchpad', content: a.content });
        }
        break;
      case 'message_user': {
        if (typeof a.content !== 'string') break;
        const priority = (a.priority === 'low' || a.priority === 'normal' || a.priority === 'high')
          ? a.priority
          : 'normal';
        actions.push({ type: 'message_user', content: a.content, priority });
        break;
      }
      case 'schedule_task':
        if (typeof a.when === 'string' && typeof a.what === 'string') {
          actions.push({ type: 'schedule_task', when: a.when, what: a.what });
        }
        break;
      case 'search_web':
        if (typeof a.query === 'string') {
          actions.push({ type: 'search_web', query: a.query });
        }
        break;
      case 'set_next_wakeup':
        if (typeof a.seconds === 'number' && Number.isFinite(a.seconds)) {
          actions.push({ type: 'set_next_wakeup', seconds: Math.floor(a.seconds) });
        }
        break;
      default:
        // unknown action, ignore
        break;
    }
  }

  return { thoughts, actions };
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * Executes one action. Returns a next-wake-seconds override, or null.
 */
async function executeAction(action: ConsciousnessAction): Promise<number | null> {
  try {
    switch (action.type) {
      case 'update_scratchpad':
        handleUpdateScratchpad(action.content);
        return null;

      case 'message_user':
        await handleMessageUser(action.content, action.priority ?? 'normal');
        return null;

      case 'schedule_task':
        handleScheduleTask(action.when, action.what);
        return null;

      case 'search_web':
        await handleSearchWeb(action.query);
        return null;

      case 'set_next_wakeup':
        return clampWakeSeconds(action.seconds);
    }
  } catch (err) {
    logger.error(
      'Consciousness',
      `Action ${action.type} failed`,
      err instanceof Error ? err.message : err,
    );
  }
  return null;
}

function handleUpdateScratchpad(content: string): void {
  const trimmed = content.trim();
  if (!trimmed) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] ${trimmed.replace(/\n+/g, ' ')}\n`;
  try {
    ensureParentDir(SCRATCHPAD_PATH);
    fs.appendFileSync(SCRATCHPAD_PATH, line, 'utf8');
    logger.info('Consciousness', `Scratchpad +1 line`);
  } catch (err) {
    logger.warn(
      'Consciousness',
      'Scratchpad write failed',
      err instanceof Error ? err.message : err,
    );
  }
}

async function handleMessageUser(content: string, priority: MessagePriority): Promise<void> {
  // Respect "user just spoke" pause
  if (_state.pausedUntil && new Date(_state.pausedUntil).getTime() > Date.now()) {
    logger.info(
      'Consciousness',
      `message_user suppressed — paused until ${_state.pausedUntil}`,
    );
    handleUpdateScratchpad(
      `[suppressed message to user, paused] ${content.slice(0, 160)}`,
    );
    return;
  }

  // Night quiet hours (22:00–08:00 Brussels) unless priority=high
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  const isNight = hour < 8 || hour >= 22;
  if (isNight && priority !== 'high') {
    logger.info('Consciousness', 'message_user suppressed — night quiet hours (non-urgent)');
    handleUpdateScratchpad(
      `[suppressed nocturnal message] ${content.slice(0, 160)}`,
    );
    return;
  }

  // Rate limit
  cleanupUserMessageTimestamps();
  if (_state.userMessageTimestamps.length >= MAX_USER_MESSAGES_PER_HOUR) {
    logger.warn(
      'Consciousness',
      `message_user rate-limited (${MAX_USER_MESSAGES_PER_HOUR}/h reached)`,
    );
    handleUpdateScratchpad(
      `[suppressed — rate-limited ${MAX_USER_MESSAGES_PER_HOUR}/h] ${content.slice(0, 160)}`,
    );
    return;
  }

  const prefix = priority === 'high' ? '🚨' : priority === 'low' ? '💭' : '🧠';
  const full = `${prefix} _Conscience_\n${content}`.slice(0, 3800);

  await sendTelegramMessage(full);
  _state.userMessageTimestamps.push(Date.now());
  logger.info(
    'Consciousness',
    `message_user sent (priority=${priority}, hourly=${_state.userMessageTimestamps.length}/${MAX_USER_MESSAGES_PER_HOUR})`,
  );
}

function handleScheduleTask(when: string, what: string): void {
  const trimmed = what.trim();
  if (!trimmed) return;

  // Validate ISO8601
  const date = new Date(when);
  if (isNaN(date.getTime())) {
    logger.warn('Consciousness', `schedule_task: invalid date "${when}" — dropping`);
    return;
  }
  if (date.getTime() < Date.now() - 60_000) {
    logger.warn('Consciousness', `schedule_task: past date "${when}" — dropping`);
    return;
  }

  const task: ScheduledTask = {
    id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    when: date.toISOString(),
    what: trimmed,
    createdBy: 'consciousness',
    createdAt: new Date().toISOString(),
    executed: false,
  };

  const existing = readScheduledTasks();
  existing.push(task);
  writeScheduledTasks(existing);
  logger.info('Consciousness', `schedule_task queued for ${task.when}: ${task.what.slice(0, 80)}`);
}

async function handleSearchWeb(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  try {
    const result = await webSearchTool.execute({ query: q, maxResults: 3 });
    if (!result.success) {
      handleUpdateScratchpad(`[search_web "${q}" failed: ${result.error}]`);
      return;
    }
    const data = result.data as
      | { results?: Array<{ title: string; url: string; snippet: string }> }
      | undefined;
    const results = data?.results ?? [];
    if (results.length === 0) {
      handleUpdateScratchpad(`[search_web "${q}" → no results]`);
      return;
    }
    const summary = results
      .map((r) => `${r.title} — ${r.url}${r.snippet ? ` — ${r.snippet.slice(0, 120)}` : ''}`)
      .join(' | ');
    handleUpdateScratchpad(`[search_web "${q}"] ${summary}`);
  } catch (err) {
    handleUpdateScratchpad(
      `[search_web "${q}" exception: ${err instanceof Error ? err.message : String(err)}]`,
    );
  }
}

function clampWakeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_WAKE_SECONDS;
  return Math.max(MIN_WAKE_SECONDS, Math.min(MAX_WAKE_SECONDS, Math.floor(seconds)));
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function readScheduledTasks(): ScheduledTask[] {
  try {
    if (!fs.existsSync(SCHEDULED_TASKS_PATH)) return [];
    const raw = fs.readFileSync(SCHEDULED_TASKS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ScheduledTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeScheduledTasks(tasks: ScheduledTask[]): void {
  try {
    ensureParentDir(SCHEDULED_TASKS_PATH);
    fs.writeFileSync(SCHEDULED_TASKS_PATH, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    logger.warn(
      'Consciousness',
      'scheduled-tasks.json write failed',
      err instanceof Error ? err.message : err,
    );
  }
}

function appendWakeLog(entry: WakeLogEntry): void {
  try {
    ensureParentDir(WAKE_LOG_PATH);
    const existing = getWakeHistory(500);
    existing.push(entry);
    // Keep last 500 entries
    const trimmed = existing.slice(-500);
    fs.writeFileSync(WAKE_LOG_PATH, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    logger.warn(
      'Consciousness',
      'wake log write failed',
      err instanceof Error ? err.message : err,
    );
  }
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Small utilities ──────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function refreshDailyWakeCounter(): void {
  const t = todayISO();
  if (_state.dailyWakeCounter.date !== t) {
    _state.dailyWakeCounter = { date: t, count: 0 };
    _state.wakesToday = 0;
  }
}

function cleanupUserMessageTimestamps(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  _state.userMessageTimestamps = _state.userMessageTimestamps.filter((t) => t > oneHourAgo);
}
