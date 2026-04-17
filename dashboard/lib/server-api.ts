/**
 * Server-side API fetcher — uses next-auth session from server components.
 * Use this in Server Components and API routes.
 * Use lib/api.ts for Client Components.
 */
import { auth } from '../auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await auth();
  const token = (session as any)?.token;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Server API ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
