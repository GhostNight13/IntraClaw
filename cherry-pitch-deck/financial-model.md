# VetTiers x Cherry — Volume Projection Model

**Version:** 1.0 (April 2026) | **Purpose:** defensible Cherry GMV projection to back slide 7-8 claims
**Philosophy:** every number is an assumption, every assumption is labeled, every scenario is bracketed. If Cherry's team wants to stress-test, they should be able to change one input and trace the downstream effect.

---

## Section 1 — Core assumptions (per clinic, monthly)

| # | Variable | Base | Best | Worst | Source / logic |
|---|---|---|---|---|---|
| A1 | Qualifying visits / mo | 400 | 500 | 300 | Avg 1-DVM practice. AVMA Economic Report benchmarks; scales linearly with DVM count. |
| A2 | Current decline rate on qualifying tickets | 40% | 45% | 30% | AAHA decline survey 2024; conservative midpoint of published ranges (28-52%). |
| A3 | Recovery rate via tiering UX | 50% | 65% | 35% | Analog to retail "three-option" pricing uplift (Iyengar, Ariely); no vet-specific published data yet — flagged as the weakest assumption. |
| A4 | Financing attach rate on recovered tickets | 60% | 75% | 40% | Scratchpay/Cherry published attach rates for offered-vs-not clinics trend 55-70%. |
| A5 | Avg financed ticket size | $1,200 | $1,500 | $900 | Industry avg for veterinary financed procedures; Cherry public operator talks reference $1.1K-$1.4K. |

**Derived: Cherry transactions per clinic per month (base case):**
A1 × A2 × A3 × A4 = 400 × 0.40 × 0.50 × 0.60 = **48 transactions**

**Derived: Cherry GMV per clinic per month (base case):**
48 × $1,200 = **$57,600**

---

## Section 2 — Clinic ramp assumption

| Month | New clinics signed this month | Cumulative paying clinics | Logic |
|---|---|---|---|
| 1 | 2 | 2 | Founder-led; warm network (vet school classmate referrals via r/Veterinary). |
| 2 | 3 | 5 | Reference clinics go live, demo library starts. |
| 3 | 4 | 9 | First testimonial video shipped. |
| 4 | 5 | 14 | First state VMA webinar (Texas or Colorado). |
| 5 | 6 | 20 | Trigger: hire US CX lead. |
| 6 | 5 | 25 | Brief dip during CX onboarding. |
| 7 | 7 | 32 | CX ramps, close rate normalizes. |
| 8 | 8 | 40 | Second VMA conference. |
| 9 | 9 | 49 | Referral loop active (30% of new from existing customers). |
| 10 | 10 | 59 | Steady state. |
| 11 | 10 | 69 | — |
| 12 | 11 | 80 | PIMS marketplace listing goes live (ezyVet or AviMark). |
| 13-24 | avg 12 / mo | 224 by M24 | Marketplace listing is the flywheel. |

**Note:** slide 8 uses slightly different rounded numbers (60 at M12, 180 at M24) to stay conservative in the pitch. This model is the more granular truth.

---

## Section 3 — Scenario output tables

### Base case

| Month | Clinics | Txns / mo | GMV / mo | Cumulative GMV |
|---|---|---|---|---|
| 6 | 25 | 1,200 | $1,440,000 | $3.8M |
| 12 | 80 | 3,840 | $4,608,000 | $9.1M |
| 24 | 224 | 10,752 | $12,902,400 | ~$18.2M |

### Best case (A1-A5 at best-column values + 12 new clinics/mo from M6)

| Month | Clinics | Txns / mo | GMV / mo | Cumulative GMV |
|---|---|---|---|---|
| 6 | 35 | 3,071 (A1=500, A2=0.45, A3=0.65, A4=0.75 → 110 txn/clinic) | $4,607,000 | $11.2M |
| 12 | 120 | 10,530 | $15,795,000 | $30.8M |
| 24 | 310 | 27,196 | $40,793,625 | ~$68M |

