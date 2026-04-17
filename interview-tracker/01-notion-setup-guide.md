# Notion Setup Guide — VetTiers Discovery Tracker

**Goal:** stand up a 4-database tracker for 40 customer discovery interviews (30 pet owners + 10 vets) in under 60 minutes. Free Notion account is enough.

**Databases you will build:**
1. Contacts — everyone you reach out to
2. Interviews — completed/scheduled calls
3. Themes — patterns detected every 5 interviews
4. Decisions — key calls made during validation

Full property specs are in `02-database-schemas.md`. This file is the click-by-click setup.

---

## 0. Prep (5 min)

1. Log in to notion.so with your personal account.
2. In the left sidebar, click **+ Add a page** at the workspace root.
3. Name it **VetTiers Discovery** — this is the parent page.
4. Inside, create 4 empty sub-pages (click `/` → **Page**):
   - `Contacts`
   - `Interviews`
   - `Themes`
   - `Decisions`
5. Create a 5th sub-page called `Dashboard` — you will embed views here later.

Final tree:
```
VetTiers Discovery/
├── Contacts
├── Interviews
├── Themes
├── Decisions
└── Dashboard
```

---

## 1. Template duplication pattern (since no shareable link)

Notion has a public template gallery but no curated VetTiers template. Instead, we self-duplicate. For each of the 4 sub-pages:

1. Open the sub-page.
2. Type `/database-full` and press Enter. This creates a full-page database inside that page.
3. Rename the database to match the page name (e.g., `Contacts DB` inside `Contacts` page).
4. Delete the default `Name`, `Tags`, `Empty` properties — you will re-add them from the schema.

**Why full-page and not inline?** Full-page DBs allow multiple views (Board/Calendar/Table) without cluttering the parent. You can always embed a linked view later in the Dashboard page.

---

## 2. Build DB 1 — Contacts (15 min)

Open `Contacts DB`. Click **+** next to the existing `Name` column to add each property.

| Order | Property | Type | Configuration |
|---|---|---|---|
| 1 | Name | Title | default — rename from "Name" to "Name" (keep as title) |
| 2 | Type | Select | options: `Pet Owner`, `Vet DVM`, `Practice Manager`, `Other` |
| 3 | Source | Select | `Reddit`, `LinkedIn`, `FB`, `Twitter`, `State VMA`, `Referral`, `Other` |
| 4 | Status | Status | groups: **To-do** = `Cold`, `Contacted`; **In progress** = `Screener Sent`, `Screener Completed`, `Scheduled`; **Complete** = `Completed`, `Follow-up Done`, `Disqualified` |
| 5 | Email | Email | — |
| 6 | Phone | Phone | — |
| 7 | Location | Text | state/country free text |
| 8 | Clinic Size | Select | `Solo`, `2-4 DVM`, `5-10 DVM`, `10+ DVM`, `Corporate`, `N/A` |
| 9 | PIMS used | Select | `AVImark`, `Cornerstone`, `ezyVet`, `Provet Cloud`, `Shepherd`, `VetSpire`, `Other`, `Unknown`, `N/A` |
| 10 | Pet species | Select | `Dog`, `Cat`, `Both`, `Exotic`, `N/A` |
| 11 | Declined amount range | Select | `<$200`, `$200-500`, `$500-1500`, `$1500+`, `N/A` |
| 12 | First contact date | Date | — |
| 13 | Screener score | Number | format: plain, precision 0 |
| 14 | Notes | Text | — |
| 15 | Interview | Relation | target: Interviews DB (set up in §3 after DB 2 exists) |

**Tip:** for the Status property, set a color: green = Complete, blue = In progress, gray = To-do. Makes the board view instantly readable.

---

## 3. Build DB 2 — Interviews (15 min)

Open `Interviews DB`. Add properties per `02-database-schemas.md` §DB 2.

**Key gotchas:**
- **Interview ID** is the title field. Rename the default `Name` to `Interview ID`. Manually type `A-001`, `A-002`, … for pet owner; `B-001`, `B-002`, … for vet. Notion does not auto-increment title fields on free tier.
- **Contact** is a Relation → Contacts DB. When you click "Show on Contacts" the Interview relation in DB 1 auto-populates. Turn it ON so the link is bidirectional.
- **Emotional signals**, **Economic pain indicators**, **Emotional pain indicators**, **Workflow pain**, **Follow-up tags** are all **Multi-select**. Pre-create the full tag list from the schema before your first interview — adding options mid-call is friction.
- **Recording URL** and **Transcript URL** are URL type (not text). Notion auto-clickable.
- **GO/NO-GO vote** is a Select. Color Path 1 green, Path 2 blue, Path 3 purple, Path 4 red, Unclear gray.

