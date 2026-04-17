import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-12">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-brand)] text-[10px] font-bold text-slate-950">
            V
          </span>
          VetTiers · {new Date().getFullYear()}
        </div>

        <nav className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
          <a href="/privacy" className="hover:text-[var(--color-brand)] transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-[var(--color-brand)] transition-colors">Terms</a>
          <a
            href={`mailto:${site.contactEmail}`}
            className="hover:text-[var(--color-brand)] transition-colors"
          >
            {site.contactEmail}
          </a>
        </nav>
      </div>
    </footer>
  );
}
