'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, ChevronRight } from 'lucide-react';
import { api, Action, ActionsResponse } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────────── */
interface AgentNode {
  key: string;
  name: string;
  role: string;
}

const COORDINATOR: AgentNode = { key: 'coordinator', name: 'Coordinator', role: 'Orchestrateur' };
const WORKERS: AgentNode[] = [
  { key: 'prospection', name: 'Prospection',  role: 'Scraping & leads'   },
  { key: 'cold-email',  name: 'Cold Email',   role: 'Emailing outbound'  },
  { key: 'content',     name: 'Content',      role: 'LinkedIn & posts'   },
  { key: 'crm',         name: 'CRM',          role: 'Notion & pipeline'  },
  { key: 'reporting',   name: 'Reporting',    role: 'Rapports & alertes' },
];

interface AgentStats {
  status: 'active' | 'idle' | 'error';
  lastTask: string;
  actionsToday: number;
  costToday: number;
  lastAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--accent-green)',
  idle:   'var(--text-muted)',
  error:  'var(--accent-red)',
};
const STATUS_LABEL: Record<string, string> = { active: 'actif', idle: 'idle', error: 'erreur' };

const AGENT_COLORS: Record<string, string> = {
  coordinator: 'var(--accent-blue)',
  prospection: '#8B5CF6',
  'cold-email': 'var(--accent-green)',
  content:     'var(--accent-yellow)',
  crm:         '#F97316',
  reporting:   'var(--accent-red)',
};

function buildStats(actions: Action[]): Record<string, AgentStats> {
  const today = new Date().toDateString();
  const map: Record<string, AgentStats> = {};
  const allKeys = [COORDINATOR, ...WORKERS].map(a => a.key);

  for (const key of allKeys) {
    const relevant = actions.filter(a => a.agent === key);
    const last = relevant[0];
    const todayActions = relevant.filter(a => new Date(a.created_at).toDateString() === today);
    const costToday = todayActions.reduce((s, a) => s + (a.cost_eur ?? 0), 0);
    map[key] = {
      status:       !last ? 'idle' : last.status === 'error' ? 'error' : last.status === 'running' ? 'active' : 'idle',
      lastTask:     last?.task ?? '—',
      actionsToday: todayActions.length,
      costToday,
      lastAt:       last ? new Date(last.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '—',
    };
  }
  return map;
}

/* ─── Node Card ──────────────────────────────────────────────── */
function AgentCard({
  node, stats, isCoordinator = false, onClick,
}: {
  node: AgentNode; stats: AgentStats; isCoordinator?: boolean; onClick: () => void;
}) {
  const accentColor = AGENT_COLORS[node.key] ?? 'var(--accent-blue)';
  const dotColor = STATUS_COLOR[stats.status];

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl p-4 border text-left transition-all duration-150 w-full"
      style={{
        background: 'var(--bg-card)',
        borderColor: accentColor + '60',
        boxShadow: isCoordinator ? `0 0 20px ${accentColor}20` : undefined,
        minWidth: isCoordinator ? 240 : 180,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = accentColor)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = accentColor + '60')}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {node.name}
          </span>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: accentColor + '20', color: accentColor }}>
          {STATUS_LABEL[stats.status]}
        </span>
      </div>

      {/* Role */}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{node.role}</span>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex flex-col">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Aujourd&apos;hui</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{stats.actionsToday} actions</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Coût</span>
          <span className="text-sm font-medium" style={{ color: 'var(--accent-yellow)' }}>
            {stats.costToday > 0 ? `${stats.costToday.toFixed(4)}€` : '—'}
          </span>
        </div>
      </div>

      {/* Last task */}
      <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {stats.lastTask !== '—' ? `↳ ${stats.lastTask}` : 'Aucune action récente'}
        {stats.lastAt !== '—' && (
          <span className="ml-1" style={{ color: 'var(--text-muted)' }}>({stats.lastAt})</span>
        )}
      </div>

      <div className="flex items-center gap-1 mt-1" style={{ color: accentColor }}>
        <span className="text-xs">Voir détails</span>
        <ChevronRight size={12} />
      </div>
    </button>
  );
}

/* ─── Drawer ─────────────────────────────────────────────────── */
function Drawer({
  node, actions, onClose,
}: {
  node: AgentNode; actions: Action[]; onClose: () => void;
}) {
  const relevant = actions.filter(a => a.agent === node.key).slice(0, 10);
  const accentColor = AGENT_COLORS[node.key] ?? 'var(--accent-blue)';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-96 flex flex-col border-l"
        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: accentColor }} />
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{node.name}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{node.role}</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <span className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>10 dernières exécutions</span>

          <div className="flex flex-col gap-3 mt-3">
            {relevant.length === 0 && (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Aucune exécution enregistrée
              </div>
            )}
            {relevant.map(a => {
              const isOk = a.status === 'success';
              const statusColor = isOk ? 'var(--accent-green)'
                : a.status === 'error' ? 'var(--accent-red)'
                : 'var(--text-muted)';
              const ts = new Date(a.created_at).toLocaleString('fr-BE', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              });
              return (
                <div key={a.id} className="rounded-lg p-3 border flex flex-col gap-1.5"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {a.task}
                    </span>
                    <span className="text-xs shrink-0 font-mono" style={{ color: statusColor }}>
                      {a.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ts}</span>
                    {a.model && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.model}</span>}
                    {a.duration_ms != null && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.duration_ms}ms</span>
                    )}
                    {a.cost_eur != null && a.cost_eur > 0 && (
                      <span className="text-xs" style={{ color: 'var(--accent-yellow)' }}>
                        {a.cost_eur.toFixed(4)}€
                      </span>
                    )}
                  </div>
                  {a.error && (
                    <span className="text-xs rounded px-2 py-1"
                      style={{ background: 'var(--accent-red)15', color: 'var(--accent-red)' }}>
                      {a.error}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function AgentsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentNode | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.actions(200) as ActionsResponse;
      setActions(res.actions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const stats = buildStats(actions);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Agents</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Organigramme en temps réel</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </div>

      {/* Org chart */}
      <div className="flex flex-col items-center gap-8">

        {/* Coordinator */}
        <div className="w-64">
          <AgentCard
            node={COORDINATOR}
            stats={stats[COORDINATOR.key] ?? { status: 'idle', lastTask: '—', actionsToday: 0, costToday: 0, lastAt: '—' }}
            isCoordinator
            onClick={() => setSelected(COORDINATOR)}
          />
        </div>

        {/* Connector line */}
        <div className="flex flex-col items-center">
          <div className="w-px h-6" style={{ background: 'var(--border)' }} />
          <div className="w-px h-2" style={{ background: 'var(--border)' }} />
        </div>

        {/* Horizontal line + workers */}
        <div className="relative w-full flex justify-center">
          {/* Top horizontal bar */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'var(--border)' }} />

          <div className="flex items-start justify-center gap-4 flex-wrap pt-6">
            {WORKERS.map(worker => (
              <div key={worker.key} className="flex flex-col items-center">
                {/* Vertical drop */}
                <div className="w-px h-6" style={{ background: 'var(--border)' }} />
                <AgentCard
                  node={worker}
                  stats={stats[worker.key] ?? { status: 'idle', lastTask: '—', actionsToday: 0, costToday: 0, lastAt: '—' }}
                  onClick={() => setSelected(worker)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <Drawer
          node={selected}
          actions={actions}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
