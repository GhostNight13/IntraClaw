'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { api, Action, ActionsResponse } from '@/lib/api';

/* ─── Config ─────────────────────────────────────────────────── */
const AGENT_COLORS: Record<string, string> = {
  coordinator: 'var(--accent-blue)',
  prospection: '#8B5CF6',
  'cold-email': 'var(--accent-green)',
  content:     'var(--accent-yellow)',
  crm:         '#F97316',
  reporting:   'var(--accent-red)',
};

const ALL_AGENTS = ['coordinator', 'prospection', 'cold-email', 'content', 'crm', 'reporting'];

const STATUS_COLORS: Record<string, string> = {
  success: 'var(--accent-green)',
  error:   'var(--accent-red)',
  running: 'var(--accent-yellow)',
  pending: 'var(--text-muted)',
};

const DATE_PRESETS = [
  { label: "Aujourd'hui",    value: 'today'    },
  { label: '7 derniers j.',  value: '7d'       },
  { label: '30 derniers j.', value: '30d'      },
  { label: 'Tout',           value: 'all'      },
];

function filterByDate(actions: Action[], preset: string): Action[] {
  const now = new Date();
  const start = new Date(now);
  if (preset === 'today') { start.setHours(0, 0, 0, 0); }
  else if (preset === '7d') { start.setDate(start.getDate() - 7); }
  else if (preset === '30d') { start.setDate(start.getDate() - 30); }
  else return actions;
  return actions.filter(a => new Date(a.created_at) >= start);
}

/* ─── Timeline Entry ─────────────────────────────────────────── */
function TimelineEntry({ action, isLast }: { action: Action; isLast: boolean }) {
  const agentColor = AGENT_COLORS[action.agent] ?? 'var(--text-muted)';
  const statusColor = STATUS_COLORS[action.status] ?? 'var(--text-muted)';
  const ts = new Date(action.created_at);
  const timeStr = ts.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = ts.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });

  return (
    <div className="flex gap-4">
      {/* Timeline rail */}
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className="w-3 h-3 rounded-full border-2 mt-1 shrink-0 z-10"
          style={{ background: agentColor, borderColor: agentColor }} />
        {!isLast && <div className="flex-1 w-px mt-1" style={{ background: 'var(--border)' }} />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {/* Agent badge */}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: agentColor + '20', color: agentColor }}>
            {action.agent}
          </span>
          {/* Task */}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {action.task}
          </span>
          {/* Status */}
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: statusColor + '15', color: statusColor }}>
            {action.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timestamp */}
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {dateStr} {timeStr}
          </span>
          {/* Model */}
          {action.model && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.model}</span>
          )}
          {/* Duration */}
          {action.duration_ms != null && (
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              {action.duration_ms < 1000
                ? `${action.duration_ms}ms`
                : `${(action.duration_ms / 1000).toFixed(1)}s`}
            </span>
          )}
          {/* Cost */}
          {action.cost_eur != null && action.cost_eur > 0 && (
            <span className="text-xs font-mono" style={{ color: 'var(--accent-yellow)' }}>
              {action.cost_eur.toFixed(4)}€
            </span>
          )}
        </div>

        {/* Error */}
        {action.error && (
          <div className="mt-1.5 text-xs rounded px-2 py-1.5"
            style={{ background: 'var(--accent-red)15', color: 'var(--accent-red)' }}>
            {action.error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function HistoryPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [showFilterBar, setShowFilterBar] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.actions(500) as ActionsResponse;
      setActions(res.actions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const filtered = useMemo(() => {
    let list = actions;
    if (agentFilter !== 'all') list = list.filter(a => a.agent === agentFilter);
    list = filterByDate(list, dateFilter);
    return list;
  }, [actions, agentFilter, dateFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: Record<string, Action[]> = {};
    for (const a of filtered) {
      const day = new Date(a.created_at).toLocaleDateString('fr-BE', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      if (!groups[day]) groups[day] = [];
      groups[day].push(a);
    }
    return groups;
  }, [filtered]);

  const totalCost = useMemo(() =>
    filtered.reduce((s, a) => s + (a.cost_eur ?? 0), 0), [filtered]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Historique</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} actions
            {totalCost > 0 && ` · ${totalCost.toFixed(4)}€ total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilterBar(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{
              background: showFilterBar ? 'var(--accent-blue)20' : 'var(--bg-card)',
              color: showFilterBar ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderColor: showFilterBar ? 'var(--accent-blue)' : 'var(--border)',
            }}>
            <Filter size={14} />
            Filtres
          </button>
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilterBar && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Agent filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Agent</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAgentFilter('all')}
                className="text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: agentFilter === 'all' ? 'var(--accent-blue)' : 'var(--bg-hover)',
                  color: agentFilter === 'all' ? '#fff' : 'var(--text-muted)',
                }}>
                Tous
              </button>
              {ALL_AGENTS.map(agent => {
                const c = AGENT_COLORS[agent] ?? 'var(--text-muted)';
                const active = agentFilter === agent;
                return (
                  <button key={agent}
                    onClick={() => setAgentFilter(agent)}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      background: active ? c : 'var(--bg-hover)',
                      color: active ? '#fff' : 'var(--text-muted)',
                    }}>
                    {agent}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Période</span>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map(({ label, value }) => (
                <button key={value}
                  onClick={() => setDateFilter(value)}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: dateFilter === value ? 'var(--accent-blue)' : 'var(--bg-hover)',
                    color: dateFilter === value ? '#fff' : 'var(--text-muted)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {Object.keys(grouped).length === 0 && !loading && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucune action pour cette sélection
        </div>
      )}

      {Object.entries(grouped).map(([day, dayActions]) => (
        <div key={day} className="flex flex-col gap-0">
          {/* Day separator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-medium capitalize px-2" style={{ color: 'var(--text-muted)' }}>
              {day}
            </span>
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>

          {/* Entries */}
          {dayActions.map((a, i) => (
            <TimelineEntry key={a.id} action={a} isLast={i === dayActions.length - 1} />
          ))}
        </div>
      ))}
    </div>
  );
}
