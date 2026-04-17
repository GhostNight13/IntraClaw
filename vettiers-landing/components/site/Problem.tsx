import { TrendingDown, EyeOff, DollarSign } from "lucide-react";

const stats = [
  {
    icon: TrendingDown,
    value: "52%",
    label: "of treatment plans are declined",
    source: "AVMA",
  },
  {
    icon: EyeOff,
    value: "73%",
    label: "of clients are never offered an alternative",
    source: "Gallup / AAHA",
  },
  {
    icon: DollarSign,
    value: "$60K",
    label: "lost per vet, per year",
    source: "industry benchmarks",
  },
] as const;

export function Problem() {
  return (
    <section id="problem" className="py-24 md:py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">The problem</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            One expensive quote. One answer: &quot;let me think about it.&quot;
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] leading-relaxed">
            Every clinic loses thousands a month to clients who walk out with a single quote they can&apos;t afford — and no Plan B in writing.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {stats.map(({ icon: Icon, value, label, source }) => (
            <div
              key={label}
              className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-7 transition-all hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-surface)]"
            >
              <div className="flex items-center gap-3 text-[var(--color-brand)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-soft)]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 text-5xl font-semibold tracking-tight text-[var(--color-text)]">
                {value}
              </div>
              <p className="mt-2 text-[var(--color-text-muted)] leading-snug">{label}</p>
              <p className="mt-6 text-xs uppercase tracking-widest text-[var(--color-text-dim)]">
                Source · {source}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
