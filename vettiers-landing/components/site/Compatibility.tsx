const pims = ["Cornerstone", "ezyVet", "AVImark", "Provet Cloud"] as const;
const financing = ["Cherry", "Scratchpay", "CareCredit"] as const;

export function Compatibility() {
  return (
    <section className="py-20 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs uppercase tracking-widest text-[var(--color-text-dim)]">
          Designed to work with what you already use
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2 items-center">
          <LogoRow heading="PIMS integrations" items={pims} />
          <LogoRow heading="Financing partners" items={financing} />
        </div>

        <p className="mt-10 text-center text-xs text-[var(--color-text-dim)]">
          Logos are the property of their respective owners. Integrations roll out with founding clinics.
        </p>
      </div>
    </section>
  );
}

function LogoRow({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] text-center md:text-left">
        {heading}
      </p>
      <div className="mt-4 flex flex-wrap justify-center md:justify-start items-center gap-x-8 gap-y-3">
        {items.map((label) => (
          <span
            key={label}
            className="text-lg md:text-xl font-semibold tracking-tight text-[var(--color-text-muted)]/70 hover:text-[var(--color-text-muted)] transition-colors"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
