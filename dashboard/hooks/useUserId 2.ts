'use client';
import { useSession } from 'next-auth/react';

/**
 * Returns the current user's ID from session.
 * Falls back to 'default' in single-user mode.
 */
export function useUserId(): string {
  const { data: session } = useSession();
  return session?.user?.id ?? 'default';
}
