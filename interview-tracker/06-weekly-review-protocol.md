# Weekly Review Protocol — VetTiers Discovery

**When:** Every **Friday, 09:00–10:30 CET**. 90 minutes, no exceptions. Block on Google Calendar as `DEEP WORK — VetTiers Review`, mark as busy, decline meeting invites that overlap.

**Why Friday 9am:** interviews usually happen Tue-Thu (owner availability + vet availability peaks midweek). Friday morning the week's synthesis is still warm, but you've had one night to sleep on it. Decisions made later in the day become weekend ruminations.

**Location:** single-tab browser, airplane-mode phone in another room, noise-cancelling headphones, printed synthesis docs if possible.

---

## Pre-flight checklist (Thursday night, 5 min)

Do not enter Friday morning unprepared. Thursday between 17:00–18:00:

- [ ] Verify every interview done this week has `Status = Synthesis Done` (run the `Synthesis missing` view from `05-dashboard-formulas.md`). If any are red, synthesize them Thursday night — do NOT push to Friday.
- [ ] Print this week's synthesis `.md` files (or open in one tab each). Printed > screen for annotation, if printer available.
- [ ] Grab three highlighters: **yellow** (emotional signal), **pink** (economic signal), **blue** (workflow / product implication).
- [ ] Pull out a blank notebook page. Write at the top: `Week of YYYY-MM-DD — target: 5 new themes, 1 decision`.

---

## Block 1 — Re-read synthesis docs (30 min, 09:00–09:30)

Goal: re-immerse in the week's voices. Not analyze yet. Just listen.

1. Read each synthesis doc in order recorded (chronological).
2. Highlight as you go:
   - **Yellow** on every emotional phrase: "felt ashamed", "started crying", "couldn't look at her"
   - **Pink** on every economic phrase / dollar amount: "$1,200", "couldn't afford", "CareCredit declined me"
   - **Blue** on every workflow/product mention (vets): PIMS names, print workflows, estimate templates, staff bottlenecks
3. Put a star `⭐` next to any quote that gave you a physical reaction (chill, frown, nod).
4. Circle any **invalidating evidence** — these are worth their weight in gold.

**Do not jump to themes yet.** Your brain is pattern-matching; let it finish the input pass first.

---

## Block 2 — Update Themes DB (25 min, 09:30–09:55)

Goal: convert observations into named, tracked patterns.

### Step-by-step

1. Open Themes DB in Notion, `By Confidence` view.
2. For each highlighted quote, ask: **does this fit an existing theme?**
   - **Yes** → open that theme row, add the quote (verbatim + attribution) to `Supporting quotes`, link the Interview in `Supporting interviews`, bump `Confidence` if thresholds crossed (Low→Medium at 3, Medium→High at 5, High→Confirmed at 8).
   - **No** → create a new theme. Name it as a **complete sentence with a verb**, not a noun. Bad: "Shame". Good: "Owners hide financial shame from vet even when asked directly." Fill `First detected = today`, `Confidence = Low`, `Red/Green flag`, `Path implication`.
3. For each theme that moved to `Confirmed` this week, write a one-line summary in your notebook. You will use this in Block 4.
4. **Kill or merge bloat.** If you have >15 themes, you're naming synonyms. Merge aggressively. Any theme with 1 supporting interview after 5+ weeks of data → demote to "Anecdote" tag or delete.

### Quality bar

A valid theme must have:
- At least 2 distinct interviews supporting it (different people).
- Attributable verbatim quotes (not your paraphrases).
- A clear Path implication — if you can't say which of `Build 3-tier / Subscription / Triage / Kill / Irrelevant` this points to, the theme isn't specific enough.

---

## Block 3 — Decision log update (15 min, 09:55–10:10)

Goal: make one non-trivial decision, logged in DB 4. "No decision this week" is also a decision if documented.

1. Open Decisions DB.
2. Check: are any `Open` decisions from previous weeks unresolved? If yes, resolve one now.
3. Ask yourself three questions:
   - **Q1:** Based on this week's themes, has my confidence in any Path moved by >10 percentage points?
   - **Q2:** Is there a recruitment adjustment I need to make? (source channel not converting, wrong ICP, demographic over-represented)
   - **Q3:** Is there a product-scope decision I've been avoiding? (e.g., "should I still interview corporate chain vets?")
4. If any answer is yes, create a Decision row:
   - **Decision** — one-line summary
   - **Options considered** — the 2-3 alternatives
   - **Evidence cited** — specific interview IDs and theme names
   - **Decision made** — what you chose, 2-4 sentences
   - **Path** — which strategic path this supports
   - **Next step** — concrete action with owner + date
   - **Status** — `Open` (needs further validation) or `Done`
5. If no decision is warranted, log a `"No structural change this week"` decision with evidence showing why the data was consistent with the current course. Silence is dangerous; forced articulation is not.

### Decision-quality rule

Every decision must cite at least **2 interview IDs OR 1 Confirmed theme**. Decisions based on a single interview or gut feel get tagged `Weak evidence` in the Notes column and revisited next week.

