import { NextRequest, NextResponse } from 'next/server';
import { addWaitlistEmail } from '@/lib/waitlist-db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  const _source = typeof body.source === 'string' ? body.source : 'landing';
  void _source; // accepted for future use; addWaitlistEmail signature kept stable

  const result = addWaitlistEmail(email);
  if (!result.ok) {
    const status = result.error === 'Email already on waitlist' ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
