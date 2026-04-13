'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { AgentStatusBadge } from '@/components/AgentStatusBadge';
import { api, StatusResponse, ProspectsResponse, Action, BlockedTask } from '@/lib/api';

/* ─── Loop Status Hook & Widget ────────────────────────────────────────────── */
function useLoopStatus() {
  const [status, setStatus] = useState<{
    running: boolean;
    iteration: number;
    lastActionType: string | null;
    lastActionAt: string | null;
    paused: boolean;
    totalActionsToday: number;
    consecutiveFailures: number;
  } | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/loop/status');
        if (res.ok) setStatus(await res.json());
      } catch { /* silent */ }
    };
    fetch_();
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
  }, []);

  return status;
}

function LoopStatusWidget() {
  const status = useLoopStatus();
  if (!status) return null;

  const color = status.paused ? 'text-yellow-400' : status.running ? 'text-green-400' : 'text-red-400';
  const label = status.paused ? '⏸ Pause' : status.running ? '🟢 Actif' : '🔴 Arrete';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Boucle Autonome</p>
          <p className={`text-lg font-bold mt-1 ${color}`}>{label}</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>Iteration #{status.iteration}</div>
          <div>{status.totalActionsToday} actions aujourd&apos;hui</div>
          {status.consecutiveFailures > 0 && (
            <div className="text-red-400">{status.consecutiveFailures} echecs consecutifs</div>
          )}
        </div>
      </div>
      {status.lastActionType && (
        <div className="mt-3 text-xs text-gray-500">
          Derniere action : <span className="text-gray-300">{status.lastActionType}</span>
          {status.lastActionAt && (
            <span> — {new Date(status.lastActionAt).toLocaleTimeString('fr-BE')}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface DashboardData {
  status: StatusResponse | null;
  prospects: ProspectsResponse | null;
  actions: Action[];
  blockedTasks: BlockedTask[];
}

/* ─── Blocked Tasks Widget ──────────────────────────────────────────────────── */
function BlockedTasksWidget({ tasks, onResolve }: {
  tasks: BlockedTask[];
  onResolve: (id: number, command: 'retry' | 'skip' | 'abort') => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border flex flex-col"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--accent-red)40' }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: 'var(--accent-red)30', background: 'var(--accent-red)10' }}>
        <AlertTriangle size={14} style={{ color: 'var(--accent-red)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-red)' }}>
          Tâches bloquées — action requise ({tasks.length})
        </span>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {tasks.map(t => (
          <div key={t.id} className="flex items-start justify-between gap-4 px-5 py-4"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--accent-red)20', color: 'var(--accent-red)' }}>
                  #{t.id}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.task}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.attempts} tentative{t.attempts > 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-xs truncate" style={{ color: 'var(--accent-red)' }}>{t.reason}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date(t.created_at).toLocaleString('fr-BE')}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(['retry', 'skip', 'abort'] as const).map(cmd => (
                <button key={cmd}
                  onClick={() => onResolve(t.id, cmd)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: cmd === 'retry' ? 'var(--accent-blue)20'
                              : cmd === 'abort' ? 'var(--accent-red)20'
                              : 'var(--bg-hover)',
                    color: cmd === 'retry' ? 'var(--accent-blue)'
                         : cmd === 'abort' ? 'var(--accent-red)'
                         : 'var(--text-muted)',
                    border: '1px solid transparent',
                  }}>
                  {cmd === 'retry' ? '🔄 Retry' : cmd === 'abort' ? '🛑 Abort' : '⏭ Skip'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENTS = [
  { key: 'coordinator',  name: 'Coordinator'  },
  { key: 'prospection',  name: 'Prospection'  },
  { key: 'cold-email',   name: 'Cold Email'   },
  { key: 'content',      name: 'Content'      },
  { key: 'reporting',    name: 'Reporting'    },
];

const STAGE_COLORS: Record<string, string> = {
  new:          'var(--accent-blue)',
  contacted:    'var(--accent-yellow)',
  replied:      '#8B5CF6',
  demo_booked:  'var(--accent-green)',
  converted:    '#10B981',
};

function FunnelBar({ pipeline }: { pipeline: Record<string, number> }) {
  const stages = ['new', 'contacted', 'replied', 'demo_booked', 'converted'];
  const total = stages.reduce((s, k) => s + (pipeline[k] ?? 0), 0) || 1;

  return (
    <div className="rounded-xl p-5 border flex flex-col gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Pipeline prospects
      </span>
      <div className="flex h-5 rounded-full overflow-hidden gap-px">
        {stages.map(stage => {
          const count = pipeline[stage] ?? 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={stage} style={{ width: `${pct}%`, background: STAGE_COLORS[stage] }}
              title={`${stage}: ${count}`} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {stages.map(stage => (
          <div key={stage} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: STAGE_COLORS[stage] }} />
            <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
              {stage.replace('_', ' ')}&nbsp;
              <span style={{ color: 'var(--text-primary)' }}>{pipeline[stage] ?? 0}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_ICONS: Record<string, string> = { success: '✓', error: '✗', running: '⟳', pending: '·' };

function ActivityFeed({ actions }: { actions: Action[] }) {
  return (
    <div className="rounded-xl border flex flex-col"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Activité récente
        </span>
      </div>
      <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {actions.length === 0 && (
          <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucune action récente
          </div>
        )}
        {actions.slice(0, 8).map(a => {
          const isOk = a.status === 'success';
          const icon = STATUS_ICONS[a.status] ?? '·';
          const iconColor = isOk ? 'var(--accent-green)' : a.status === 'error' ? 'var(--accent-red)' : 'var(--text-muted)';
          const ts = new Date(a.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={a.id} className="flex items-start gap-3 px-5 py-3"
              style={{ borderColor: 'var(--border)' }}>
              <span className="mt-0.5 text-xs font-mono w-4 shrink-0 text-center"
                style={{ color: iconColor }}>{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {a.agent} — {a.task}
                  </span>
                  <span className="text-xs shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>{ts}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {a.model && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.model}</span>
                  )}
                  {a.duration_ms != null && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.duration_ms}ms</span>
                  )}
                  {a.cost_eur != null && a.cost_eur > 0 && (
                    <span className="text-xs" style={{ color: 'var(--accent-yellow)' }}>
                      {a.cost_eur.toFixed(4)}€
                    </span>
                  )}
                  {a.error && (
                    <span className="text-xs truncate" style={{ color: 'var(--accent-red)' }}>{a.error}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ status: null, prospects: null, actions: [], blockedTasks: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    const [s, p, a, b] = await Promise.allSettled([
      api.status(),
      api.prospects(),
      api.actions(10),
      api.blockedTasks(),
    ]);
    setData({
      status:       s.status === 'fulfilled' ? s.value : null,
      prospects:    p.status === 'fulfilled' ? p.value : null,
      actions:      a.status === 'fulfilled' ? (a.value as { actions: Action[] }).actions ?? [] : [],
      blockedTasks: b.status === 'fulfilled' ? b.value.blockedTasks : [],
    });
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  const handleResolveBlocked = useCallback(async (id: number, command: 'retry' | 'skip' | 'abort') => {
    try {
      await api.resolveBlocked(id, command);
      // Refresh blocked tasks immediately
      const b = await api.blockedTasks();
      setData(prev => ({ ...prev, blockedTasks: b.blockedTasks }));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const st = data.status;
  const pr = data.prospects;

  const pipeline = pr?.pipeline ?? {};
  const totalProspects = Object.values(pipeline).reduce((s: number, v) => s + (v as number), 0);
  const converted = (pipeline as Record<string, number>)['converted'] ?? 0;
  const convRate = totalProspects > 0 ? ((converted / totalProspects) * 100).toFixed(1) : '0';

  const budget = st?.budget;
  const isSubscription = budget?.isSubscription ?? false;
  const budgetUsed = (budget && !isSubscription && budget.budgetEur > 0)
    ? (budget.spentEur / budget.budgetEur) * 100
    : 0;
  const claudeUsed = st?.rateLimits?.claude?.count ?? 0;
  const claudeMax = st?.rateLimits?.claude?.max ?? null; // null = unlimited

  const today = new Date().toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Derive agent statuses from recent actions
  const agentStatuses = AGENTS.map(({ key, name }) => {
    const relevant = data.actions.filter(a => a.agent === key);
    const last = relevant[0];
    const status = !last ? 'idle'
      : last.status === 'error' ? 'error'
      : last.status === 'running' ? 'active'
      : 'idle';
    const todayActions = relevant.filter(a => {
      const d = new Date(a.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { name, status: status as 'active' | 'idle' | 'error', lastAction: last?.task, actionsToday: todayActions };
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">

      {/* Autonomous Loop Status */}
      <LoopStatusWidget />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--text-muted)' }}>{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Chargement…' : `Mis à jour ${lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Prospects total"
          value={totalProspects}
          sub={`${converted} convertis`}
          accent="blue"
          progress={Math.min(100, (totalProspects / 50) * 100)}
        />
        <KpiCard
          label="Taux conversion"
          value={`${convRate}%`}
          sub={pr ? `Réponses: ${pr.rates?.response ?? '—'}%` : '—'}
          accent="green"
        />
        <KpiCard
          label="Claude API"
          value={claudeMax === null ? `${claudeUsed} appels` : `${claudeUsed}/${claudeMax}`}
          sub={claudeMax === null ? 'Max subscription — illimité' : "appels aujourd'hui"}
          accent="blue"
          progress={claudeMax === null ? 0 : (claudeUsed / claudeMax) * 100}
        />
        <KpiCard
          label="Budget IA"
          value={budget ? `${budget.spentEur.toFixed(3)}€` : '—'}
          sub={isSubscription ? 'Abonnement Max (illimité)' : budget ? `Limite: ${budget.budgetEur}€/jour` : '—'}
          accent="green"
          progress={budgetUsed}
        />
      </div>

      {/* Funnel + Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FunnelBar pipeline={pipeline} />
        </div>
        <div className="rounded-xl p-5 border flex flex-col gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Agents
          </span>
          <div className="flex flex-col gap-2">
            {agentStatuses.map(a => (
              <AgentStatusBadge key={a.name} {...a} />
            ))}
          </div>
        </div>
      </div>

      {/* Blocked tasks — shown only when there are pending escalations */}
      <BlockedTasksWidget tasks={data.blockedTasks} onResolve={handleResolveBlocked} />

      {/* Activity feed */}
      <ActivityFeed actions={data.actions} />

      {/* Scheduler status */}
      {st && (
        <div className="rounded-xl p-5 border flex flex-col gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Scheduler
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: st.scheduler?.paused ? 'var(--accent-red)20' : 'var(--accent-green)20',
                color: st.scheduler?.paused ? 'var(--accent-red)' : 'var(--accent-green)',
              }}>
              {st.scheduler?.paused ? 'En pause' : 'Actif'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(st.scheduler?.jobs ?? []).map(job => (
              <div key={job.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{job.name}</span>
                <span className="font-mono">{job.cron}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
