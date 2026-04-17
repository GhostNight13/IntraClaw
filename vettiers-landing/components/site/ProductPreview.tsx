import { ArrowRight, Check } from "lucide-react";

export function ProductPreview() {
  return (
    <section className="py-24 md:py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">The product</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            Built for the exam room, not the IT department.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <DashboardMockup />
          <PhoneMockup />
        </div>

        <div className="mt-6">
          <IntegrationDiagram />
        </div>
      </div>
    </section>
  );
}

/* ─── Desktop dashboard mock ─────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <ComingSoonOverlay />
      <div className="border-b border-[var(--color-border)] px-5 py-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-[var(--color-text-dim)] font-mono">app.vettiers.com/plans/new</span>
      </div>
      <div className="p-5 grid grid-cols-3 gap-4 text-xs">
        <div className="col-span-1 space-y-3">
          <div className="rounded-lg bg-[var(--color-bg-elev)] p-3">
            <p className="text-[var(--color-text-dim)] uppercase tracking-widest text-[10px]">Patient</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">Rex · 4yr · Mixed breed</p>
          </div>
          <div className="rounded-lg bg-[var(--color-bg-elev)] p-3">
            <p className="text-[var(--color-text-dim)] uppercase tracking-widest text-[10px]">Diagnosis</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">Skin infection, moderate</p>
          </div>
          <div className="rounded-lg bg-[var(--color-bg-elev)] p-3">
            <p className="text-[var(--color-text-dim)] uppercase tracking-widest text-[10px]">PIMS</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">Cornerstone · synced</p>
          </div>
        </div>
        <div className="col-span-2 grid gap-3">
          <TierRow label="Essential" price="$285" monthly="$12/mo" />
          <TierRow label="Standard" price="$520" monthly="$22/mo" recommended />
          <TierRow label="Optimal" price="$890" monthly="$37/mo" />
        </div>
      </div>
    </div>
  );
}

function TierRow({
  label,
  price,
  monthly,
  recommended = false,
}: {
  label: string;
  price: string;
  monthly: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
        recommended
          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-elev)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${recommended ? "bg-[var(--color-brand)]" : "bg-[var(--color-text-dim)]"}`} />
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        {recommended && (
          <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-semibold text-slate-950">
            Recommended
          </span>
        )}
      </div>
      <div className="text-right">
        <p className="font-semibold text-[var(--color-text)]">{price}</p>
        <p className="text-[10px] text-[var(--color-text-dim)]">or {monthly} · Cherry</p>
      </div>
    </div>
  );
}

/* ─── iPhone / client view mock ──────────────────────────── */
function PhoneMockup() {
  return (
    <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 flex items-center justify-center overflow-hidden">
      <ComingSoonOverlay />
      <div className="iphone-frame">
        <div className="iphone-screen">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
            Message from Dr. Chen
          </p>
          <h4 className="mt-1 text-base font-semibold text-[var(--color-text)] leading-tight">
            Treatment options for Rex
          </h4>

          <div className="mt-5 space-y-3">
            <PhoneTier title="Essential" total="$285" month="$12/mo" items={["Antibiotics", "Exam"]} />
            <PhoneTier title="Standard" total="$520" month="$22/mo" items={["+ Blood panel", "+ Vaccine"]} recommended />
            <PhoneTier title="Optimal" total="$890" month="$37/mo" items={["+ Dermatology", "+ Nutrition"]} />
          </div>

          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-[var(--color-brand)] py-2.5 text-xs font-semibold text-slate-950"
          >
            Sign &amp; confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneTier({
  title,
  total,
  month,
  items,
  recommended = false,
}: {
  title: string;
  total: string;
  month: string;
  items: readonly string[];
  recommended?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        recommended
          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-[var(--color-text)]">{title}</span>
        <span className="text-xs font-semibold text-[var(--color-text)]">{total}</span>
      </div>
      <p className="text-[10px] text-[var(--color-text-dim)]">{month} via Cherry</p>
      <ul className="mt-2 space-y-0.5">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
            <Check className="h-2.5 w-2.5 text-[var(--color-brand)]" /> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Integration diagram ────────────────────────────────── */
function IntegrationDiagram() {
  return (
    <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10">
      <ComingSoonOverlay />
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
        <PipeBox title="Cornerstone" sub="Your PIMS" />
        <ArrowRight className="h-5 w-5 text-[var(--color-brand)] rotate-90 md:rotate-0" />
        <PipeBox title="VetTiers" sub="Generates 3 tiers" highlighted />
        <ArrowRight className="h-5 w-5 text-[var(--color-brand)] rotate-90 md:rotate-0" />
        <PipeBox title="Signed plan" sub="+ Cherry financing" />
      </div>
      <p className="mt-6 text-center text-xs text-[var(--color-text-dim)]">
        Two-way sync. Nothing re-typed. Client consent stored in your PIMS record.
      </p>
    </div>
  );
}

function PipeBox({
  title,
  sub,
  highlighted = false,
}: {
  title: string;
  sub: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-6 py-4 min-w-[160px] text-center ${
        highlighted
          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-elev)]"
      }`}
    >
      <p className="font-semibold text-[var(--color-text)]">{title}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-dim)]">{sub}</p>
    </div>
  );
}

function ComingSoonOverlay() {
  return (
    <div className="absolute top-3 right-3 z-10">
      <span className="rounded-full bg-slate-950/80 border border-[var(--color-border-strong)] px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] backdrop-blur">
        Preview · coming soon
      </span>
    </div>
  );
}
