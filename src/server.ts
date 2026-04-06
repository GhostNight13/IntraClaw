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