---

## Block 4 — Next week recruitment targets (15 min, 10:10–10:25)

Goal: fill next week's calendar. Interviews don't happen unless you book them.

### Current progress math

Open the Contacts DB `Pipeline (Board)` view. Count rows per Status column.

- **Target end-state at N=40:** 30 owners + 10 vets `Completed` or `Synthesis Done`.
- **Target weekly pace** (assuming a 10-week sprint): 3 owners + 1 vet per week, = 4 interviews/week.
- **Replenishment ratio:** plan **2× conversion** for cold outreach. If you need 4 interviews next week, you need ~8 in `Scheduled` or `Screener Completed` by end of Friday.

### Action sequence

1. Count `Scheduled` contacts for next week. Target: ≥4. If below, continue to step 2.
2. Look at `Source` breakdown in completed interviews. Is any source over-represented? Rebalance:
   - If >50% come from Reddit → allocate 2 of next 5 outreaches to LinkedIn + State VMA.
   - If zero vets from State VMA in 3 weeks → either change approach or drop channel.
3. Write **3 specific outreach tasks** for Monday in your notebook:
   - "Monday 10am: DM 10 owners from r/dogs April 2026 financial threads"
   - "Monday 11am: InMail 5 vets in 2-4 DVM bracket with ezyVet"
   - "Monday 14h: follow up on 3 `Screener Sent` contacts from 2 weeks ago"
4. Verify screener link/template still works. Click it yourself. If the form is broken you'll lose 3 days before noticing.
5. Update the **Screener score** rubric if a pattern emerged — e.g., if "remembers emotional detail" is predicting high-quality interviews, bump its weight from +2 to +3.

---

## Block 5 — Close-out (5 min, 10:25–10:30)

- [ ] Open a blank page in the Dashboard. Write one sentence: **"This week I learned ________ about VetTiers."** Single sentence, no bullets. Forces compression.
- [ ] Snapshot the pain ratio from `05-dashboard-formulas.md §3`. Record Economic% and Emotional% in a running `Ratio log` text block on the Dashboard.
- [ ] Glance at the week-over-week trend. Two consecutive weeks of emotional > economic by >20pts is a structural signal — NOT noise — time to pivot the hypothesis.
- [ ] Commit the week's synthesis `.md` files to git: `git add interview-tracker/synthesis/ && git commit -m "discovery week N: add synthesis docs"`.
- [ ] Close all tabs. Step outside for 10 minutes before next task. Don't let the week's emotional load bleed into afternoon work.

---

## Red-flag triggers (stop everything and escalate to yourself)

If any of these fire during review, block a 60-min Saturday session to dig deeper:

| Trigger | Meaning |
|---|---|
| 3+ consecutive interviews rated 1-2/5 quality | Your screener/recruiting is pulling the wrong people. Fix the screener before next week. |
| Emotional pain % > 2× Economic pain % at N≥15 | VetTiers as a pricing product is probably wrong. Start drafting Path 2 or 3 hypotheses. |
| Zero invalidating evidence logged across 5+ interviews | Confirmation bias. Add skeptical prompts: "What part of my pitch sounded wrong to you?" |
| Same contact source produces >80% of interviews | Channel monoculture — findings won't generalize. Diversify immediately. |
| One theme crossed `Confirmed` with <4 distinct people | You're counting the same voice multiple times. Re-audit Supporting interviews. |
| Any vet interview voter says `Path 4 Kill` | Vets killing the idea matters more than owners. Investigate with 2 more vets before discounting. |

---

## At N=20 (halfway) — special extended review (+60 min)

Once you hit 20 completed interviews, the Friday review becomes 2.5 hours instead of 1.5. Extra blocks:

- **Pain map reconstruction (30 min):** redraw the economic/emotional/workflow map from scratch on a blank sheet. Don't consult old notes. Compare to your week-1 hypothesis. Divergence is the signal.
- **First GO/NO-GO aggregate (30 min):** tally all 20 votes. If one Path has >60% + strong quality-weighted score, soft-commit. Otherwise keep all paths open through N=40.

---

## At N=40 (finish) — final synthesis session (4 hours, one Saturday)

Out of scope for this weekly protocol — will need a dedicated one-off workflow doc. Placeholder reminder so you don't forget.

---

## Anti-patterns — don't do these

- **Skipping synthesis for one week** — two weeks of backlog destroys fidelity. Your memory of emotional nuance is gone after 5 days.
- **Interviewing during the review block** — the block is for reflection. Interviews are contamination.
- **Adding new Notion properties during review** — friction. Keep a `schema-changes.md` note, implement them on Saturday.
- **Making decisions based on the latest interview** — recency bias. Force yourself to cite ≥2 data points per decision.
- **Declaring a Path "confirmed" before N=30** — sample too small. Patience is the product.

You have 10 weeks. 90 minutes × 10 = 15 hours of review. That's the entire investment that decides whether VetTiers ships, pivots, or dies. Protect it.
