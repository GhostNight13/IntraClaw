import { Stethoscope, Sparkles, Signature } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: Stethoscope,
    title: "Vet enters diagnosis",
    body: "Type the condition — \"feline dental, grade 3\" — directly in VetTiers or pull it from your PIMS.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "AI generates 3 tiers in 20 seconds",
    body: "Good / Better / Best plans, each with line items, total price, and the monthly cost via Cherry financing.",
  },
  {
    n: "03",
    icon: Signature,
    title: "Client signs on their phone",
    body: "Send by SMS. The client picks a tier, signs with their finger, and Cherry handles the financing flow.",
  },
] as const;

export function Solution() {
  return (
    <section id="how" className="py-24 md:py-32 border-t border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            From diagnosis to signed plan in under a minute.
          </h2>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <li
              key={n}
              className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--color-text-dim)]">{n}</span>
                <Icon className="h-5 w-5 text-[var(--color-brand)]" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[var(--color-text)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
