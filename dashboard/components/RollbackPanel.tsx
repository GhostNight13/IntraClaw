'use client';
import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, RefreshCw, Clock, FileCode2 } from 'lucide-react';

const BASE = 'http://localhost:3001';

interface Snapshot {
  id: string;
  file_path: string;
  content: string;
  created_at: string;
}

interface RollbackPanelProps {
  filePath?: string;
  onRollback?: (snapshotId: string, content: string) => void;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function RollbackPanel({ filePath = '', onRollback }: RollbackPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filePath
        ? `${BASE}/api/code/snapshots?path=${encodeURIComponent(filePath)}`
        : `${BASE}/api/code/snapshots`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Snapshot[];
      setSnapshots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  async function handleRollback(snap: Snapshot) {
    setRollingBack(snap.id);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/code/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: snap.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onRollback?.(snap.id, snap.content);
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Clock className="w-4 h-4" />
          <span>
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            {filePath ? ` for ${filePath}` : ''}
          </span>
        </div>
        <button
          onClick={() => void loadSnapshots()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && snapshots.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && snapshots.length === 0 && !error && (
        <div className="text-center py-10 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
          No snapshots yet
        </div>
      )}

      {/* Snapshot list */}
      {snapshots.map(snap => (
        <div
          key={snap.id}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-white text-sm font-mono truncate">{snap.file_path}</span>
              </div>
              <div className="text-xs text-zinc-500 flex gap-2">
                <span>{relativeTime(snap.created_at)}</span>
                <span className="text-zinc-700">·</span>
                <span className="font-mono text-zinc-600">{snap.id.slice(0, 8)}</span>
              </div>
              {snap.content && (
                <p className="text-xs text-zinc-500 font-mono truncate mt-1">
                  {snap.content.slice(0, 100)}
                  {snap.content.length > 100 ? '…' : ''}
                </p>
              )}
            </div>
            <button
              onClick={() => void handleRollback(snap)}
              disabled={rollingBack === snap.id}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 bg-zinc-800 hover:bg-orange-900/60 hover:text-orange-300 border border-zinc-700 hover:border-orange-700 disabled:opacity-40 transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${rollingBack === snap.id ? 'animate-spin' : ''}`} />
              {rollingBack === snap.id ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