---

## 4. Build DB 3 — Themes and DB 4 — Decisions (10 min)

Repeat the process. Specifics:

- **Themes DB** → `Supporting interviews` is a Relation → Interviews DB (many-to-many, show on both sides).
- **Decisions DB** → no relations needed; it is a standalone log.

---

## 5. Wire relations (5 min)

Go back to `Contacts DB`. The `Interview` relation should now offer "Interviews DB" as a target. Select it. Enable "Show on Interviews DB" so each Interview shows its Contact back.

Go to `Themes DB`. Set `Supporting interviews` relation → Interviews DB, two-way on.

Sanity check: open any Interview page. You should see a `Contact` link and a `Supporting themes` backlink. If not, the relation isn't two-way.

---

## 6. Create views (10 min)

Each DB needs multiple views. Click the view switcher (top-left of the DB, next to "Default view") → **+ Add view**.

### Contacts DB — 4 views

1. **Pipeline (Board)** — group by `Status`. Card preview: Type + Source + Location.
2. **By Source (Table)** — group by `Source`. Sort: `First contact date` descending.
3. **To contact today (Table)** — filter: `Status = Cold`. Sort: Screener score descending.
4. **All (Table)** — no filter, all properties visible. Your master view.

### Interviews DB — 4 views

1. **Calendar** — date property = `Date`. See scheduled interviews at a glance.
2. **Board by Status** — group by `Status`. Quickly spot interviews needing synthesis (`Completed` → `Synthesis Done`).
3. **Pet Owners only** — Table, filter `Type = Pet Owner 15min`. Sort by Interview ID.
4. **Vets only** — Table, filter `Type = Vet 20min`.

### Themes DB — 2 views

1. **By Confidence (Board)** — group by `Confidence` (Low → Medium → High → Confirmed).
2. **Red/Green flags (Table)** — group by `Red or Green flag`.

### Decisions DB — 1 view

1. **Timeline (Table)** — sort by `Date` descending.

---

## 7. Build the Dashboard page (10 min)

Open the `Dashboard` page (empty so far). This is where you check progress daily.

Paste these block structures (type `/` for each):

```
# VetTiers Discovery Dashboard

## This week
/linked-view → Contacts DB → "To contact today"
/linked-view → Interviews DB → "Calendar"

## Pipeline
/linked-view → Contacts DB → "Pipeline (Board)"

## Recent synthesis
/linked-view → Interviews DB → "Board by Status"

## Themes emerging
/linked-view → Themes DB → "By Confidence (Board)"

## Decisions log
/linked-view → Decisions DB → "Timeline"
```

Use `/linked-view of database` (NOT `/linked-view of page`). Select the DB, then "Copy existing view" to reuse the views you built.

---

## 8. Add formula-driven counters (5 min)

See `05-dashboard-formulas.md`. These go as **rollups** or **formulas** inside the Dashboard page using Notion's database inline blocks, or as new properties inside each DB.

Recommended: add a `Synthesis missing` formula property to Interviews DB, shown as a red dot when synthesis fields are empty but status = Completed. Instant visual nag.

---

## 9. Import CSV (2 min)

Open `Contacts DB`. Top-right menu (`...`) → **Merge with CSV**. Pick `03-contacts.csv`. Map columns:

- Name → Name (title)
- Type → Type (select — Notion auto-creates options if missing)
- Source → Source
- …etc.

Verify 10 rows imported. You can delete the samples later.

---

## 10. Daily/weekly rhythm

- **Daily (5 min, 9am):** open Dashboard. Check `To contact today`. Send outreach.
- **After each interview (30 min):** fill `04-interview-synthesis-template.md` → copy content into new Interview DB row.
- **Weekly (90 min, Fri 9-10:30 CET):** follow `06-weekly-review-protocol.md`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Relation property not showing target DBs | DBs must be in the same workspace. Check left sidebar — if any DB is in "Private", move it under `VetTiers Discovery`. |
| Status property only has one color | Status type (not Select) lives in 3 groups: To-do, In progress, Complete. Drag options between groups to set colors. |
| CSV import creates duplicate properties | During import, explicitly map each CSV column to an existing property (dropdown). Don't let Notion auto-create. |
| Two-way relation broken | Open the relation property → toggle "Show on [other DB]" OFF then ON. |
| Views disappear after refresh | Free Notion limits view count per DB only on shared pages. For personal use you have unlimited. Check sync indicator in top-right. |

You're done. Ship it.