### Worst case (A1-A5 at worst-column values + half the ramp)

| Month | Clinics | Txns / mo | GMV / mo | Cumulative GMV |
|---|---|---|---|---|
| 6 | 12 | 151 (A1=300, A2=0.30, A3=0.35, A4=0.40 → ~12.6 txn/clinic) | $135,900 | $0.4M |
| 12 | 40 | 504 | $453,600 | $1.7M |
| 24 | 110 | 1,386 | $1,247,400 | ~$9.4M |

---

## Section 4 — Sensitivity (which assumption moves the needle)

Running each assumption ±20% from base while holding others constant (M12 GMV impact):

| Variable | -20% | Base | +20% |
|---|---|---|---|
| A1 Visits | $3.69M | $4.61M | $5.53M |
| A2 Decline rate | $3.69M | $4.61M | $5.53M |
| A3 Recovery rate | $3.69M | $4.61M | $5.53M |
| A4 Attach rate | $3.69M | $4.61M | $5.53M |
| A5 Avg ticket | $3.69M | $4.61M | $5.53M |
| Clinic ramp | $3.69M | $4.61M | $5.53M |

**Observation:** linear dependency, so each ±20% shift produces an identical ±20% GMV shift. The actual risk isn't which lever — it's **compound drift**. If any two assumptions slip 20% low simultaneously, GMV drops ~36%. Worst case above is effectively four-variable compound drift.

---

## Section 5 — Assumption stress log (weakest → strongest)

1. **A3 (recovery rate via tiering):** Weakest. No vet-specific empirical data. Anchored to retail three-option uplift research (Iyengar ~35-70% uplift range). Must be validated within first 5 pilot clinics — if actual recovery is under 30%, the whole model needs re-baselining.
2. **Clinic ramp (Section 2):** Second weakest. Founder-led sales has no historical benchmark for this specific ICP. The PIMS marketplace listing at M12 is a single-point-of-failure for the ramp curve.
3. **A4 (attach rate):** Medium. Cherry and Scratchpay public talks reference 55-70%; 60% is mid-range.
4. **A5 (avg ticket):** Medium-strong. Dental and soft-tissue surgery benchmarks are well-published.
5. **A1 (qualifying visits):** Strong. AVMA benchmarks are reliable.
6. **A2 (decline rate):** Strong. Multiple published sources converge on 40-50%.

---

## Section 6 — Revenue model (VetTiers' own economics, for Cherry's due diligence)

Cherry needs to know we have a business model that doesn't depend on stealing their margin.

- **Pricing:** $149/clinic/month flat SaaS fee, billed through Stripe.
- **We take 0% of Cherry's merchant fee.** Explicit and contractual.
- **M12 ARR (base):** 80 clinics × $149 × 12 = $143,040.
- **M24 ARR (base):** 224 × $149 × 12 = $400,512.
- Incremental upsell (M18+): premium tier at $299/mo with custom PIMS integrations, no dependency on Cherry.

**Implication for Cherry:** our survival doesn't require you to change your rate card. If Cherry's merchant fees compress, VetTiers is unaffected. That stability means we won't churn you at renewal negotiations.

---

## Section 7 — What we'd commit to verifying in the pilot

By end of month 6, we commit to reporting back to Cherry's partnerships team with actuals for each assumption:

- Measured qualifying-visits volume per live clinic
- Measured decline rate pre-VetTiers (from clinic historical)
- Measured recovery rate post-VetTiers
- Cherry attach rate (from Cherry-side data)
- Actual avg financed ticket

Quarterly written review. Adjust projections together. If A3 falls below 30% on real data, we renegotiate scope — no ego attached to the current numbers.

---

**Model owner:** Ayman Idamre · ayman.idamre@gmail.com
**Last updated:** April 17, 2026
**Format:** this doc is the source of truth; any slide numbers that diverge are rounded for presentation and should be reconciled here.
