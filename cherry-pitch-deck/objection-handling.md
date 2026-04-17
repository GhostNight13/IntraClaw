# Cherry — Anticipated Objections & Responses

**Rule:** 2-3 sentences each. Honest. No BS. If an answer makes you uncomfortable to say out loud, rewrite it until it doesn't.

---

## 1. "You're pre-revenue — why should we commit engineering time?"

You shouldn't, yet. Sandbox access is a docs handshake, not an engineering commitment — I'll build against it solo for 90 days and come back with a working integration before you staff anything. You only commit real engineering time when I show you 5 signed LOIs and a production-ready build, at which point the risk-to-you-per-hour drops through the floor.

---

## 2. "What prevents you from bolting Scratchpay later?"

Nothing contractual, and I wouldn't promise you otherwise. What prevents it practically is that we've architected the UI around Cherry's soft-pull flow UX — swapping to a different provider means redesigning the front-desk surface our customers will have onboarded to. The real lock-in isn't a clause, it's the switching cost we're willingly taking on by integrating deeply with your API surface. If you want a written exclusivity window (e.g., first 12 months), I'd consider it in exchange for co-marketing.

---

## 3. "You're in Belgium — how do US vets trust you?"

Same way they trust Calendly, Notion, or Gusto — US-incorporated Delaware C-corp, US phone support, Stripe invoicing. I'll form the US entity before the first paid clinic signs. At 20 clinics I hire a US-based CX lead (Austin/Denver contract). The test isn't where I live, it's whether a vet can get someone on the phone during their business hours — and that test I'll pass.

---

## 4. "Your UI compliance — how do we know you'll get Reg Z right?"

You know because you get to vet it. Every piece of copy in our UI that touches financing — "as low as $62/mo," "pay over time," pre-qual CTA — goes through your compliance team before launch and again on every material change. The regulated surfaces themselves (APR disclosure, finance charge, payment schedule, SSN) render inside your hosted iframe or redirect — we literally don't have the DOM for it.

---

## 5. "What's the insurance structure if a client disputes a loan?"

The loan is between the consumer and Cherry. Our merchant agreement (clinic-side) governs the underlying service; your loan agreement governs the financing. If a consumer disputes the loan, that's the Cherry-consumer relationship; we'll cooperate on any documentation you need (signed estimate, timestamp, procedure confirmation). I'll also carry an E&O policy before the first production transaction — standard SaaS coverage, roughly $1M limit.

---

## 6. "Why not just let clinics use our hosted checkout directly?"

Because 90% of them don't, and that's the whole problem. The independent sub-3-DVM clinics — which is our ICP — skip hosted checkouts because the front desk workflow breaks on a redirect. Your volume with them is capped at whatever acquisition channel you can run directly. We extend your reach into a segment that self-serve doesn't convert, and we do it without expanding your sales team.

---

## 7. "What's the exclusivity we get for committing engineering?"

Fair question. I can offer pilot-cohort exclusivity — for the first 50 clinics we onboard in 2026, Cherry is the sole financing provider in the UI. After that, we revisit based on performance. I won't offer blanket 24-month exclusivity because that's a poor trade for a solo founder, and you shouldn't want me to make promises I'd regret. I'd rather offer something I can actually honor.

---

## 8. "Your projections assume 80% Cherry attach — show us the math."

The base case assumes 60%, not 80%. The 60% is the share of *recovered* tickets (tickets brought back from a "decline" state via tiering) that opt into financing; industry attach rates for offered-vs-not clinics run 55-70%, so we're mid-range. The weakest assumption in the model isn't attach rate — it's recovery rate (50% base), and I flag that openly in the financial model doc. Happy to walk both numbers live.

---

## 9. "What happens if vet practices push back on tiered pricing?"

Some will, and we've designed for it. Tiering is opt-in per-estimate — a vet can present one option if they want, and VetTiers still adds value on the financing surfacing alone. The AVMA's 2026 Spectrum of Care guidance is pushing the profession toward tiering as a norm, but we're not forcing anyone. If a clinic won't tier, we lose some recovery uplift but not the financing attach — their GMV to Cherry is lower but still incremental.

---

## 10. "How do you stop Digitail / ezyVet from copying this feature?"

I don't, long-term. Short-term, the PIMS vendors don't build consumer-facing finance surfaces because their product teams are focused on scheduling and medical records — estimate UX is a separate craft. Medium-term, the defensibility is distribution: if we get to 500 clinics first, the PIMS vendors acquire us or integrate us rather than rebuild. Long-term, if a PIMS does build it, we compete on execution — our advantage is we're ten times faster at consumer-facing UX than any vet software vendor has ever been.

---

## Bonus — objections they might not say out loud but are thinking

### "Is this kid going to disappear in 6 months?"

Legitimate fear. My agency business is revenue-positive and funds this, so I'm not on a VC-funded burn clock. I've shipped IntraClaw (the AI platform this product lives inside), HaiSkills, and 15 client websites — I don't ghost projects. If I'm going to walk away from VetTiers, you'd see it coming 60 days out because I'd tell you. Reputation in a small vertical is the only compounding asset I have.

### "Why should I give a 20-year-old my sandbox credentials?"

You've given sandbox credentials to worse. A sandbox key is reversible — revoke it in one click if anything goes sideways. The meaningful commitment from Cherry's side is the named counterpart and the merchant template, both of which are low-cost to provide and high-value to validate whether this relationship is real.
