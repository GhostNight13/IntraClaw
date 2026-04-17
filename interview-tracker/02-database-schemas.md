# Database Schemas — VetTiers Discovery Tracker

4 interconnected Notion databases. Copy this spec directly into Notion when building properties.

Property type abbreviations: T = Title, S = Select, MS = Multi-select, St = Status, E = Email, Ph = Phone, D = Date, N = Number, U = URL, Txt = Text, R = Relation, Ck = Checkbox, F = Formula.

---

## DB 1: Contacts

**Purpose:** log every person reached out to. One row = one human.

| # | Property | Type | Options / Config | Notes |
|---|---|---|---|---|
| 1 | Name | T | — | Full name. If anonymous, use handle (e.g., `reddit:u/petmom42`). |
| 2 | Type | S | `Pet Owner`, `Vet DVM`, `Practice Manager`, `Other` | Which cohort this person belongs to. Drives screener template. |
| 3 | Source | S | `Reddit`, `LinkedIn`, `FB`, `Twitter`, `State VMA`, `Referral`, `Other` | For computing response-rate-by-source. |
| 4 | Status | St | To-do: `Cold`, `Contacted` · In progress: `Screener Sent`, `Screener Completed`, `Scheduled` · Complete: `Completed`, `Follow-up Done`, `Disqualified` | 8-stage pipeline. |
| 5 | Email | E | — | Required before Scheduled. |
| 6 | Phone | Ph | — | Optional. Only for vets who prefer voice. |
| 7 | Location | Txt | state/country | e.g., `NY, USA` or `Brussels, BE`. |
| 8 | Clinic Size | S | `Solo`, `2-4 DVM`, `5-10 DVM`, `10+ DVM`, `Corporate`, `N/A` | Vets only. Use `N/A` for owners. |
| 9 | PIMS used | S | `AVImark`, `Cornerstone`, `ezyVet`, `Provet Cloud`, `Shepherd`, `VetSpire`, `Other`, `Unknown`, `N/A` | Vets only. |
| 10 | Pet species | S | `Dog`, `Cat`, `Both`, `Exotic`, `N/A` | Owners only. |
| 11 | Declined amount range | S | `<$200`, `$200-500`, `$500-1500`, `$1500+`, `N/A` | Owners only. Screener question. |
| 12 | First contact date | D | — | When you first messaged them. |
| 13 | Screener score | N | format: plain, precision 0, range 0-10 | Quality score from screener. See scoring rubric below. |
| 14 | Notes | Txt | — | Free-form: context, red flags, insider info. |
| 15 | Interview | R | → Interviews DB, two-way: `Contact` | Links to the interview row once scheduled. |

### Screener score rubric (0-10)

**Pet owners (target ≥6/10 to schedule):**
- +3 declined recommended care in last 12 months
- +2 specific amount declined ($200+)
- +2 remembers emotional detail (shame/guilt/anger)
- +1 still thinks about it / has unresolved feelings
- +1 used payment plan or financing
- +1 would talk for 15 min for $25 gift card

**Vets (target ≥7/10 to schedule):**
- +3 estimates 10+ declined cases/month
- +2 can name current estimate workflow (PIMS + printing)
- +2 mentions emotional toll on staff
- +1 1-3 DVM practice (our ICP)
- +1 willing to share PIMS screenshot
- +1 not under exclusivity with a PIMS vendor

---

## DB 2: Interviews

**Purpose:** one row per completed or scheduled interview. Holds synthesis.

