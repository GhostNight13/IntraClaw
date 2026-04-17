'use client';
import { useSession, signOut } from 'next-auth/react';

export function UserMenu() {
  const { data: session } = useSession();
  if (!session) return null;

  const initials = session.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  return (
    <div className="flex items-center gap-2 px-3 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {initials}
      </div>

      {/* Name + sign out — visible when sidebar is expanded */}
      <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-between flex-1 min-w-0">
        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
          {session.user?.name ?? session.user?.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="ml-2 text-xs shrink-0 transition-colors hover:text-white"
          style={{ color: 'var(--text-muted)' }}
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
