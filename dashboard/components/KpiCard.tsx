import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'muted';
  progress?: number; // 0-100
}

const ACCENT_COLORS = {
  blue:   'var(--accent-blue)',
  green:  'var(--accent-green)',
  yellow: 'var(--accent-yellow)',
  red:    'var(--accent-red)',
  muted:  'var(--text-muted)',
};

export function KpiCard({ label, value, sub, accent = 'blue', progress }: KpiCardProps) {
  const color = ACCENT_COLORS[accent];

  return (
    <div className="rounded-xl p-5 flex flex-col gap-2 border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-3xl font-bold" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</span>
      )}
      {progress !== undefined && (
        <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progress)}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
