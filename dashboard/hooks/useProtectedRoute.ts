'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect to /auth/login if not authenticated.
 * Use in any page that requires auth.
 */
export function useProtectedRoute() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/auth/login');
    }
  }, [session, status, router]);

  return { session, loading: status === 'loading' };
}
