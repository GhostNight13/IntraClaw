import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api';

export async function GET() {
  try {
    const data = await serverApiFetch<{ skills: unknown[] }>('/api/marketplace/generic');
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
