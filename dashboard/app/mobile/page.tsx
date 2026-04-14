'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, type StatusResponse, type ActionsResponse, type Action } from '@/lib/api';

/* ─── Types ──────────────────────────────────────────────────────── */
interface PageState {
  status: StatusResponse | null;
  actions: Action[];
  loading: boolean;
  error: string | null;
  triggering: string | null;
}

/* ─── Quick action button ─────────────────────────────────────────── */
function ActionButton({
  label,
  icon,
  href,
  onClick,
  accent,
  disabled,
}: {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  accent?: string;
  disabled?: boolean;
}) {
  const style = {
    background: 'var(--bg-card)',
    border: `1px solid ${accent ?? 'var(--border)'}`,
    color: accent ?? 'var(--text-primary)',
  };

  const inner = (
    <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl h-24 w-full transition-opacity"
      style={{ ...style, opacity: disabled ? 0.5 : 1 }}>
      <span className="text-3xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className="w-full">
      {inner}
    </button>
  );
}

/* ─── Agent status pill ───────────────────────────────────────────── */
function AgentPill({ paused, jobCount }: { paused: boolean; jobCount: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: paused ? 'var(--accent-red)20' : 'var(--accent-green)20',
        color: paused ? 'var(--accent-red)' : 'var(--accent-green)',
        border: `1px solid ${paused ? 'var(--accent-red)40' : 'var(--accent-green)40'}`,
      }}>
      <span className="w-2 h-2 rounded-full"
        style={{ background: paused ? 'var(--accent-red)' : 'var(--accent-green)' }} />
      {paused ? 'Scheduler paused' : `${jobCount} agent${jobCount !== 1 ? 's' : ''} active`}
    </div>
  );
}

/* ─── Activity item ───────────────────────────────────────────────── */
function ActivityItem({ action }: { action: Action }) {
  const statusColor = {
    running: 'var(--accent-yellow)',
    success: 'var(--accent-green)',
    error:   'var(--accent-red)',
  }[action.status];

  const time = new Date(action.created_at).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}>
      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: statusColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{action.task}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {action.agent} · {time}
        </p>
      </div>
      {action.cost_eur != null && (
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          €{action.cost_eur.toFixed(3)}
        </span>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function MobilePage() {
  const [state, setState] = useState<PageState>({
    status: null,
    actions: [],
    loading: true,
    error: null,
    triggering: null,
  });

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [statusRes, actionsRes] = await Promise.allSettled([
        api.status(),
        api.actions(5),
      ]);

      setState(s => ({
        ...s,
        loading: false,
        status:  statusRes.status  === 'fulfilled' ? statusRes.value  : null,
        actions: (actionsRes.status === 'fulfilled' ? (actionsRes.value as ActionsResponse).actions : []),
        error:   statusRes.status  === 'rejected'  ? 'Server offline — showing cached data' : null,
      }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Unable to reach IntraClaw server' }));
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function runAgent(task: string) {
    setState(s => ({ ...s, triggering: task }));
    try {
      await api.triggerAgent(task);
    } catch {
      /* graceful — server may be offline */
    } finally {
      setState(s => ({ ...s, triggering: null }));
      void fetchData();
    }
  }

  const { status, actions, loading, error, triggering } = state;
  const budget = status?.budget;
  const scheduler = status?.scheduler;

  return (
    <div className="min-h-screen px-4 pt-6 pb-24" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            IntraClaw
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Quick actions
          </p>
        </div>
        {scheduler && (
          <AgentPill
            paused={scheduler.paused}
            jobCount={scheduler.jobs.filter(j => j.enabled).length}
          />
        )}
        {loading && !status && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
          style={{ background: 'var(--accent-red)15', borderColor: 'var(--accent-red)40', color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {/* Budget card */}
      {budget && (
        <div className="mb-6 p-4 rounded-2xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Monthly Budget
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {budget.callCount} calls
            </span>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              €{budget.spentEur.toFixed(2)}
            </span>
            <span className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
              / €{budget.budgetEur.toFixed(0)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (budget.spentEur / budget.budgetEur) * 100).toFixed(1)}%`,
                background: budget.remainingEur < 2
                  ? 'var(--accent-red)'
                  : budget.remainingEur < 5
                  ? 'var(--accent-yellow)'
                  : 'var(--accent-green)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            €{budget.remainingEur.toFixed(2)} remaining
          </p>
        </div>
      )}

      {/* Quick actions grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ActionButton label="Quick Chat" icon="💬" href="/chat" accent="var(--accent-blue)" />
        <ActionButton
          label="Run Agent"
          icon="🤖"
          accent="var(--accent-green)"
          disabled={!!triggering}
          onClick={() => { void runAgent('prospecting'); }}
        />
        <ActionButton label="View Pipeline" icon="⚡" href="/pipeline" accent="var(--accent-yellow)" />
        <ActionButton label="Check Budget" icon="💰" href="/billing" accent="var(--accent-red)" />
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Recent Activity
          </h2>
          <button
            onClick={() => { void fetchData(); }}
            className="text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--accent-blue)', background: 'var(--accent-blue)15' }}
          >
            Refresh
          </button>
        </div>

        {loading && actions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Loading activity…
          </p>
        ) : actions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            No recent activity
          </p>
        ) : (
          <div>
            {actions.map(a => <ActivityItem key={a.id} action={a} />)}
          </div>
        )}
      </div>

      {/* Triggering overlay */}
      {triggering && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="px-6 py-4 rounded-2xl text-sm border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            Triggering {triggering}…
          </div>
        </div>
      )}
    </div>
  );
}
