'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Mail, PenSquare, FileText, Mic, Calendar, Sparkles, RefreshCw,
} from 'lucide-react';

interface SkillCard {
  id:          string;
  name:        string;
  description: string;
  icon:        string | null;
  tier:        'free' | 'pro' | 'agency';
  requires:    string[];
  installed:   boolean;
  enabled:     boolean;
  config:      Record<string, unknown>;
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Mail, PenSquare, FileText, Mic, Calendar,
};

const TIER_BADGE: Record<SkillCard['tier'], { bg: string; fg: string; label: string }> = {
  free:   { bg: '#16a34a22', fg: '#16a34a', label: 'FREE' },
  pro:    { bg: '#3b82f622', fg: '#3b82f6', label: 'PRO' },
  agency: { bg: '#a855f722', fg: '#a855f7', label: 'AGENCY' },
};

export default function MarketplacePage() {
  const [skills, setSkills]   = useState<SkillCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketplace/skills', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { skills: SkillCard[] };
      setSkills(json.skills ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleInstall = async (skill: SkillCard) => {
    setBusyId(skill.id);
    try {
      const path = skill.installed ? '/api/marketplace/uninstall' : '/api/marketplace/install';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, config: skill.config }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={26} /> Skills Marketplace
          </h1>
          <p style={{ color: 'var(--text-muted, #888)', marginTop: 4 }}>
            Install ready-made skills to expand your IntraClaw agent.
          </p>
        </div>
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
      </header>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: '#dc262622', color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted, #888)' }}>Loading…</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {skills.map((s) => {
            const Icon: React.ComponentType<{ size?: number }> =
              (s.icon ? ICONS[s.icon] : undefined) ?? Sparkles;
            const badge = TIER_BADGE[s.tier];
            const busy = busyId === s.id;
            return (
              <article
                key={s.id}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  border: '1px solid #2a2a2a',
                  background: 'var(--card-bg, #111)',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: '#1f2937', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} />
                  </div>
                  <span style={{
                    background: badge.bg, color: badge.fg,
                    fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, letterSpacing: 0.5,
                  }}>
                    {badge.label}
                  </span>
                </header>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #888)', marginTop: 4, lineHeight: 1.4 }}>
                    {s.description}
                  </p>
                </div>

                {s.requires.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.requires.map((r) => (
                      <span key={r} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: '#334155', color: '#cbd5e1',
                      }}>
                        requires: {r}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => void toggleInstall(s)}
                  disabled={busy}
                  style={{
                    marginTop: 'auto',
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer',
                    background: s.installed ? '#dc2626' : '#16a34a',
                    color: '#fff',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? '…' : s.installed ? 'Uninstall' : 'Install'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