| # | Property | Type | Options / Config | Notes |
|---|---|---|---|---|
| 1 | Interview ID | T | format: `A-001` (owners), `B-001` (vets) | Manual increment. Owners A-001…A-030, Vets B-001…B-010. |
| 2 | Contact | R | → Contacts DB (two-way: `Interview`) | The human. |
| 3 | Date | D | date + time | Local Brussels time. |
| 4 | Duration | N | format: plain, "min" suffix via description | Actual length, not scheduled. |
| 5 | Interviewer | S | `Ayman` (default) | For future co-interviewers. |
| 6 | Type | S | `Pet Owner 15min`, `Vet 20min` | Drives synthesis template. |
| 7 | Recording URL | U | — | Only if verbal consent captured at start of call. |
| 8 | Transcript URL | U | — | Otter.ai / Fathom link. |
| 9 | Status | St | To-do: `Scheduled` · In progress: `Completed`, `Synthesis Done` · Complete: `Follow-up Scheduled` | Synthesis Done = DB 2 filled out. |
| 10 | Top 3 quotes | Txt | — | Verbatim, with em-dash attribution. Keep the ugly grammar. |
| 11 | Pain rank | Txt | — | Short list: rank pains 1-3 as they prioritized, NOT as you interpret. |
| 12 | Emotional signals | MS | `pauses`, `tears`, `anger`, `shame`, `pride`, `resignation`, `empathy` | What you observed, not what they said. |
| 13 | Economic pain indicators | MS | `couldnt-afford`, `too-expensive`, `no-money`, `no-financing-offered` | Spec asks for checkbox list; MS is the Notion-idiomatic equivalent (one field, many tags). |
| 14 | Emotional pain indicators | MS | `judged`, `ashamed`, `rushed`, `didnt-listen`, `felt-like` | Same pattern. `felt-like` captures "felt like I was a bad pet parent" etc. |
| 15 | Workflow pain | MS | `PIMS-friction`, `tech-time`, `estimate-format`, `front-desk` | Vets only. Leave empty for owners. |
| 16 | Decision moment | Txt | — | The exact moment they decided to decline/accept care. Capture scene. |
| 17 | What they tried | Txt | — | Workarounds: CareCredit, Scratchpay, GoFundMe, asking family, skipping meds, rescheduling. |
| 18 | Unprompted mentions | Txt | — | Anything they volunteered without you asking. Highest signal. |
| 19 | Product implications | Txt | — | Your analysis: what this means for VetTiers. 2-5 sentences max. |
| 20 | Invalidating evidence | Txt | — | **Mandatory 1 minimum.** What did you hear that contradicts your VetTiers hypothesis? |
| 21 | Follow-up tags | MS | `needs-vet-referral`, `wants-beta`, `willing-to-refer`, `request-results`, `ghosted`, `disqualified`, `high-value` | Build list as you go — start with these 7. |
| 22 | Quality self-rating | N | 1-5 | Your honest rating of the interview. <3 = redo or discount findings. |
| 23 | GO/NO-GO vote | S | `Path 1 Build`, `Path 2 Subscription`, `Path 3 Triage`, `Path 4 Kill`, `Unclear` | Your vote based on THIS interview alone. Aggregate at N=20 and N=40. |

---

## DB 3: Themes

**Purpose:** patterns that emerge every 5 interviews. Update during weekly review.

| # | Property | Type | Options / Config | Notes |
|---|---|---|---|---|
| 1 | Theme name | T | — | Short descriptive: `Owners hide financial shame from vet`, `Vets print estimates 3x per visit`. |
| 2 | First detected | D | — | When you first named it. |
| 3 | Supporting interviews | R | → Interviews DB (many, two-way: `Supporting themes`) | Link every interview where this theme showed. |
| 4 | Supporting quotes | Txt | — | Verbatim with attribution: `"I felt judged when she saw my face" — A-007`. |
| 5 | Confidence | S | `Low` (1-2 interviews), `Medium` (3-4), `High` (5-7), `Confirmed` (8+) | Thresholds match N=40 sample size. |
| 6 | Red or Green flag | S | `Green flag` (supports VetTiers), `Red flag` (invalidates), `Neutral` | — |
| 7 | Path implication | S | `Build 3-tier`, `Subscription`, `Triage`, `Kill`, `Irrelevant` | What this theme implies for path choice. |

---

## DB 4: Decisions

**Purpose:** log every non-trivial decision made during validation. Audit trail.

| # | Property | Type | Options / Config | Notes |
|---|---|---|---|---|
| 1 | Decision | T | — | One-line summary: `Kill Path 3 Triage based on vet refusal evidence`. |
| 2 | Date | D | — | Decision date, not entry date. |
| 3 | Options considered | Txt | — | Bullet list of alternatives you weighed. |
| 4 | Evidence cited | Txt | — | Which interview IDs / themes support this. Use `A-003, A-011, Theme #4`. |
| 5 | Decision made | Txt | — | What you chose and why (2-4 sentences). |
| 6 | Path | S | `Build 3-tier`, `Subscription`, `Triage`, `Kill`, `Pivot` | — |
| 7 | Next step | Txt | — | Concrete action with owner+date. `Book 3 vets for Path 1 tier pricing validation by 2026-05-02`. |
| 8 | Status | S | `Open`, `In-progress`, `Done` | — |

---

## Relation map

```
Contacts (15 props)
   │
   │  Interview (R ↔ Contact)
   ▼
Interviews (23 props)
   ▲
   │  Supporting interviews (R ↔ Supporting themes)
   │
Themes (7 props)

Decisions (8 props, standalone — references interviews by ID in text, not by relation)
```

Keep it lean. Don't add properties Notion will thank you for. Add them only when a real question can't be answered without them.
