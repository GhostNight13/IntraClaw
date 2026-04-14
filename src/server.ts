import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { getJobs, stopScheduler, startScheduler } from './scheduler';
import { getProspectsByStatus } from './tools/notion';
import { runTask } from './agents/coordinator';
import { buildSystemPrompt } from './memory/core';
import { ask } from './ai';
import { getRecentActions, getUnreadNotifications, markNotificationsRead, getDb } from './db';
import { AgentTask, ProspectStatus } from './types';
import { getPendingBlockedTasks, resolveBlockedTask, getAutonomousStats } from './agents/autonomous-runner';
import {
  getPendingProposals, getProposal, approveProposal, rejectProposal,
  applyProposal, getImprovementStats,
} from './agents/self-improvement';
import { getMemoryStats, updateHeartbeat } from './memory/enhanced';
import { handleVoiceCommand } from './tools/voice-handler';
import { synthesize } from './tools/tts';
import {
  takeScreenshot, clickAt, typeText, pressKey,
  openApp, closeApp, focusApp, getRunningApps,
  runAppleScriptFile, getClipboard, setClipboard,
  showNotification, getScreenBounds,
} from './tools/computer-use';
import { getLoopState, pauseLoop, resumeLoop } from './loop/autonomous-loop';
import { getAllGoals, addGoal, updateGoalStatus, getPrioritizedGoals } from './reasoning/goal-manager';
import { executeUniversalTask } from './executor/universal-executor';
import { getRouterStats } from './routing/pal-router';
import { getStrategyLineage } from './evolution/strategy-evolver';
import { getBusinessMemoryState } from './memory/business-memory';
import { runREMCycle } from './memory/dreaming';
import { generateEmailDigest, formatDigestForTelegram, getRules, addRule, deleteRule } from './tools/email-manager';
import { authRouter } from './auth/routes';
import { marketplaceRouter } from './marketplace';
import { pluginsRouter } from './plugins';
import { workflowsRouter } from './workflows';
import { webhookRouter, apiWebhookRouter } from './webhooks/router';
import { setLanguage, getCurrentLanguage } from './i18n';
import { updateUser, findUserById } from './users/user-store';
import { initCalendar, listAllEvents, createCalendarEvent, deleteCalendarEvent, findFreeSlots, getTodaysAgenda, isCalendarAvailable } from './tools/calendar';
import { isConnected as isHAConnected, getStates as getHAStates } from './tools/smart-home/ha-client';
import { listDevices, controlDevice } from './tools/smart-home/devices';
import { generateImageWithFallback, generateVideo, textToSpeech, listMedia } from './tools/media';
import { analyzeImage } from './tools/vision/vision-analyzer';
import type { VisionMediaType } from './tools/vision/types';
import { getBudgetStatus, getBudgetReport, updateBudget } from './utils/budget-manager';
import { sseManager } from './streaming/sse-manager';
import { getThoughts, getRecentThoughts } from './reasoning/thought-logger';
import { readFile as coderReadFile, writeFile as coderWriteFile, previewWrite } from './tools/coder/code-writer';
import { runCode } from './tools/coder/code-runner';
import { listSnapshots, rollbackToSnapshot } from './tools/coder/rollback';
import { createEntity, updateEntity, deleteEntity, listEntities, searchEntities, createRelationship, deleteRelationship, getNeighbors } from './memory/graph/graph-memory';
import { extractSubgraph, getGraphStats } from './memory/graph/graph-query';

const PORT = parseInt(process.env.API_PORT ?? '3001', 10);
let schedulerPaused = false;

// ─── WebSocket broadcast ──────────────────────────────────────────────────────

export interface WSEvent {
  type: 'agent_start' | 'agent_done' | 'prospect_moved' | 'email_sent' | 'cost_update' | 'notification';
  [key: string]: unknown;
}

const clients = new Set<WebSocket>();

