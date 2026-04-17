import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "VetTiers terms of service for the marketing site and waitlist.",
  alternates: { canonical: `${site.url}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main>
      <Header />
      <article className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)]">Terms of Service</h1>
        <p className="mt-3 text-sm text-[var(--color-text-dim)]">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-6 text-[var(--color-text-muted)] leading-relaxed">
          <section className="space-y-3">
            <p>
              These terms govern your use of the VetTiers marketing website and the VetTiers waitlist. They are limited to
              website use. A separate Master Services Agreement (MSA) will be provided and signed before any clinic is
              onboarded as a paying customer of the product.
            </p>
            <p>
              The website is operated by <strong>Ayman Idamre</strong>, sole proprietor, based in Brussels, Belgium.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">1. Acceptance</h2>
            <p>By using this site or submitting the waitlist form, you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">2. Waitlist</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Joining the waitlist is free and creates no obligation for either party.</li>
              <li>We may invite you to participate in user-research interviews, early beta access, or product launches.</li>
              <li>Founding pricing ($149/month, locked 24 months) is offered to the first 50 qualified clinics that complete onboarding. We may decline a clinic that doesn&apos;t fit beta criteria, at our discretion.</li>
              <li>We may remove you from the waitlist for any lawful reason, including suspected abuse or misuse.</li>
              <li>You may unsubscribe or request deletion at any time by emailing us (see section 8).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">3. Accurate information</h2>
            <p>
              You agree to provide truthful information when signing up. We rely on clinic role / clinic size / PIMS
              accuracy to decide beta prioritization.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the site for any unlawful purpose or in violation of applicable law.</li>
              <li>Attempt to scrape, reverse-engineer, or overwhelm the site.</li>
              <li>Submit false, misleading, or automated waitlist entries.</li>
              <li>Upload malicious content or attempt to compromise security.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">5. Intellectual property</h2>
            <p>
              All content on this site (text, logos, graphics, code) is owned by Ayman Idamre or licensed to us. You may share
              links to the site and quote short excerpts with attribution. You may not copy the site or create derivative
              products from it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">6. No warranties</h2>
            <p>
              The site is provided &ldquo;as is&rdquo; without warranties of any kind. We make no guarantees about uptime,
              accuracy of statistics shown, product launch timeline, or beta availability. Statistics cited (52%, 73%, $60K) come
              from public industry sources (AVMA, AAHA, Gallup) and are subject to each source&apos;s methodology.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">7. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Ayman Idamre is not liable for any indirect, incidental, or
              consequential damages arising from use of the site or waitlist. Total liability in any case is limited to €100.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">8. Contact &amp; notices</h2>
            <p>
              Email:{" "}
              <a href={`mailto:${site.contactEmail}`} className="text-[var(--color-brand)] hover:underline">
                {site.contactEmail}
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">9. Governing law</h2>
            <p>These terms are governed by Belgian law. Any dispute is subject to the exclusive jurisdiction of the courts of Brussels, Belgium — without prejudice to mandatory consumer protection rights of users in other jurisdictions.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">10. Changes</h2>
            <p>
              We may update these terms. Material changes will be announced to the waitlist. Continued use after changes
              constitutes acceptance.
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
