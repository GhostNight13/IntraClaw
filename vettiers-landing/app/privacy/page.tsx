import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How VetTiers collects, uses, and protects your data.",
  alternates: { canonical: `${site.url}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main>
      <Header />
      <article className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)]">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[var(--color-text-dim)]">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-6 text-[var(--color-text-muted)] leading-relaxed">
          <section className="space-y-3">
            <p>
              VetTiers is operated by <strong>Ayman Idamre</strong>, sole proprietor, based in Brussels, Belgium
              (the &ldquo;Data Controller&rdquo;). This policy explains what we collect, why, and your rights under GDPR and CCPA.
            </p>
            <p>
              Contact:{" "}
              <a href={`mailto:${site.contactEmail}`} className="text-[var(--color-brand)] hover:underline">
                {site.contactEmail}
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">1. What we collect</h2>
            <p className="font-medium text-[var(--color-text)]">Waitlist information you provide:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Name, email, clinic name, role, clinic size, PIMS used, state, interview willingness.</li>
              <li>You give this voluntarily when you submit the waitlist form.</li>
            </ul>
            <p className="font-medium text-[var(--color-text)] pt-2">Technical data collected automatically:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Anonymized analytics via <strong>PostHog</strong> (pageviews, CTA clicks, scroll depth). No session replay.</li>
              <li>Standard server logs (IP address, user-agent, timestamps) via <strong>Vercel</strong>, our hosting provider.</li>
            </ul>
            <p className="pt-2">
              <strong>We do NOT collect:</strong> payment information, SSN, medical records, pet health data, or any data about
              pet owners from the clinics we serve.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">2. Why we collect it</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Waitlist:</strong> to contact you about early access, pricing, product launch.</li>
              <li><strong>Analytics:</strong> to understand which content resonates and improve the site.</li>
              <li><strong>Server logs:</strong> security, abuse prevention, uptime monitoring.</li>
            </ul>
            <p>
              <strong>Legal basis (GDPR Art. 6):</strong> consent for waitlist; legitimate interest for analytics and security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">3. Who we share it with</h2>
            <p>We use a small set of service providers (&ldquo;processors&rdquo;):</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Vercel</strong> (USA) — hosting + CDN. <a href="https://vercel.com/legal/privacy-policy" className="text-[var(--color-brand)] hover:underline" target="_blank" rel="noreferrer">Their policy</a>.</li>
              <li><strong>PostHog</strong> (USA) — anonymized analytics. <a href="https://posthog.com/privacy" className="text-[var(--color-brand)] hover:underline" target="_blank" rel="noreferrer">Their policy</a>.</li>
              <li><strong>Tally</strong> (Belgium) — waitlist form storage. <a href="https://tally.so/help/privacy-policy" className="text-[var(--color-brand)] hover:underline" target="_blank" rel="noreferrer">Their policy</a>.</li>
              <li><strong>Google LLC</strong> — we email you from a Google-hosted inbox.</li>
            </ul>
            <p>
              We do <strong>not sell, rent, or trade</strong> your information to anyone. We only share if legally required
              (court order, law enforcement) and will notify you unless prohibited by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">4. International transfers</h2>
            <p>
              Some of our processors (Vercel, PostHog) are based in the United States. Transfers from the EU/EEA rely on the
              EU-US Data Privacy Framework and Standard Contractual Clauses as required by GDPR Chapter V.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">5. How long we keep it</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Waitlist entries: until you request deletion, or 24 months after product launch, whichever comes first.</li>
              <li>Analytics: anonymized, retained up to 12 months in PostHog.</li>
              <li>Server logs: 30 days in Vercel.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">6. Your rights</h2>
            <p>Under GDPR (if you&apos;re in the EU/EEA/UK) and CCPA (if you&apos;re a California resident) you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access</strong> the data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate data.</li>
              <li><strong>Delete</strong> your data (&ldquo;right to be forgotten&rdquo;).</li>
              <li><strong>Port</strong> your data to another service in a common format.</li>
              <li><strong>Object</strong> to processing based on legitimate interest.</li>
              <li><strong>Withdraw consent</strong> at any time.</li>
              <li><strong>Complain</strong> to your local data protection authority (e.g., the Belgian Data Protection Authority:{" "}
                <a href="https://www.dataprotectionauthority.be" className="text-[var(--color-brand)] hover:underline" target="_blank" rel="noreferrer">
                  dataprotectionauthority.be
                </a>).
              </li>
            </ul>
            <p>
              To exercise any right, email{" "}
              <a href={`mailto:${site.contactEmail}`} className="text-[var(--color-brand)] hover:underline">
                {site.contactEmail}
              </a>
              . We respond within 30 days (usually within 48h).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">7. Cookies</h2>
            <p>
              We use minimal essential cookies for site functionality and PostHog analytics. By using the site you consent to
              these. We do not use marketing/tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">8. Children</h2>
            <p>
              VetTiers is a B2B product for veterinary clinics. We do not knowingly collect data from anyone under 18. If you
              believe a minor has submitted data, contact us and we will delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">9. Changes to this policy</h2>
            <p>
              We&apos;ll update this page and, for material changes, email users on the waitlist. Last updated date is at the top.
            </p>
          </section>

          <p className="pt-6">
            <Link href="/" className="text-[var(--color-brand)] hover:underline">← Back to home</Link>
          </p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
