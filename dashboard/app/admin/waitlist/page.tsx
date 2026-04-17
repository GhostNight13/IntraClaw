'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, Mail } from 'lucide-react';

interface WaitlistEntry {
  id:         number;
  email:      string;
  source:     string;
  created_at: string;
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/waitlist', { cache: 'no-store' });
      if (res.status === 403) throw new Error('Forbidden — admin role required');
      if (res.status === 401) throw new Error('Please log in');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { entries: WaitlistEntry[] };
      setEntries(json.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const header = 'id,email,source,created_at';
    const rows   = entries.map(e => `${e.id},"${e.email}","${e.source}","${e.created_at}"`);
    const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={24} /> Beta Waitlist
          </h1>
          <p style={{ color: 'var(--text-muted, #888)', marginTop: 4 }}>
            {entries.length} signup{entries.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #333',
              background: 'transparent', color: 'inherit', cursor: 'pointer',
              opacity: entries.length === 0 ? 0.4 : 1,
            }}
          >
            Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1px solid #333',
              background: 'transparent', color: 'inherit', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: '#dc262622', color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted, #888)' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
          No waitlist signups yet.
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ background: '#1a1a1a' }}>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Source</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid #222' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted, #888)' }}>{e.id}</td>
                  <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={13} /> {e.email}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: '#1f2937', color: '#cbd5e1',
                    }}>
                      {e.source}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted, #888)' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
