import { auth } from './auth';
import { NextResponse } from 'next/server';

// Public routes accessible without authentication.
const PUBLIC_PATHS = new Set<string>(['/']);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith('/auth');
  const isApiRoute = pathname.startsWith('/api');
  const isPublic = PUBLIC_PATHS.has(pathname);
  const isOnboarding = pathname.startsWith('/onboarding');

  // Allow API routes, auth pages, and explicitly public pages
  if (isApiRoute || isAuthPage || isPublic) return NextResponse.next();

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.nextUrl));
  }

  // Onboarding gate — redirect to wizard if profile not completed
  const userId = req.auth?.user?.id;
  if (userId && !isOnboarding) {
    try {
      const res = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { 'x-user-id': userId },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { onboarded?: boolean };
        if (!data.onboarded) {
          return NextResponse.redirect(new URL('/onboarding', req.nextUrl));
        }
      }
    } catch {
      // Backend unreachable — let the request through silently.
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
