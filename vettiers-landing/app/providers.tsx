"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

function initPostHog(): void {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest", // reverse-proxied via next.config.ts rewrites
    ui_host: POSTHOG_HOST,
    capture_pageview: false, // we capture manually to include SPA nav
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: {
      dom_event_allowlist: ["click", "submit"],
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug(false);
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // init once on mount
  useEffect(() => {
    initPostHog();
  }, []);

  // manual pageview capture on route change
  useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  // scroll depth capture (25 / 50 / 75 / 100)
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    const seen = new Set<number>();
    const onScroll = (): void => {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const pct = Math.floor((scrolled / doc.scrollHeight) * 100);
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !seen.has(milestone)) {
          seen.add(milestone);
          posthog.capture("scroll_depth", { depth: milestone });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <>{children}</>;
}

export { posthog };
