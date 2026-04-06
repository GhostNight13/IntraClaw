'use client';

import { useEffect, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { api, StatusResponse } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────────── */
interface Job {
  name: string;
  cron: string;
  task: string;
  enabled: boolean;
  lastRunAt?: string;
}

interface Toast { message: string; type: 'success' | 'error' }

/* ─── Slider ─────────────────────────────────────────────────── */
function RangeSlider({
  label, value, max, color, unit = '',
}: { label: string; value: number; max: number; color: string; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-sm font-mono" style={{ color }}>
          {value}{unit} / {max}{unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-hover)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {pct.toFixed(0)}% utilisé
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{max}</span>
      </div>
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.status();
      setStatus(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  async function handlePause() {
    setActionPending('pause');
    try {
      await api.schedulerPause();
      showToast('Scheduler mis en pause', 'success');
      await load();
    } catch {
      showToast('Erreur lors de la mise en pause', 'error');
    } finally {
      setActionPending(null);
    }
  }

  async function handleResume() {
    setActionPending('resume');
    try {
      await api.schedulerResume();
      showToast('Scheduler relancé', 'success');
      await load();
    } catch {
      showToast('Erreur lors de la reprise', 'error');
    } finally {
      setActionPending(null);
    }
  }

  async function handleTrigger(task: string) {
    setActionPending(`trigger-${task}`);
    try {
      await api.triggerAgent(task);
      showToast(`Tâche "${task}" déclenchée`, 'success');
    } catch {
      showToast(`Erreur déclenchement "${task}"`, 'error');
    } finally {
      setActionPending(null);
    }
  }

  const isPaused = status?.scheduler?.paused ?? false;
  const jobs: Job[] = (status?.scheduler?.jobs ?? []) as Job[];
  const rateLimits = status?.rateLimits;
  const budget = status?.budget;
  const budgetPct = budget ? (budget.spentEur / budget.budgetEur) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Paramètres</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Contrôle du système en temps réel</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{
            background: toast.type === 'success' ? 'var(--accent-green)20' : 'var(--accent-red)20',
            color: toast.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
            border: `1px solid ${toast.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}40`,
          }}>
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* 1 — Scheduler */}
      <Section title="Scheduler">
        <div className="flex flex-col gap-4">
          {/* Status + controls */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg"
            style={{ background: 'var(--bg-hover)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full"
                style={{ background: isPaused ? 'var(--accent-red)' : 'var(--accent-green)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Scheduler {isPaused ? 'en pause' : 'actif'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePause}
                disabled={isPaused || actionPending !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                style={{
                  background: 'transparent',
                  color: isPaused ? 'var(--text-muted)' : 'var(--accent-yellow)',
                  borderColor: isPaused ? 'var(--border)' : 'var(--accent-yellow)40',
                  opacity: isPaused ? 0.5 : 1,
                }}>
                <Pause size={12} />
                Pause
              </button>
              <button
                onClick={handleResume}
                disabled={!isPaused || actionPending !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                style={{
                  background: !isPaused ? 'transparent' : 'var(--accent-green)20',
                  color: !isPaused ? 'var(--text-muted)' : 'var(--accent-green)',
                  borderColor: !isPaused ? 'var(--border)' : 'var(--accent-green)40',
                  opacity: !isPaused ? 0.5 : 1,
                }}>
                <Play size={12} />
                Reprendre
              </button>
            </div>
          </div>

          {/* Jobs list */}
          {jobs.length === 0 && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Aucun job enregistré (serveur hors ligne ?)
            </div>
          )}
          {jobs.map(job => {
            const isPending = actionPending === `trigger-${job.task}`;
            return (
              <div key={job.name} className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: job.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {job.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 ml-3.5">
                    <span className="text-xs font-mono" style={{ color: 'var(--accent-blue)' }}>
                      {job.cron}
                    </span>
                    {job.lastRunAt && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Dernier: {new Date(job.lastRunAt).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleTrigger(job.task)}
                  disabled={isPending || actionPending !== null}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border shrink-0 transition-colors"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={e => { if (!isPending) { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)40'; }}}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  {isPending ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                  Déclencher
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 2 — Rate Limits */}
      <Section title="Rate Limits">
        {!rateLimits ? (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Chargement…
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <RangeSlider
              label="Claude API"
              value={rateLimits.claude.count}
              max={rateLimits.claude.max}
              color="var(--accent-blue)"
              unit=" appels"
            />
            <RangeSlider
              label="Gmail"
              value={rateLimits.gmail.count}
              max={rateLimits.gmail.max}
              color="var(--accent-green)"
              unit=" emails"
            />
            <RangeSlider
              label="Scraping"
              value={rateLimits.scraping.count}
              max={rateLimits.scraping.max}
              color="#8B5CF6"
              unit=" requêtes"
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Les compteurs se réinitialisent à minuit (Europe/Brussels).
            </p>
          </div>
        )}
      </Section>

      {/* 3 — Budget IA */}
      <Section title="Budget IA">
        {!budget ? (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Chargement…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Big number */}
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold"
                style={{ color: budgetPct > 85 ? 'var(--accent-red)' : budgetPct > 60 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                {budget.spentEur.toFixed(4)}€
              </span>
              <span className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                / {budget.budgetEur.toFixed(2)}€ limite jour
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Consommé aujourd&apos;hui</span>
                <span className="text-xs font-mono"
                  style={{ color: budgetPct > 85 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                  {budgetPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, budgetPct)}%`,
                    background: budgetPct > 85 ? 'var(--accent-red)'
                      : budgetPct > 60 ? 'var(--accent-yellow)'
                      : 'var(--accent-green)',
                  }} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Restant</span>
                <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--accent-green)' }}>
                  {budget.remainingEur.toFixed(4)}€
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Appels IA</span>
                <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--accent-blue)' }}>
                  {budget.callCount}
                </p>
              </div>
            </div>

            {budgetPct > 85 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--accent-red)15', color: 'var(--accent-red)', border: '1px solid var(--accent-red)30' }}>
                <AlertCircle size={14} />
                Budget &gt; 85% — nouvelles actions Claude bloquées
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Uptime */}
      {status && (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Serveur actif depuis {Math.floor(status.uptime / 3600)}h{String(Math.floor((status.uptime % 3600) / 60)).padStart(2, '0')}m
          &nbsp;·&nbsp;
          {new Date(status.timestamp).toLocaleString('fr-BE')}
        </p>
      )}
    </div>
  );
}
