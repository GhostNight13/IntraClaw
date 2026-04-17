import { NextResponse } from "next/server";

export const runtime = "edge";

interface WaitlistPayload {
  email?: string;
  name?: string;
  clinic?: string;
  role?: string;
  size?: string;
  pims?: string;
  state?: string;
  interview?: "yes" | "maybe" | "no" | "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  let payload: WaitlistPayload;
  try {
    payload = (await req.json()) as WaitlistPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Minimal validation — client also validates, but never trust the client.
  const required: (keyof WaitlistPayload)[] = [
    "email",
    "name",
    "clinic",
    "role",
    "size",
    "pims",
    "state",
    "interview",
  ];
  for (const k of required) {
    if (!payload[k] || String(payload[k]).trim() === "") {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }
  if (!EMAIL_RE.test(payload.email ?? "")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const webhook = process.env.TALLY_WEBHOOK_URL;

  // No webhook configured: accept the submission so dev/preview works,
  // and log it for the operator to pick up in Vercel logs.
  if (!webhook) {
    console.info("[waitlist] (no TALLY_WEBHOOK_URL set) submission:", {
      email: payload.email,
      clinic: payload.clinic,
      role: payload.role,
      state: payload.state,
    });
    return NextResponse.json({ ok: true, delivered: false }, { status: 202 });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "vettiers-landing",
        submittedAt: new Date().toISOString(),
        ...payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[waitlist] webhook rejected:", res.status, text);
      return NextResponse.json(
        { error: "Submission failed — please email hello@vettiers.com" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, delivered: true }, { status: 200 });
  } catch (err) {
    console.error("[waitlist] webhook threw:", err);
    return NextResponse.json(
      { error: "Network error — please try again in a moment" },
      { status: 502 },
    );
  }
}
