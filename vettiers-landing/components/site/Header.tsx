"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { posthog } from "@/app/providers";

export function Header() {
  return (
    <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)] font-bold text-slate-950">
            V
          </span>
          <span className="font-semibold tracking-tight text-[var(--color-text)] group-hover:text-[var(--color-brand)] transition-colors">
            VetTiers
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--color-text-muted)]">
          <a href="#problem" className="hover:text-[var(--color-text)] transition-colors">Problem</a>
          <a href="#how" className="hover:text-[var(--color-text)] transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-[var(--color-text)] transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-[var(--color-text)] transition-colors">FAQ</a>
        </nav>

        <Button
          asChild
          size="sm"
          onClick={() => posthog?.capture?.("cta_click", { location: "header" })}
        >
          <a href="#waitlist">Join Waitlist</a>
        </Button>
      </div>
    </header>
  );
}
