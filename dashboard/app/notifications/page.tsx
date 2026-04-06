'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, CheckCheck, Info, AlertTriangle, XCircle, Bell } from 'lucide-react';
import { api, Notification, NotificationsResponse } from '@/lib/api';

/* ─── Config ─────────────────────────────────────────────────── */
type NotifType = 'info' | 'warn' | 'error';

const TYPE_CONFIG: Record<NotifType, { label: string; color: string; Icon: React.ElementType }> = {
  info:  { label: 'Info',    color: 'var(--accent-blue)',   Icon: Info          },
  warn:  { label: 'Warning', color: 'var(--accent-yellow)', Icon: AlertTriangle },
  error: { label: 'Erreur',  color: 'var(--accent-red)',    Icon: XCircle       },
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Toutes',  value: 'all'   },
  { label: 'Info',    value: 'info'  },
  { label: 'Warning', value: 'warn'  },
  { label: 'Erreur',  value: 'error' },
  { label: 'Non lues', value: 'unread' },
];

/* ─── Notification Row ───────────────────────────────────────── */
function NotifRow({ notif }: { notif: Notification }) {
  const type = notif.type as NotifType;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const Icon = cfg.Icon;
  const isUnread = !notif.read;
  const ts = new Date(notif.created_at).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b last:border-0 transition-colors"
      style={{
        borderColor: 'var(--border)',
        background: isUnread ? cfg.color + '08' : 'transparent',
      }}>
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.color + '15' }}>
        <Icon size={15} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-snug"
            style={{ color: isUnread ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isUnread ? 500 : 400 }}>
            {notif.message}
          </p>
          {isUnread && (
            <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: cfg.color }} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: cfg.color + '15', color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ts}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [markingRead, setMarkingRead] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications() as NotificationsResponse;
      setNotifications(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  async function markAllRead() {
    setMarkingRead(true);
    try {
      await api.markRead();
      await load();
    } catch {
      /* ignore */
    } finally {
      setMarkingRead(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  // Count per type
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifications.length, unread };
    for (const n of notifications) {
      c[n.type] = (c[n.type] ?? 0) + 1;
    }
    return c;
  }, [notifications, unread]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {notifications.length} total
              {unread > 0 && ` · ${unread} non lues`}
            </p>
          </div>
          {unread > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-full"
              style={{ background: 'var(--accent-red)', color: '#fff' }}>
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors"
              style={{
                background: 'var(--accent-green)15',
                color: 'var(--accent-green)',
                borderColor: 'var(--accent-green)40',
              }}>
              {markingRead
                ? <RefreshCw size={12} className="animate-spin" />
                : <CheckCheck size={12} />}
              Tout lire
            </button>
          )}
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => {
          const count = counts[value] ?? 0;
          const active = filter === value;
          let accentColor = 'var(--accent-blue)';
          if (value === 'warn')  accentColor = 'var(--accent-yellow)';
          if (value === 'error') accentColor = 'var(--accent-red)';
          if (value === 'unread') accentColor = 'var(--accent-green)';

          return (
            <button key={value}
              onClick={() => setFilter(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors"
              style={{
                background: active ? accentColor + '20' : 'var(--bg-card)',
                color: active ? accentColor : 'var(--text-muted)',
                borderColor: active ? accentColor + '60' : 'var(--border)',
              }}>
              {label}
              {count > 0 && (
                <span className="font-mono">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
          </div>
        )}
        {loading && filtered.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
        {filtered.map(n => (
          <NotifRow key={n.id} notif={n} />
        ))}
      </div>
    </div>
  );
}
