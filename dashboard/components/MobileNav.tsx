'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',         label: 'Home',   icon: '🏠' },
  { href: '/chat',     label: 'Chat',   icon: '💬' },
  { href: '/agents',   label: 'Agents', icon: '🤖' },
  { href: '/pipeline', label: 'Tasks',  icon: '⚡' },
  { href: '/settings', label: 'More',   icon: '⚙️' },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-3 py-2 text-xs rounded-lg transition-colors"
            style={{
              color: pathname === item.href ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
