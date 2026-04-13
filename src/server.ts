import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

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

// ─── Health check ─────────────────────────────────────────────────────────────

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
