import { cn } from '@/lib/utils';

type Status = 'active' | 'idle' | 'error';

interface AgentStatusBadgeProps {
  name: string;
  status: Status;
  lastAction?: string;
  actionsToday?: number;
}

const STATUS_COLORS: Record<Status, string> = {
  active: 'var(--accent-green)',
  idle:   'var(--text-muted)',
  error:  'var(--accent-red)',
};

const STATUS_LABELS: Record<Status, string> = {
  active: 'actif',
  idle:   'idle',
  error:  'erreur',
};

export function AgentStatusBadge({ name, status, lastAction, actionsToday }: AgentStatusBadgeProps) {
  const color = STATUS_COLORS[status];

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border"
      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {name}
          </span>
          <span className="text-xs shrink-0" style={{ color }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {lastAction && (
          <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }}>
            {lastAction}
          </span>
        )}
        {actionsToday !== undefined && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {actionsToday} action{actionsToday !== 1 ? 's' : ''} aujourd&apos;hui
          </span>
        )}
      </div>
    </div>
  );
}
