'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Bot, KanbanSquare, History,
  MessageSquare, Settings, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/',               icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/agents',         icon: Bot,             label: 'Agents'        },
  { href: '/pipeline',       icon: KanbanSquare,    label: 'Pipeline'      },
  { href: '/history',        icon: History,         label: 'Historique'    },
  { href: '/chat',           icon: MessageSquare,   label: 'Chat'          },
  { href: '/settings',       icon: Settings,        label: 'Paramètres'    },
  { href: '/notifications',  icon: Bell,            label: 'Notifications' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group flex flex-col w-16 hover:w-52 transition-all duration-200 shrink-0 h-screen sticky top-0 border-r"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xl shrink-0">🐾</span>
        <span className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 font-semibold text-sm"
          style={{ color: 'var(--text-primary)' }}>
          IntraClaw
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 group/item',
                active
                  ? 'text-white'
                  : 'hover:text-white'
              )}
              style={{
                background:  active ? 'var(--accent-blue)' : undefined,
                color:       active ? '#fff' : 'var(--text-muted)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = '';
              }}
            >
              <Icon size={18} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm font-medium">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Live indicator */}
      <div className="flex items-center gap-3 px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--accent-green)' }} />
        <span className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-xs"
          style={{ color: 'var(--accent-green)' }}>
          Live
        </span>
      </div>
    </aside>
  );
}
