'use client';
import { useProtectedRoute } from '../hooks/useProtectedRoute';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { session, loading } = useProtectedRoute();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex items-center gap-3 text-white/50">
          <div className="w-5 h-5 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!session) return null; // Redirect happening

  return <>{children}</>;
}
