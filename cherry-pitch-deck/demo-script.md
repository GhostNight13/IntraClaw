# Demo Script — Cherry Meeting

**Scenario:** Cherry asks mid-meeting, "Can you show us the product?"
**Reality:** There is no shippable product yet. There is a Figma clickthrough + 3 annotated screenshots.
**Rule:** never lie about what's built. Show the prototype, call it a prototype, move on.

---

## 90-second live walkthrough (if you have the Figma ready)

**Setup before the meeting:**
- Figma file open in Presentation mode in a separate tab
- Window dimensions match iPad landscape (1024x768) for realism
- Cursor large and visible (macOS Accessibility → Cursor Size 2x)
- Pre-rehearse the click path 5 times — you should not hunt for buttons on camera

**Script:**

> "I'll screen-share the Figma prototype — this is clickable but not production code. Happy to share the file after the call if you want to poke at it.
>
> [SCREEN SHARE]
>
> OK. We're on the front-desk iPad, the tech has just finished the exam and the DVM wrote 'dental with possible extractions, bloodwork.' The tech taps the treatment-plan template — [click] — and VetTiers pulls three tiers from the clinic's price list.
>
> **Good:** just the cleaning, $380. **Better:** cleaning plus pre-anesthetic bloodwork, $620. **Best:** everything plus digital dental radiographs and two extractions, $1,180. The tech reviews with the owner on-screen.
>
> Let's say the owner picks 'Better.' [click] Under the price there's a 'Pay over time' button powered by Cherry. [click]
>
> Here's your pre-qual sheet — this is mocked up with your sandbox UI, exact behavior would match your production widget. Owner enters email, DOB, last-four — SSN goes into your hosted field, not ours. [click] Sixty seconds later, mock response: '$62 per month over 12 months, 0% APR promo.' Owner taps accept. [click]
>
> Estimate is e-signed, calendar invite goes to the owner's email for the procedure date, tech is free to walk to the next room.
>
> That's the ninety-second flow. What used to be 'let me think about it' is a booked procedure with financing locked in."

---

## Annotated screenshot fallback (if Figma isn't ready or screen-share fails)

Have these three images saved as PNGs in a Keynote/Pitch slide you can jump to:

### Screenshot 1 — "Tier builder"
**Annotation overlay:**
- Red circle around the "Dental w/ Extractions" template picker → label: "Template drawn from PIMS"
- Red circle around the three price cards → label: "Auto-priced from clinic rate card"
- Red circle around the "Adjust line items" link → label: "Vet retains full control"

**What to say:** "This is where the tech builds the estimate. Template-driven so it takes 30 seconds, not 5 minutes. Vet can override every line."

### Screenshot 2 — "Cherry pre-qual embedded"
**Annotation overlay:**
- Red circle around the "Pay over time" button → label: "Cherry-branded CTA"
- Red circle around the iframe boundary → label: "Cherry-hosted surface — no regulated PII touches our app"
- Red circle around the "As low as $62/mo" display text → label: "Approved pre-qual language only"

**What to say:** "The financing surface is yours. We render the teaser in our UI using your approved copy, and the actual collection happens inside your iframe. Our database has no column for SSN."

### Screenshot 3 — "Signed + scheduled"
**Annotation overlay:**
- Red circle around the e-signature line → label: "Clinical estimate e-signed"
- Red circle around the calendar invite → label: "Procedure auto-booked"
- Red circle around the "Financed by Cherry" badge → label: "Cherry attribution on the confirmation"

**What to say:** "And this is the close. Estimate signed, procedure on the calendar, Cherry attribution visible. The owner walks out with a procedure booked, not a thought."

---

## If the demo breaks during the live call

**Script to have memorized:**

> "Alright, the prototype is fighting me — that's on me for not refreshing. Let me pull up the screenshots instead [jump to fallback slide]. I'll send you the full Figma file after the call so you can click through on your own time."

Do not troubleshoot on camera. Do not panic-close windows. Accept the break, pivot to screenshots, move on. Bonus: breaking on a demo with a clean recovery actually *builds* credibility — you didn't pretend.

---

## What NOT to do in the demo

- Don't say "this is almost done" or "we'll have this in two weeks." Let the prototype speak for itself — they know what a Figma file looks like.
- Don't show three different mockup styles (stale old ones + new ones). One design system, one file.
- Don't demo features beyond the Cherry integration path. If they ask about clinical notes or inventory, say: "That's in the roadmap, but today I want to keep us focused on the financing surface."
- Don't demo in dark mode unless the actual product is dark-mode-default. Mismatched chrome signals untested product.

---

## Post-demo — the one question to ask

After the demo, before they ask anything, say:

> "What's the one thing on that flow that would concern your compliance or product team?"

This pulls objections out early, turns the demo into dialogue, and signals you want feedback more than applause. Their answer is the most valuable data point of the call.

---

## Pre-meeting Figma checklist

- [ ] Clickthrough tested end-to-end, 5 clean runs
- [ ] Prototype set to "Desktop preview" at iPad resolution
- [ ] Loading states (fake) present between clicks — looks real, not like a static mockup
- [ ] Cherry brand elements (logo, color) used with visible restraint — approved for pitch use only, will confirm actual usage rights before any external material
- [ ] Sample data uses realistic names + realistic dollar amounts (no "Client McClientface")
- [ ] Backup: Figma file exported as a 1-minute MP4 screen recording, stored locally (in case internet fails during demo)
- [ ] Backup to the backup: three annotated PNGs ready in a hidden slide
