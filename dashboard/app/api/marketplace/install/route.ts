import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await serverApiFetch<{ ok: boolean }>('/api/marketplace/install', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
