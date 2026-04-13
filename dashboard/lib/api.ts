const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface StatusResponse {
  scheduler: {
    paused: boolean;
    jobs: Array<{ name: string; cron: string; task: string; enabled: boolean; lastRunAt?: string }>;
  };
  rateLimits: {
    claude:   { count: number; max: number; remaining: number };
    gmail:    { count: number; max: number; remaining: number };
    scraping: { count: number; max: number; remaining: number };
  };
  budget: {
    spentEur:       number;
    budgetEur:      number;
    remainingEur:   number;
    callCount:      number;
    isSubscription?: boolean;
  };
  uptime: number;
  timestamp: string;
}

export interface ProspectsResponse {
  pipeline: {
    new: number; contacted: number; replied: number;
    demo_booked: number; converted: number; rejected: number; total: number;
  };
  rates: { response: number; conversion: number };
}

export interface Action {
  id: number;
  agent: string;
  task: string;
  status: 'running' | 'success' | 'error';
  duration_ms?: number;
  model?: string;
  cost_eur?: number;
  error?: string;
  created_at: string;
}

export interface ActionsResponse {
  actions: Action[];
  total: number;
}

export interface Notification {
  id: number;
  type: 'info' | 'warn' | 'error';
  message: string;
  read: number;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread: number;
}

export interface BlockedTask {
  id: number;
  task: string;
  reason: string;
  attempts: number;
  created_at: string;
}

export interface BlockedTasksResponse {
  blockedTasks: BlockedTask[];
  stats: {
    totalTasksRun: number;
    totalSuccesses: number;
    totalFailures: number;
    lastUpdated: string;
  };
}

export const api = {
  status:        ()          => apiFetch<StatusResponse>('/api/status'),
  prospects:     ()          => apiFetch<ProspectsResponse>('/api/prospects'),
  actions:       (limit = 50) => apiFetch<ActionsResponse>(`/api/actions?limit=${limit}`),
  notifications: ()          => apiFetch<NotificationsResponse>('/api/notifications'),
  markRead:      ()          => apiFetch<{ ok: boolean }>('/api/notifications/read', { method: 'POST' }),
  blockedTasks:  ()          => apiFetch<BlockedTasksResponse>('/api/blocked-tasks'),
  resolveBlocked: (id: number, command: 'retry' | 'skip' | 'abort', note = '') =>
    apiFetch<{ ok: boolean; id: number; command: string }>(
      `/api/blocked-tasks/${id}/resolve`,
      { method: 'POST', body: JSON.stringify({ command, note }) }
    ),
  chat:          (message: string) =>
    apiFetch<{ reply: string; model: string; tokens: number; durationMs: number }>(
      '/api/chat', { method: 'POST', body: JSON.stringify({ message }) }
    ),
  schedulerPause:  () => apiFetch<{ ok: boolean; state: string }>('/api/scheduler/pause',  { method: 'POST' }),
  schedulerResume: () => apiFetch<{ ok: boolean; state: string }>('/api/scheduler/resume', { method: 'POST' }),
  triggerAgent:    (task: string) =>
    apiFetch<{ ok: boolean; task: string }>(`/api/agents/${task}/trigger`, { method: 'POST' }),
};
