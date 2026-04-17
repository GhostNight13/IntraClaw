# Cherry Pitch Deck — Operator's Guide

**Audience:** Cherry partnerships team (25-min Zoom)
**Presenter:** Ayman Idamre (Brussels, solo founder)
**Product:** VetTiers — tiered treatment estimates + financing UX for US vet clinics
**Positioning:** Amplifier of Cherry volume, not a competitor

---

## How to use this deck

1. **Read `slides.md` three times** before booking the meeting. Each read = different lens:
   - Pass 1: comprehension (do I believe each claim?)
   - Pass 2: speaker notes out loud, with a timer (target 90-120s per slide)
   - Pass 3: imagine you are Cherry's Head of Partnerships. What hurts?
2. **Build the deck in one of these tools** (ranked by fit):
   - **Pitch.com** (free tier) — best for async share link, analytics on who viewed
   - **Figma Slides** — best if you want to reuse brand later in the product UI
   - **Google Slides** — lowest friction, but looks generic; avoid unless you're pressed
3. **Design pass:** paste each slide's headline + supporting copy. Leave every slide breathing — one idea per slide, no bullet soup. Use a single accent color (Cherry's red, #E4002B, is a subtle flex).
4. **Rehearse the full deck 3x** out loud with your webcam recording. Kill every "um", every hedge ("we kinda", "we're hoping to"), every filler bullet.
5. **Pre-meeting checklist** (morning-of):
   - Camera at eye level, natural light in front of you
   - Close Slack, Messages, email notifications
   - Have `financial-model.md` and `objection-handling.md` open on a second screen
   - Glass of water within reach
   - 5-minute breathing exercise before you join (box breathing: 4-4-4-4)

---

## Tool recommendation

**Use Pitch.com.** Reasons:
- Free tier allows link-sharing (Cherry will want to forward internally)
- View analytics tell you when their team opened it, which slides they replayed
- Cleaner default typography than Google Slides
- Real-time collaboration if you want a second pair of eyes later

