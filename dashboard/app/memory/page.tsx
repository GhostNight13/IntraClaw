'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Brain, Clock, Archive, Play } from 'lucide-react';

const API = 'http://localhost:3001/api';

interface REMReport {
  exists: boolean;
  lastModified: string | null;
  recentCycles: string[];
  totalLength: number;
}

interface CompressedMemory {
  period?: string;
  summary?: string;
  score?: number;
  [key: string]: unknown;
}

interface REMHistory {
  memories: CompressedMemory[];
  total: number;
}

interface TriggerResult {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

export default function MemoryPage() {
  const [report, setReport] = useState<REMReport | null>(null);
  const [history, setHistory] = useState<REMHistory | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoadingReport(true);
    try {
      const [r, h] = await Promise.allSettled([
        fetch(`${API}/memory/rem/report`).then(res => res.json() as Promise<REMReport>),
        fetch(`${API}/memory/rem/history`).then(res => res.json() as Promise<REMHistory>),
      ]);
      if (r.status === 'fulfilled') setReport(r.value);
      if (h.status === 'fulfilled') setHistory(h.value);
      setLastRefresh(new Date());
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerREM = useCallback(async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch(`${API}/memory/rem`, { method: 'POST' });
      const data = await res.json() as TriggerResult;
      setTriggerResult(data);
      // Reload report after a short delay to pick up new HEARTBEAT.md content
      setTimeout(() => { void load(); }, 1500);
    } catch (err) {
      setTriggerResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTriggering(false);
    }
  }, [load]);

  const lastRun = report?.lastModified
    ? new Date(report.lastModified).toLocaleString('fr-BE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Jamais';

  // Next run: every night at 03:00
  const nextRun = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (d.getHours() >= 3 ? 1 : 0));
    d.setHours(3, 0, 0, 0);
    return d.toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={24} style={{ color: 'var(--accent-blue)' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Memory Dreaming
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Cycle REM — compression et consolidation de la memoire
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loadingReport
              ? 'Chargement...'
              : `Mis a jour ${lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <RefreshCw size={14} className={loadingReport ? 'animate-spin' : ''} />
            Rafraichir
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Last REM run */}
        <div className="rounded-xl p-5 border flex items-start gap-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Clock size={20} style={{ color: 'var(--accent-blue)', marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Dernier cycle REM
            </p>
            <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{lastRun}</p>
          </div>
        </div>

        {/* Compressed weeks */}
        <div className="rounded-xl p-5 border flex items-start gap-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Archive size={20} style={{ color: 'var(--accent-green)', marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Semaines compressees
            </p>
            <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              {history ? history.total : '—'}
            </p>
          </div>
        </div>

        {/* Next run */}
        <div className="rounded-xl p-5 border flex items-start gap-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Brain size={20} style={{ color: 'var(--accent-yellow)', marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Prochain cycle
            </p>
            <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              {nextRun} (03:00 chaque nuit)
            </p>
          </div>
        </div>
      </div>

      {/* Trigger button */}
      <div className="rounded-xl p-5 border flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Declencher un cycle REM maintenant
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Compresse et consolide les memories recentes. Peut prendre 30-60 secondes.
            </p>
          </div>
          <button
            onClick={() => void triggerREM()}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}
          >
            <Play size={14} className={triggering ? 'animate-pulse' : ''} />
            {triggering ? 'REM en cours...' : 'Trigger REM Now'}
          </button>
        </div>

        {triggerResult && (
          <div className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all"
            style={{
              background: triggerResult.error ? 'var(--accent-red)15' : 'var(--accent-green)15',
              color: triggerResult.error ? 'var(--accent-red)' : 'var(--accent-green)',
              border: `1px solid ${triggerResult.error ? 'var(--accent-red)' : 'var(--accent-green)'}30`,
            }}>
            {JSON.stringify(triggerResult, null, 2)}
          </div>
        )}
      </div>

      {/* Recent cycles */}
      <div className="rounded-xl border flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Cycles recents (HEARTBEAT.md)
          </span>
        </div>
        <div className="p-5">
          {loadingReport && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              Chargement...
            </p>
          )}
          {!loadingReport && (!report?.exists || !report.recentCycles?.length) && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              Aucun cycle REM trouve dans HEARTBEAT.md. Declenchez un premier cycle ci-dessus.
            </p>
          )}
          {!loadingReport && report?.recentCycles?.map((section, i) => (
            <pre key={i}
              className="rounded-lg p-4 mb-3 last:mb-0 text-xs whitespace-pre-wrap break-words overflow-auto max-h-64"
              style={{
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}>
              {section.trim()}
            </pre>
          ))}
        </div>
      </div>

      {/* Compressed memory history */}
      <div className="rounded-xl border flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Historique memoire compressee
            {history && history.total > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: 'var(--accent-blue)20', color: 'var(--accent-blue)' }}>
                {history.total} entrees
              </span>
            )}
          </span>
        </div>

        {(!history || history.total === 0) ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucune memoire compressee trouvee. Les donnees apparaissent apres le premier cycle REM.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Periode', 'Resume', 'Score'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.memories.map((mem, i) => {
                  const scorePct = mem.score != null
                    ? typeof mem.score === 'number' && mem.score <= 1
                      ? Math.round(mem.score * 100)
                      : Math.round(mem.score as number)
                    : null;
                  const scoreColor = scorePct == null ? 'var(--text-muted)'
                    : scorePct >= 80 ? 'var(--accent-green)'
                    : scorePct >= 50 ? 'var(--accent-yellow)'
                    : 'var(--accent-red)';
                  return (
                    <tr key={i} style={{ borderBottom: i < history.memories.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap"
                        style={{ color: 'var(--text-muted)' }}>
                        {mem.period ?? `Entree ${i + 1}`}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-primary)', maxWidth: 480 }}>
                        <span className="line-clamp-2">{mem.summary ?? JSON.stringify(mem)}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap font-semibold"
                        style={{ color: scoreColor }}>
                        {scorePct != null ? `${scorePct}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
