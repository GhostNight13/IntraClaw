"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How do you handle patient data and HIPAA-adjacent privacy?",
    a: "Client contact info and treatment-plan data are encrypted in transit (TLS 1.3) and at rest (AES-256). We don't store clinical records beyond what's required to generate and sign the plan. A signed BAA is available on request for US clinics. Hosting is on US-region infrastructure.",
  },
  {
    q: "Which PIMS do you integrate with?",
    a: "At launch: Cornerstone, ezyVet, AVImark, and Provet Cloud. We sync the patient record both ways — no re-typing, and the signed plan is written back to the chart. If your PIMS isn't listed, tell us on the waitlist form and we'll prioritize accordingly.",
  },
  {
    q: "What happens if Cherry changes their terms or drops us?",
    a: "Honest answer: financing is the oxygen of this product, so we're building on two rails, not one. Cherry is our primary partner; CareCredit and Scratchpay are planned fallbacks. Tiers and e-signature work without financing — clients can also pay in full.",
  },
  {
    q: "Is there any regulatory risk in presenting \"tiers\" of care?",
    a: "VetTiers is a communication tool, not a clinical decision-maker. The veterinarian defines the line items; we structure and present them. Standard of care documentation, informed consent, and record-keeping stay with the clinic. We mirror language the AVMA already recommends for treatment plan communication.",
  },
  {
    q: "Why $149/month? What's the catch?",
    a: "There isn't one — it's founding pricing for the first 50 clinics, locked for 24 months. Post-launch pricing will be higher (targeting $249–299/mo with larger tiers). We want skin-in-the-game customers who'll help us build the product, not a free tier that attracts tire-kickers.",
  },
  {
    q: "When does it actually launch?",
    a: "Private beta with founding clinics: Q3 2026. Public launch: Q4 2026 / Q1 2027 in the US. We're being deliberate: 40+ discovery interviews done, Cherry partnership in progress, PIMS integrations in design. If you want to influence the roadmap, join the waitlist and tick the \"willing to interview\" box.",
  },
] as const;

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">FAQ</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          The questions clinics actually ask.
        </h2>

        <Accordion type="single" collapsible className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
