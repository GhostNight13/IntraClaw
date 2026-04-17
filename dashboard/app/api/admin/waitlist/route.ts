import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await serverApiFetch<{ entries: unknown[] }>('/api/marketplace/waitlist');
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('403') ? 403 : msg.includes('401') ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