export function broadcast(event: WSEvent): void {
  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/** Broadcast arbitrary JSON to all connected WebSocket clients (used by autonomous loop). */
export function broadcastWS(data: Record<string, unknown>): void {
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS for dashboard Next.js (localhost:3000)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.use('/auth', authRouter);

// ─── Marketplace routes ───────────────────────────────────────────────────────
app.use('/api/marketplace', marketplaceRouter);

// ─── Plugin routes ────────────────────────────────────────────────────────────
app.use('/api/plugins', pluginsRouter);

// ─── Workflow routes ──────────────────────────────────────────────────────────
app.use('/api/workflows', workflowsRouter);

// ─── Webhook routes (raw body for HMAC) ──────────────────────────────────────
app.use('/webhooks', webhookRouter);
app.use('/api/webhooks', apiWebhookRouter);

// ─── GET /api/status ──────────────────────────────────────────────────────────

app.get('/api/status', (_req: Request, res: Response) => {
  const rate = rateLimiter.getStatus();
  const cost = costTracker.getStatus();
  const jobs = getJobs();

  res.json({
    scheduler: {
      paused: schedulerPaused,
      jobs: jobs.map(j => ({
        name:    j.name,
        cron:    j.cronExpression,
        task:    j.task,
        enabled: j.enabled,
        lastRunAt: j.lastRunAt,
      })),
    },
    rateLimits: rate,
    budget:     cost,
    uptime:     process.uptime(),
    timestamp:  new Date().toISOString(),
  });
});

// ─── GET /api/prospects ───────────────────────────────────────────────────────

app.get('/api/prospects', async (_req: Request, res: Response) => {
  try {
    const [newP, contacted, replied, demoBooked, converted, rejected] = await Promise.all([
      getProspectsByStatus(ProspectStatus.NEW),
      getProspectsByStatus(ProspectStatus.CONTACTED),
      getProspectsByStatus(ProspectStatus.REPLIED),
      getProspectsByStatus(ProspectStatus.DEMO_BOOKED),
      getProspectsByStatus(ProspectStatus.CONVERTED),
      getProspectsByStatus(ProspectStatus.REJECTED),
    ]);

    const total = newP.length + contacted.length + replied.length +
                  demoBooked.length + converted.length + rejected.length;

    res.json({
      pipeline: {
        new:        newP.length,
        contacted:  contacted.length,
        replied:    replied.length,
        demo_booked: demoBooked.length,
        converted:  converted.length,
        rejected:   rejected.length,
        total,
      },
      rates: {
        response: contacted.length > 0
          ? +((replied.length / contacted.length) * 100).toFixed(1)
          : 0,
        conversion: replied.length > 0
          ? +((converted.length / replied.length) * 100).toFixed(1)
          : 0,
      },
      prospects: {
        new:       newP.slice(0, 10),
        contacted: contacted.slice(0, 10),
        replied:   replied.slice(0, 5),
        converted: converted.slice(0, 5),
      },
    });
  } catch (err) {
    logger.error('Server', '/api/prospects error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/actions ─────────────────────────────────────────────────────────

app.get('/api/actions', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);
  try {
    const actions = getRecentActions(limit);
    res.json({ actions, total: actions.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/notifications ───────────────────────────────────────────────────

app.get('/api/notifications', (_req: Request, res: Response) => {
  try {
    const notifications = getUnreadNotifications();
    res.json({ notifications, unread: notifications.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/notifications/read', (_req: Request, res: Response) => {
  try {
    markNotificationsRead();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/chat ───────────────────────────────────────────────────────────

app.post('/api/chat', async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: message.trim() },
      ],
      maxTokens:   800,
      temperature: 0.7,
    });

    res.json({
      reply:     response.content,
      model:     response.model,
      tokens:    response.inputTokens + response.outputTokens,
      durationMs: response.durationMs,
    });
  } catch (err) {
    logger.error('Server', '/api/chat error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/agents/:task/trigger ──────────────────────────────────────────

app.post('/api/agents/:task/trigger', async (req: Request, res: Response) => {
  const taskName = req.params['task'] as AgentTask;
  const validTasks = Object.values(AgentTask) as string[];

  if (!validTasks.includes(taskName)) {
    res.status(400).json({ error: `Unknown task: ${taskName}` });
    return;
  }

  logger.info('Server', `Manual trigger: ${taskName}`);
  broadcast({ type: 'agent_start', agent: 'coordinator', task: taskName });

  // Run async — don't block the HTTP response
  runTask(taskName)
    .then(result => {
      broadcast({
        type:       'agent_done',
        agent:      'coordinator',
        task:       taskName,
        success:    result.success,
        durationMs: result.durationMs,
      });
    })
    .catch(err => {
      logger.error('Server', `Trigger error for ${taskName}`, err);
    });

  res.json({ ok: true, task: taskName, message: 'Task triggered asynchronously' });
});

// ─── POST /api/scheduler/pause & /resume ────────────────────────────────────

app.post('/api/scheduler/pause', (_req: Request, res: Response) => {
  if (schedulerPaused) { res.json({ ok: true, state: 'already_paused' }); return; }
  stopScheduler();
  schedulerPaused = true;
  logger.info('Server', 'Scheduler paused via API');
  broadcast({ type: 'notification', message: 'Scheduler mis en pause', level: 'warn' });
  res.json({ ok: true, state: 'paused' });
});

app.post('/api/scheduler/resume', (_req: Request, res: Response) => {
  if (!schedulerPaused) { res.json({ ok: true, state: 'already_running' }); return; }
  startScheduler();
  schedulerPaused = false;
  logger.info('Server', 'Scheduler resumed via API');
  broadcast({ type: 'notification', message: 'Scheduler repris', level: 'info' });
  res.json({ ok: true, state: 'running' });
});

// ─── GET /api/blocked-tasks ───────────────────────────────────────────────────

app.get('/api/blocked-tasks', (_req: Request, res: Response) => {
  try {
    const tasks = getPendingBlockedTasks();
    const stats = getAutonomousStats();
    res.json({ blockedTasks: tasks, stats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/blocked-tasks/:id/resolve ─────────────────────────────────────

app.post('/api/blocked-tasks/:id/resolve', (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id'] ?? ''), 10);
  const { command, note = '' } = req.body as { command?: string; note?: string };

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  if (!command || !['retry', 'skip', 'abort'].includes(command)) {
    res.status(400).json({ error: 'command must be retry | skip | abort' });
    return;
  }

  try {
    resolveBlockedTask(id, command as 'retry' | 'skip' | 'abort', note);
    logger.info('Server', `Blocked task #${id} resolved via API: ${command}`);
    broadcast({ type: 'notification', message: `Tâche bloquée #${id} débloquée: ${command}`, level: 'info' });
    res.json({ ok: true, id, command });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/voice ─────────────────────────────────────────────────────────

app.post('/api/voice', async (req: Request, res: Response) => {
  const { transcript } = req.body as { transcript?: string };
  if (!transcript?.trim()) { res.status(400).json({ error: 'transcript required' }); return; }

  const response = await handleVoiceCommand({ transcript });

  if (response.audioBase64) {
    res.json({
      reply:      response.reply,
      audio:      response.audioBase64,
      format:     'mp3',
      provider:   response.provider,
      durationMs: response.durationMs,
      model:      response.model,
    });
  } else {
    res.json({
      reply:      response.reply,
      provider:   response.provider,
      durationMs: response.durationMs,
      model:      response.model,
    });
  }
});

// ─── POST /api/task ──────────────────────────────────────────────────────────

app.post('/api/task', async (req: Request, res: Response) => {
  const { request } = req.body as { request?: string };
  if (!request) { res.status(400).json({ error: 'Missing request' }); return; }

  try {
    const result = await executeUniversalTask(request);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown' });
  }
});

// ─── GET /api/memory ─────────────────────────────────────────────────────────

app.get('/api/memory', (_req: Request, res: Response) => {
  try {
    res.json(getMemoryStats());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/improvements ───────────────────────────────────────────────────

app.get('/api/improvements', (_req: Request, res: Response) => {
  try {
    const proposals = getPendingProposals();
    const stats     = getImprovementStats();
    res.json({ proposals, stats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/improvements/:id ───────────────────────────────────────────────

app.get('/api/improvements/:id', (req: Request, res: Response) => {
  const id = String(req.params['id'] ?? '');
  const proposal = getProposal(id);
  if (!proposal) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ proposal });
});

// ─── POST /api/improvements/:id/approve ──────────────────────────────────────

app.post('/api/improvements/:id/approve', async (req: Request, res: Response) => {
  const id = String(req.params['id'] ?? '');
  const proposal = getProposal(id);
  if (!proposal) { res.status(404).json({ error: 'Not found' }); return; }

  approveProposal(id);
  logger.info('Server', `Proposal ${id} approved via API — applying...`);

  try {
    const result = await applyProposal(id);
    broadcast({ type: 'notification', message: `Amélioration appliquée: ${proposal.title}`, level: 'info' });
    res.json({ ok: result.success, result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/improvements/:id/reject ───────────────────────────────────────

app.post('/api/improvements/:id/reject', (req: Request, res: Response) => {
  const id = String(req.params['id'] ?? '');
  const { reason = '' } = req.body as { reason?: string };
  const proposal = getProposal(id);
  if (!proposal) { res.status(404).json({ error: 'Not found' }); return; }

  rejectProposal(id, reason);
  broadcast({ type: 'notification', message: `Proposition rejetée: ${proposal.title}`, level: 'warn' });
  res.json({ ok: true });
});

// ─── GET /api/strategy/lineage ───────────────────────────────────────────────

app.get('/api/strategy/lineage', (_req: Request, res: Response) => {
  res.json(getStrategyLineage());
});

// ─── POST /api/computer-use/screenshot ───────────────────────────────────────

app.post('/api/computer-use/screenshot', async (_req: Request, res: Response) => {
  try {
    const result = await takeScreenshot(true);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json({ ok: true, path: result.path, base64: result.base64 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/computer-use/click ────────────────────────────────────────────

app.post('/api/computer-use/click', async (req: Request, res: Response) => {
  const { x, y, button = 'left' } = req.body as { x?: number; y?: number; button?: 'left' | 'right' };
  if (x == null || y == null) { res.status(400).json({ error: 'x and y required' }); return; }

  const result = await clickAt(x, y, button);
  res.json(result);
});

// ─── POST /api/computer-use/type ─────────────────────────────────────────────

app.post('/api/computer-use/type', async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text) { res.status(400).json({ error: 'text required' }); return; }

  const result = await typeText(text);
  res.json(result);
});

// ─── POST /api/computer-use/key ──────────────────────────────────────────────

app.post('/api/computer-use/key', async (req: Request, res: Response) => {
  const { key, modifiers = [] } = req.body as { key?: string; modifiers?: string[] };
  if (!key) { res.status(400).json({ error: 'key required' }); return; }

  const result = await pressKey(key, modifiers);
  res.json(result);
});

// ─── POST /api/computer-use/app ───────────────────────────────────────────────

app.post('/api/computer-use/app', async (req: Request, res: Response) => {
  const { action, name } = req.body as { action?: 'open' | 'close' | 'focus'; name?: string };
  if (!name) { res.status(400).json({ error: 'name required' }); return; }

  let result;
  if (action === 'close')       result = await closeApp(name);
  else if (action === 'focus')  result = await focusApp(name);
  else                          result = await openApp(name);

  res.json(result);
});

// ─── GET /api/computer-use/apps ──────────────────────────────────────────────

app.get('/api/computer-use/apps', async (_req: Request, res: Response) => {
  const apps = await getRunningApps();
  res.json({ apps });
});

// ─── POST /api/computer-use/script ───────────────────────────────────────────

app.post('/api/computer-use/script', async (req: Request, res: Response) => {
  const { script } = req.body as { script?: string };
  if (!script) { res.status(400).json({ error: 'script required' }); return; }

  const result = await runAppleScriptFile(script);
  res.json(result);
});

// ─── GET /api/computer-use/screen ────────────────────────────────────────────

app.get('/api/computer-use/screen', async (_req: Request, res: Response) => {
  const bounds = await getScreenBounds();
  res.json(bounds);
});

// ─── GET /api/computer-use/clipboard ─────────────────────────────────────────

app.get('/api/computer-use/clipboard', async (_req: Request, res: Response) => {
  const text = await getClipboard();
  res.json({ text });
});

// ─── POST /api/computer-use/notify ───────────────────────────────────────────

app.post('/api/computer-use/notify', async (req: Request, res: Response) => {
  const { title = 'IntraClaw', message, sound = false } = req.body as {
    title?: string; message?: string; sound?: boolean;
  };
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  await showNotification(title, message, sound);
  res.json({ ok: true });
});

// ─── Loop endpoints ──────────────────────────────────────────────────────────
app.get('/api/loop/status', (_req, res) => {
  res.json(getLoopState());
});

app.post('/api/loop/pause', (req, res) => {
  const { reason } = req.body as { reason?: string };
  pauseLoop(reason ?? 'Manual pause');
  res.json({ paused: true });
});

app.post('/api/loop/resume', (_req, res) => {
  resumeLoop();
  res.json({ paused: false });
});

// ─── Goals endpoints ─────────────────────────────────────────────────────────
app.get('/api/goals', (_req, res) => {
  res.json(getPrioritizedGoals());
});

app.post('/api/goals', (req, res) => {
  const body = req.body as {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    timeframe: 'now' | 'today' | 'this_week' | 'ongoing';
    successCriteria: string;
  };
  const goal = addGoal(body);
  res.json(goal);
});

app.patch('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: 'active' | 'paused' | 'completed' | 'failed' };
  updateGoalStatus(id, status);
  res.json({ ok: true });
});

// ─── Business Memory ──────────────────────────────────────────────────────────

app.get('/api/business-memory', (_req: Request, res: Response) => {
  res.json(getBusinessMemoryState());
});

// ─── POST /api/memory/rem — Force un cycle REM ─────────────────────────────

app.post('/api/memory/rem', async (_req: Request, res: Response) => {
  try {
    const report = await runREMCycle();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/memory/rem/report — Last REM cycle sections from HEARTBEAT.md ──

app.get('/api/memory/rem/report', (_req: Request, res: Response) => {
  try {
    const heartbeatPath = path.join(process.cwd(), 'memory', 'HEARTBEAT.md');
    if (!fs.existsSync(heartbeatPath)) {
      return res.json({ exists: false, content: '', lastModified: null });
    }
    const content = fs.readFileSync(heartbeatPath, 'utf-8');
    const stat = fs.statSync(heartbeatPath);
    // Extract last 3 REM cycle sections
    const remSections = content.split('## 💤 Cycle REM').slice(1, 4).map(s => '## 💤 Cycle REM' + s);
    res.json({
      exists: true,
      lastModified: stat.mtime.toISOString(),
      recentCycles: remSections,
      totalLength: content.length,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/memory/rem/history — Compressed memories JSON ──────────────────

app.get('/api/memory/rem/history', (_req: Request, res: Response) => {
  try {
    const compressedPath = path.join(process.cwd(), 'data', 'compressed-memories.json');
    if (!fs.existsSync(compressedPath)) {
      return res.json({ memories: [], total: 0 });
    }
    const memories = JSON.parse(fs.readFileSync(compressedPath, 'utf-8')) as unknown[];
    res.json({ memories, total: memories.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Channels endpoints ───────────────────────────────────────────────────────

// GET /api/channels/status — État de tous les canaux actifs
app.get('/api/channels/status', (_req: Request, res: Response) => {
  const { getActiveChannels } = require('./channels/gateway') as { getActiveChannels: () => string[] };
  res.json({
    active: getActiveChannels(),
    timestamp: new Date().toISOString(),
  });
});

// POST /api/channels/authorize — Autorise un sender sur un canal
app.post('/api/channels/authorize', (req: Request, res: Response) => {
  const { addAuthorizedUser } = require('./channels/session-store') as {
    addAuthorizedUser: (u: { channelId: string; senderId: string; userId?: string }) => void;
  };
  const { channelId, senderId, userId } = req.body as {
    channelId?: string;
    senderId?: string;
    userId?: string;
  };
  if (!channelId || !senderId) {
    res.status(400).json({ error: 'channelId et senderId requis' });
    return;
  }
  addAuthorizedUser({ channelId, senderId, userId });
  res.json({ success: true, message: `${senderId} autorisé sur ${channelId}` });
});

// DELETE /api/channels/authorize/:channelId/:senderId
app.delete('/api/channels/authorize/:channelId/:senderId', (req: Request, res: Response) => {
  const { removeAuthorizedUser } = require('./channels/session-store') as {
    removeAuthorizedUser: (channelId: string, senderId: string) => void;
  };
  removeAuthorizedUser(String(req.params['channelId']), String(req.params['senderId']));
  res.json({ success: true });
});

// GET /api/channels/history/:channelId/:senderId
app.get('/api/channels/history/:channelId/:senderId', (req: Request, res: Response) => {
  const { getConversationHistory } = require('./channels/session-store') as {
    getConversationHistory: (channelId: string, senderId: string, limit: number) => unknown[];
  };
  const history = getConversationHistory(
    String(req.params['channelId']),
    String(req.params['senderId']),
    parseInt((req.query['limit'] as string) || '20', 10),
  );
  res.json({ history });
});

// ─── Email Manager endpoints ─────────────────────────────────────────────────

// GET /api/email/digest
app.get('/api/email/digest', async (_req: Request, res: Response) => {
  try {
    const digest = await generateEmailDigest();
    res.json(digest);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/email/digest/telegram — formaté pour Telegram
app.get('/api/email/digest/telegram', async (_req: Request, res: Response) => {
  try {
    const digest = await generateEmailDigest();
    const formatted = formatDigestForTelegram(digest);
    res.json({ text: formatted });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/email/rules — liste les règles
app.get('/api/email/rules', (_req: Request, res: Response) => {
  res.json({ rules: getRules() });
});

// POST /api/email/rules — ajoute une règle
app.post('/api/email/rules', (req: Request, res: Response) => {
  try {
    const rule = addRule(req.body);
    res.status(201).json({ rule });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /api/email/rules/:id
app.delete('/api/email/rules/:id', (req: Request, res: Response) => {
  const ok = deleteRule(String(req.params['id']));
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'Règle non trouvée' });
});

// ─── Calendar endpoints ────────────────────────────────────────────────────────

// GET /api/calendar/status
app.get('/api/calendar/status', (_req: Request, res: Response) => {
  res.json({ available: isCalendarAvailable() });
});

// GET /api/calendar/today
app.get('/api/calendar/today', async (_req: Request, res: Response) => {
  try {
    const agenda = await getTodaysAgenda();
    res.json({ agenda });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/calendar/events?from=ISO&to=ISO
app.get('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const from = new Date(req.query.from as string || new Date().toISOString());
    const to   = new Date(req.query.to as string || new Date(Date.now() + 7 * 86400000).toISOString());
    const events = await listAllEvents(from, to);
    res.json({ events, count: events.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/calendar/events
app.post('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const { title, description, startAt, endAt, location, attendees, isAllDay } = req.body as {
      title?: string; description?: string; startAt?: string; endAt?: string;
      location?: string; attendees?: { email: string; name?: string }[]; isAllDay?: boolean;
    };
    if (!title || !startAt || !endAt) {
      res.status(400).json({ error: 'title, startAt, endAt requis' });
      return;
    }
    const event = await createCalendarEvent({
      title, description, location, attendees, isAllDay,
      startAt: new Date(startAt),
      endAt:   new Date(endAt),
    });
    res.json({ event });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /api/calendar/events/:id
app.delete('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const source = (req.query.source as 'google' | 'outlook') || 'google';
    await deleteCalendarEvent(String(req.params['id']), source);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/calendar/free-slots?duration=60&from=ISO&to=ISO
app.get('/api/calendar/free-slots', async (req: Request, res: Response) => {
  try {
    const duration = parseInt(req.query.duration as string) || 60;
    const from     = new Date(req.query.from as string || new Date().toISOString());
    const to       = new Date(req.query.to as string || new Date(Date.now() + 7 * 86400000).toISOString());
    const slots = await findFreeSlots(duration, from, to);
    res.json({ slots, count: slots.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Smart Home endpoints ─────────────────────────────────────────────────────

// GET /api/smart-home/status
app.get('/api/smart-home/status', async (_req: Request, res: Response) => {
  try {
    const haConnected = isHAConnected();
    let device_count = 0;
    if (haConnected) {
      const states = await getHAStates();
      device_count = states.length;
    }
    res.json({ connected: haConnected, device_count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/smart-home/devices?domain=light
app.get('/api/smart-home/devices', async (req: Request, res: Response) => {
  try {
    const domain = req.query['domain'] as string | undefined;
    const devices = await listDevices(domain);
    res.json({ devices, count: devices.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/smart-home/control
app.post('/api/smart-home/control', async (req: Request, res: Response) => {
  const { command } = req.body as { command?: string };
  if (!command?.trim()) {
    res.status(400).json({ error: 'command required' });
    return;
  }
  try {
    const result = await controlDevice(command.trim());
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Media Generation endpoints ──────────────────────────────────────────────

// GET /api/media — list all generated media files
app.get('/api/media', (_req: Request, res: Response) => {
  try {
    const files = listMedia();
    res.json({ files, count: files.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/media/image — { prompt, width?, height? }
app.post('/api/media/image', async (req: Request, res: Response) => {
  const { prompt, width, height } = req.body as {
    prompt?: string; width?: number; height?: number;
  };
  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }
  try {
    const result = await generateImageWithFallback(prompt.trim(), { width, height });
    res.json(result);
  } catch (err) {
    logger.error('Server', '/api/media/image error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/media/video — { prompt }
app.post('/api/media/video', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }
  try {
    const result = await generateVideo(prompt.trim());
    res.json(result);
  } catch (err) {
    logger.error('Server', '/api/media/video error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/media/tts — { text, language? }
app.post('/api/media/tts', async (req: Request, res: Response) => {
  const { text, language = 'fr' } = req.body as { text?: string; language?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'text required' });
    return;
  }
  try {
    const result = await textToSpeech(text.trim(), language);
    res.json({ localPath: result.localPath, engine: result.engine, language: result.language });
  } catch (err) {
    logger.error('Server', '/api/media/tts error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── i18n endpoints ───────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];

// GET /api/i18n/languages
app.get('/api/i18n/languages', (_req: Request, res: Response) => {
  res.json({
    languages: SUPPORTED_LANGUAGES,
    current: getCurrentLanguage(),
  });
});

// POST /api/i18n/language — { locale: 'en' }
app.post('/api/i18n/language', (req: Request, res: Response) => {
  const { locale } = req.body as { locale?: string };
  const supported = SUPPORTED_LANGUAGES.map(l => l.code);

  if (!locale || !supported.includes(locale)) {
    res.status(400).json({
      error: `Invalid locale. Supported: ${supported.join(', ')}`,
    });
    return;
  }

  setLanguage(locale);

  // Persist to user profile if authenticated
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) {
    const updated = updateUser(userId, { locale });
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
  }

  res.json({ ok: true, locale, current: getCurrentLanguage() });
});

// ─── Budget endpoints ─────────────────────────────────────────────────────────

app.get('/api/budget', (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId ?? 'default';
  res.json(getBudgetStatus(userId));
});

app.patch('/api/budget', (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId ?? 'default';
  const { dailyEur, monthlyEur, alertThreshold } = req.body as { dailyEur?: number; monthlyEur?: number; alertThreshold?: number };
  updateBudget(userId, dailyEur ?? 5, monthlyEur ?? 50, alertThreshold ?? 0.8);
  res.json(getBudgetStatus(userId));
});

app.get('/api/budget/stats', (_req: Request, res: Response) => {
  res.json(getBudgetReport());
});

// ─── Vision endpoints ─────────────────────────────────────────────────────────

app.post('/api/vision/analyze', async (req: Request, res: Response) => {
  const { image, mediaType, prompt } = req.body as { image?: string; mediaType?: string; prompt?: string };
  if (!image) { res.status(400).json({ error: 'image (base64) required' }); return; }
  if (!prompt) { res.status(400).json({ error: 'prompt required' }); return; }
  try {
    const result = await analyzeImage(
      image,
      (mediaType ?? 'image/png') as VisionMediaType,
      prompt
    );
    res.json(result);
  } catch (err) {
    logger.error('Server', 'Vision analysis failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Vision failed' });
  }
});

// ─── SSE / Streaming endpoints ────────────────────────────────────────────────

app.get('/api/stream/thoughts', (req: Request, res: Response) => {
  const taskId = (req.query.taskId as string) ?? 'global';
  const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  sseManager.addClient(clientId, res, taskId);
  // Send existing thoughts for this task immediately
  const existing = getThoughts(taskId);
  for (const step of existing) {
    res.write(`data: ${JSON.stringify(step)}\n\n`);
  }
});

app.get('/api/reasoning/recent', (_req: Request, res: Response) => {
  res.json(getRecentThoughts(100));
});

app.get('/api/reasoning/:taskId', (req: Request, res: Response) => {
  const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
  res.json(getThoughts(taskId));
});

// ─── Agentic Coder endpoints ──────────────────────────────────────────────────

app.post('/api/code/execute', async (req: Request, res: Response) => {
  const { code, language } = req.body as { code?: string; language?: 'javascript' | 'typescript' | 'python' | 'bash' };
  if (!code) { res.status(400).json({ error: 'code required' }); return; }
  try {
    const result = await runCode(code, language ?? 'javascript');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Execution failed' });
  }
});

app.post('/api/code/diff', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string };
  if (!filePath || content === undefined) { res.status(400).json({ error: 'path and content required' }); return; }
  try {
    res.json(previewWrite(filePath, content));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Diff failed' });
  }
});

app.post('/api/code/write', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string };
  if (!filePath || content === undefined) { res.status(400).json({ error: 'path and content required' }); return; }
  try {
    const result = coderWriteFile(filePath, content);
    res.json({ ok: true, snapshot: result.snapshot });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Write failed' });
  }
});

app.get('/api/code/snapshots', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
  res.json(listSnapshots(filePath));
});

app.post('/api/code/rollback', (req: Request, res: Response) => {
  const { snapshotId } = req.body as { snapshotId?: string };
  if (!snapshotId) { res.status(400).json({ error: 'snapshotId required' }); return; }
  try {
    rollbackToSnapshot(snapshotId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Rollback failed' });
  }
});

// ─── Graph Memory endpoints ───────────────────────────────────────────────────

app.get('/api/graph/stats', (_req: Request, res: Response) => {
  res.json(getGraphStats());
});

app.get('/api/graph/entities', (req: Request, res: Response) => {
  const { type, q } = req.query as { type?: string; q?: string };
  if (q) {
    res.json(searchEntities(q, type as import('./memory/graph/types').EntityType | undefined));
  } else {
    res.json(listEntities(type as import('./memory/graph/types').EntityType | undefined));
  }
});

app.post('/api/graph/entities', (req: Request, res: Response) => {
  const { type, name, properties } = req.body as { type?: string; name?: string; properties?: Record<string, unknown> };
  if (!type || !name) { res.status(400).json({ error: 'type and name required' }); return; }
  res.status(201).json(createEntity(type as import('./memory/graph/types').EntityType, name, properties));
});

app.patch('/api/graph/entities/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = updateEntity(id, req.body as { name?: string; properties?: Record<string, unknown> });
  if (!result) { res.status(404).json({ error: 'Entity not found' }); return; }
  res.json(result);
});

app.delete('/api/graph/entities/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteEntity(id);
  res.json({ ok: true });
});

app.get('/api/graph/entities/:id/neighbors', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(getNeighbors(id));
});

app.get('/api/graph/entities/:id/subgraph', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const depth = parseInt((req.query.depth as string) ?? '2', 10);
  res.json(extractSubgraph(id, Math.min(depth, 4)));
});

app.post('/api/graph/relationships', (req: Request, res: Response) => {
  const { fromId, toId, type, weight, properties } = req.body as { fromId?: string; toId?: string; type?: string; weight?: number; properties?: Record<string, unknown> };
  if (!fromId || !toId || !type) { res.status(400).json({ error: 'fromId, toId, type required' }); return; }
  res.status(201).json(createRelationship(fromId, toId, type as import('./memory/graph/types').RelationshipType, weight, properties));
});

app.delete('/api/graph/relationships/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  deleteRelationship(id);
  res.json({ ok: true });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/router/stats', (_req: Request, res: Response) => {
  res.json(getRouterStats());
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ─── Server bootstrap ─────────────────────────────────────────────────────────

export function startServer(): void {
  // Init DB at startup to create tables
  try { getDb(); } catch (err) {
    logger.error('Server', 'DB init failed', err);
  }

  // Module 4: update HEARTBEAT on startup
  updateHeartbeat().catch(err => {
    logger.warn('Server', 'Initial HEARTBEAT update failed (non-fatal)', err instanceof Error ? err.message : err);
  });

  const httpServer = createServer(app);

  // WebSocket server on same HTTP server, path /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    clients.add(ws);
    logger.info('Server', `WS client connected (${clients.size} total)`, {
      ip: req.socket.remoteAddress,
    });

    // Send current status on connect
    ws.send(JSON.stringify({
      type:    'init',
      status:  rateLimiter.getStatus(),
      budget:  costTracker.getStatus(),
      paused:  schedulerPaused,
    }));

    // ─── Voice WebSocket messages ──────────────────────────────────────────
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; transcript?: string; text?: string };

        if (msg.type === 'voice') {
          const transcript = msg.transcript ?? msg.text ?? '';
          if (!transcript.trim()) return;

          // Acknowledge immediately
          ws.send(JSON.stringify({ type: 'voice_thinking', transcript }));

          const response = await handleVoiceCommand({ transcript });

          // Send text reply
          ws.send(JSON.stringify({
            type:      'voice_reply',
            transcript,
            reply:     response.reply,
            provider:  response.provider,
            durationMs: response.durationMs,
            model:     response.model,
          }));

          // Send audio as base64 if available
          if (response.audioBase64) {
            ws.send(JSON.stringify({
              type:    'voice_audio',
              audio:   response.audioBase64,
              format:  'mp3',
              provider: response.provider,
            }));
          }
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('Server', `WS client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', err => {
      logger.warn('Server', 'WS client error', err.message);
      clients.delete(ws);
    });
  });

  httpServer.listen(PORT, () => {
    logger.info('Server', `API listening on http://localhost:${PORT}`);
    logger.info('Server', `WebSocket on ws://localhost:${PORT}/ws`);
  });
}