Template to start from: "Clean Product Pitch" (Pitch's marketplace). Strip all stock imagery. Keep: layout grid, type scale.

---

## Dos and Don'ts

### Dos
- **Open with a question**, not a logo slide reveal. "Before I start, can I ask — what's Cherry's biggest constraint right now, new clinic acquisition or per-clinic GMV?" This flips the dynamic from pitch to conversation.
- **Use their vocabulary.** "Merchant," "GMV," "attach rate," "approval rate," "APR disclosure," "soft pull."
- **Name your weaknesses before they do.** "I'm solo, pre-revenue, in Brussels." Said early, this disarms. Said late, it's a gotcha.
- **Quote vets, not yourself.** If you have 2-3 quotes from vets who saw the Figma clickthrough, put them in as pull-quotes. Third-party voice > your opinion.
- **Pause after your ask.** Don't fill the silence. Let them respond first.
- **Take notes visibly.** Screen-share a Notion doc where you're typing their feedback. Signals you take them seriously.

### Don'ts
- **Don't pitch "disruption."** Cherry is the disruptor in this market. You're infrastructure.
- **Don't badmouth Scratchpay or CareCredit.** Be precise: "For our merchant persona — sub-3-DVM clinics with no IT — CareCredit's 24-month application flow is friction. That's our opening." Facts, not shade.
- **Don't promise exclusivity you can't deliver.** If they ask for 24-month exclusivity, counter with 6-month or pilot-cohort exclusivity.
- **Don't read the slides.** If the slide has 20 words, you say 80 words adjacent to it, not the same words.
- **Don't apologize for being 20.** Your age is irrelevant unless you make it relevant.
- **Don't end on "any questions?"** End on a specific next step with a date.

---

## Questions Cherry is likely to ask + prepared answers

### 1. "Walk me through your ICP. Who is the ideal VetTiers clinic?"
**Answer:** 1-3 DVM independent clinics, US, using ezyVet or AviMark, doing $800K-$3M annual revenue, with a practice manager who hates awkward money conversations. Not corporate (Mars, NVA) — those have CareCredit contracts locked in. Not mobile-only — need front-desk workflow.

### 2. "What's your user acquisition plan?"
**Answer:** Three channels in this order: (1) r/Veterinary and VetPartners Facebook groups — hands-on demos, $0 CAC; (2) state VMA conference tables starting Q3; (3) ezyVet/AviMark marketplace listings once we hit 25 paying clinics. No paid ads until unit economics are locked.

### 3. "Why should we give you engineering resources before you have revenue?"
**Answer:** You don't have to. Sandbox access is a doc-read, not an integration. The first 90 days I build against sandbox alone. You commit engineering time only after I show you 5 clinics pre-signed and a production-ready integration. I'm buying the option, you're selling optionality.

### 4. "What's your take rate / pricing?"
**Answer:** VetTiers is SaaS — $149/clinic/month flat. We do not take a piece of Cherry's merchant fee. We don't want misaligned incentives. Every Cherry transaction from our UI is 100% Cherry economics. Our upside is seat expansion.

### 5. "How do you prevent regulatory risk on our side?"
**Answer:** Two firewalls. (1) All APR/TILA disclosures, SSN collection, and credit decisioning happen in a Cherry-owned iframe or redirect — we never touch a regulated data element. (2) Our UI uses only the language Cherry approves for pre-qualification ("see estimated options," never "get approved"). Draft language shared with your compliance team before launch.

### 6. "Who else have you talked to?"
**Answer:** Honest answer — I've read Scratchpay's public API docs and CareCredit's provider portal. I have not taken meetings with them. Cherry is my first and preferred conversation because of (a) soft-pull pre-qual, (b) modern API, (c) vet-vertical focus in your partnership team. If this conversation doesn't convert in 30 days, I'll broaden.

### 7. "What happens if we say no?"
**Answer:** I keep building the tiering + estimate UX — that's valuable without financing. I ship with Stripe/manual payments. Six months later I come back with paying clinics and you're integrating into installed demand. That's the fallback; I'd rather partner now.

### 8. "Who's your investor?"
**Answer:** Bootstrapped. Revenue from my web agency funds development. Not raising until 50 paying clinics or a partnership commitment creates a funding catalyst — whichever comes first.

### 9. "Why Brussels? Why would US vets trust a Belgian vendor?"
**Answer:** I incorporate a Delaware C-corp before the first paid clinic. Stripe-paid invoices, US phone support (planned: contract CX in Austin at 20 clinics). The practical answer is that our SaaS doesn't require a local presence — Calendly, Notion, Gusto all sell to US vets from not-US. The trust stack is US entity + US CX + a Cherry logo on the marketing site.

### 10. "What's your 5-year vision?"
**Answer:** VetTiers becomes the estimate-and-finance layer for every independent vet in the US, then UK/EU. In year 3 we add human-health verticals (dental, elective derm) using the same tiering engine. Cherry stays our primary financing partner in the US if this pilot works.

---

## What success looks like (in priority order)

1. **A+ outcome:** Sandbox API credentials issued within 48 hours + a named eng counterpart + a follow-up call booked for 2 weeks out.
2. **A outcome:** Sandbox access within 2 weeks + a merchant agreement template sent.
3. **B outcome:** "Come back when you have 5 clinics signed." This is actually good — converts to A+ in 60 days if you execute.
4. **C outcome:** Polite decline. Ask explicitly: "If I come back with X paying clinics and Y of integration done, does this conversation reopen?" Get a number.
5. **F outcome:** Ghosting. If no response in 5 business days, one clean follow-up. After that, pivot to Scratchpay and note the rejection in your CRM.

---

## Post-meeting (within 2 hours)

- Send a thank-you email summarizing the 3 concrete next steps you agreed on, with owners and dates
- Update mempalace: `mempalace_add_drawer` with meeting notes, their objections, and what surprised you
- If an ask was made of you (e.g., "send us 3 vet references"), your turnaround clock started the moment the call ended. Aim for 24h.

---

**File index:**
- `slides.md` — 12 slides, speaker notes, layout specs
- `financial-model.md` — volume math, scenario tables, assumptions
- `objection-handling.md` — 10 anticipated objections with answers
- `demo-script.md` — live demo walkthrough if requested
