import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ onboarded: false }, { status: 401 });
  }
  const res = await fetch(`${API_URL}/api/onboarding/status`, {
    headers: { 'x-user-id': session.user.id },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ onboarded: false }));
  return NextResponse.json(data, { status: res.status });
}
