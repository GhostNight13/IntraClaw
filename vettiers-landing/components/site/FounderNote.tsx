export function FounderNote() {
  return (
    <section className="py-24 md:py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 md:p-14">
          <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">A note from the founder</p>
          <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            Why I&apos;m building VetTiers.
          </h2>

          <div className="mt-6 space-y-4 text-[var(--color-text-muted)] leading-relaxed">
            <p>
              I&apos;m Ayman. I build software out of Brussels, and over the last few months I&apos;ve had more than 40 conversations with veterinarians, practice managers, and pet owners across the US and Europe.
            </p>
            <p>
              The same story came back every time: a single quote, no alternative, a client who says &quot;let me think about it,&quot; and an animal that doesn&apos;t get treated. Vets hate it. Owners hate it. And the tools they have today don&apos;t solve it.
            </p>
            <p>
              VetTiers is my honest attempt to fix that — with a product small enough to actually ship, not a platform that takes two years to configure. If you run a clinic and this sounds like your Tuesday morning, I&apos;d love to talk to you before a single line of production code is written.
            </p>
          </div>

          <p className="mt-8 text-sm text-[var(--color-text-dim)]">— Ayman Idamre, Founder · Brussels, Belgium</p>
        </div>
      </div>
    </section>
  );
}
