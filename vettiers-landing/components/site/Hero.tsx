"use client";

import { Button } from "@/components/ui/button";
import { posthog } from "@/app/providers";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden noise-bg">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-20 md:pt-32 md:pb-28 text-center">
        <div className="fade-in-up inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-4 py-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
          Now onboarding founding clinics · US beta
        </div>

        <h1 className="fade-in-up mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-[var(--color-text)] leading-[1.05]">
          73% of clients who declined care
          <br className="hidden md:block" />
          <span className="text-[var(--color-brand)]"> were never shown an alternative.</span>
        </h1>

        <p className="fade-in-up mx-auto mt-6 max-w-2xl text-lg md:text-xl text-[var(--color-text-muted)] leading-relaxed">
          VetTiers helps your clinic present <strong className="text-[var(--color-text)]">Good / Better / Best</strong> treatment plans with built-in financing — so clients say yes instead of &quot;let me think about it.&quot;
        </p>

        <div className="fade-in-up mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            onClick={() => posthog?.capture?.("cta_click", { location: "hero_primary" })}
          >
            <a href="#waitlist">
              Join the Waitlist — Free
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="secondary"
            size="lg"
            onClick={() => posthog?.capture?.("cta_click", { location: "hero_secondary" })}
          >
            <a href="#how">See how it works</a>
          </Button>
        </div>

        <p className="fade-in-up mt-5 flex items-center justify-center gap-2 text-xs text-[var(--color-text-dim)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Early-access pricing locked for founding clinics. No credit card.
        </p>
      </div>

      {/* decorative gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)]/40 to-transparent"
      />
    </section>
  );
}
