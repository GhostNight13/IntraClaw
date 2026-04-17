"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { posthog } from "@/app/providers";

const included = [
  "Unlimited treatment plans",
  "Good / Better / Best tier generation",
  "Cherry & CareCredit financing inline",
  "PIMS sync (Cornerstone, ezyVet, AVImark)",
  "SMS & email delivery",
  "E-signature + audit trail",
  "Team training + white-glove onboarding",
] as const;

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 border-t border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">Founding pricing</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          One flat price. Locked for 24 months.
        </h2>
        <p className="mt-4 text-[var(--color-text-muted)] leading-relaxed">
          We&apos;re onboarding the first 50 clinics at a founding rate. Pricing increases after public launch — you keep yours.
        </p>

        <div className="mt-12 rounded-3xl border border-[var(--color-brand)]/40 bg-[var(--color-surface)] p-10 text-left shadow-[0_40px_80px_-30px_rgba(16,185,129,0.35)]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--color-brand)]">Beta · founding clinic</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-semibold tracking-tight text-[var(--color-text)]">$149</span>
                <span className="text-[var(--color-text-muted)]">/ month, per clinic</span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Price locked 24 months · First 50 clinics only · Cancel anytime during beta.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              onClick={() => posthog?.capture?.("cta_click", { location: "pricing" })}
            >
              <a href="#waitlist">Lock my founding price</a>
            </Button>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-brand)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
