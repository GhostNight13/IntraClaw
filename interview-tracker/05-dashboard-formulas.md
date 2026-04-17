# Dashboard Formulas — Notion-Native Syntax

These use **Notion's new formula syntax (Formulas 2.0)** — the version available on free accounts as of 2025. All formulas below are real, tested syntax. Paste directly into a Formula property.

**How to add a formula:**
1. Open the target DB.
2. `+ Add property` → choose **Formula**.
3. Paste the expression in the editor.
4. Property column now renders the computed value per row.

**How to add an aggregate at the top of a view (for dashboard counters):**
1. Open the DB view.
2. Hover bottom of any column → click the `Calculate` dropdown.
3. Pick `Count`, `Count values`, `Percent empty`, `Sum`, etc. — no formula needed for simple counts.

For dashboard-wide aggregates that need logic (ratios, conditional counts across a whole DB), use a **linked database block on the Dashboard page** with a **filtered view** + a column `Calculate`. See each formula below for which technique applies.

---

## 1. Count of completed interviews by type

**Technique:** linked-view filter + Calculate.

**Setup on Dashboard:**

```
/linked-view → Interviews DB
  View type: Table
  Filter: Type = "Pet Owner 15min" AND Status = "Completed" OR "Synthesis Done" OR "Follow-up Scheduled"
  Bottom calculate on Interview ID column: Count all
```

Repeat with `Type = "Vet 20min"` for the vet counter.

**Progress-to-goal formula** (add to Interviews DB as Formula property, name `Owner progress`):

```
if(prop("Type") == "Pet Owner 15min" and (prop("Status") == "Completed" or prop("Status") == "Synthesis Done" or prop("Status") == "Follow-up Scheduled"), 1, 0)
```

Sum this column → you get total completed pet-owner interviews. Divide by 30 in your head or build a second formula:

```
format(round((prop("Owner progress count rollup") / 30) * 100)) + "% owners"
```

(requires a rollup parent — simpler to just use the Calculate dropdown and do mental math.)

---

## 2. Response rate by source

**Technique:** Formula property in Contacts DB + grouped view.

**Step A** — add formula `Responded` to Contacts DB:

```
if(
  prop("Status") == "Screener Completed"
    or prop("Status") == "Scheduled"
    or prop("Status") == "Completed"
    or prop("Status") == "Synthesis Done"
    or prop("Status") == "Follow-up Done",
  1,
  0
)
```

**Step B** — add formula `Reached` (everyone who got any outreach):

```
if(prop("Status") == "Cold", 0, 1)
```

**Step C** — create a view grouped by `Source`:

- Group: `Source`
- Calculate on `Reached` column: Sum (per group = outreach count per source)
- Calculate on `Responded` column: Sum (per group = responses per source)

**Step D** — read the group totals visually. Response rate = Responded ÷ Reached. For auto-computed percentage per source, you need a grouping subpage or manual math. Notion doesn't natively compute cross-group ratios in a single formula.

**Single-row fallback** — add this formula if you want a per-contact "was this a conversion?" flag:

```
if(prop("Reached") == 1 and prop("Responded") == 1, "Responded", if(prop("Reached") == 1, "No response", "Not yet reached"))
```

---

## 3. Economic vs Emotional pain ratio — KEY METRIC

This is the most important dashboard number. Definition:

```
Economic ratio = % of completed interviews where Economic pain indicators is non-empty
Emotional ratio = % of completed interviews where Emotional pain indicators is non-empty
```

If Emotional > Economic by >20 points, VetTiers is NOT primarily a pricing product → Path 2 or 3 becomes more attractive.

**Step A** — add two formula properties to Interviews DB.

`Has economic pain`:

```
if(length(prop("Economic pain indicators")) > 0, 1, 0)
```

`Has emotional pain`:

```
if(length(prop("Emotional pain indicators")) > 0, 1, 0)
```

**Step B** — filter view to completed interviews only:

```
Filter: Status is "Completed" or "Synthesis Done" or "Follow-up Scheduled"
```

**Step C** — Calculate on each column:
- `Has economic pain`: Sum → shows count. Also `Average` gives a 0-1 ratio.
- `Has emotional pain`: same.

**Step D** — add a Dashboard-level formula box (type `/callout`) with the ratio written manually each week. Notion can't divide two view-level calcs in one formula.

**Advanced single-row formula** — `Pain profile` (categorizes each interview):

```
ifs(
  prop("Has economic pain") == 1 and prop("Has emotional pain") == 1, "Both",
  prop("Has economic pain") == 1, "Economic only",
  prop("Has emotional pain") == 1, "Emotional only",
  "Neither"
)
```

Group Interviews view by this formula → instant visual ratio.

---

## 4. Current GO/NO-GO vote breakdown

**Technique:** view grouped by `GO/NO-GO vote`.

**Setup:**

```
View type: Board (or Table grouped)
Filter: Status is "Completed" or "Synthesis Done" or "Follow-up Scheduled"
Group by: GO/NO-GO vote
Calculate on Interview ID column: Count all per group
```

Each column of the board now shows total votes for that path.

**Companion formula** — `Vote weight` (weights high-quality interviews more):

```
if(prop("Quality self-rating") >= 4, 1, if(prop("Quality self-rating") >= 3, 0.5, 0))
```

Sum this column within each GO/NO-GO group instead of counting raw rows. Filters out low-quality votes.

---

## 5. Themes by confidence level

**Technique:** view in Themes DB grouped by `Confidence`.

**Setup:**

```
View type: Board
Group by: Confidence
Card preview: Theme name, Red or Green flag, Path implication, Supporting interviews (count)
Sort: First detected descending
```

**Companion formula** — `Evidence strength` (in Themes DB, as Formula property):

```
length(prop("Supporting interviews"))
```

`length()` on a Relation returns the count of linked items. Auto-upgrades confidence visually — sort descending to see which themes have the most backing.

**Auto-confidence-suggest formula** (optional, doesn't set the actual Confidence select but surfaces a recommendation):

```
ifs(
  length(prop("Supporting interviews")) >= 8, "Confirmed (suggest)",
  length(prop("Supporting interviews")) >= 5, "High (suggest)",
  length(prop("Supporting interviews")) >= 3, "Medium (suggest)",
  length(prop("Supporting interviews")) >= 1, "Low (suggest)",
  "No evidence yet"
)
```

Compare this against the manually-set `Confidence` — mismatch = time to update.

---

## 6. Interviews needing synthesis

**Critical nag.** Any interview where `Status = Completed` but synthesis fields are empty should show a red flag.

**Formula property on Interviews DB, name `Synthesis missing`:**

```
if(
  prop("Status") == "Completed"
    and (
      empty(prop("Top 3 quotes"))
      or empty(prop("Pain rank"))
      or empty(prop("Decision moment"))
      or empty(prop("Invalidating evidence"))
      or prop("GO/NO-GO vote") == ""
    ),
  "NEEDS SYNTHESIS",
  ""
)
```

**Dashboard block:**

```
/linked-view → Interviews DB
  Filter: Synthesis missing is not empty
  View type: Table
  Visible properties: Interview ID, Contact, Date, Synthesis missing
```

If this view has any rows Friday morning, synthesis is overdue — treat as P0 for the weekly review block.

---

## 7. Bonus — days-since-last-interview counter

Add to Interviews DB to surface recruitment pace:

```
dateBetween(now(), prop("Date"), "days")
```

On the Dashboard, min-filter to the most recent completed interview. If `>3 days`, recruitment is lagging.

---

## 8. Bonus — target gap (30 owners, 10 vets)

**Dashboard callout formula** (paste on Dashboard page in a formula block — this requires a database parent, so the cleanest way is a mini "Progress" DB with one row):

Create a DB `Progress` with 2 rollup properties pointing to Interviews DB counts, then formula:

```
"Owners: " + format(prop("Owners done")) + "/30 · Vets: " + format(prop("Vets done")) + "/10"
```

Simpler alternative — add a text property `Progress note` to your Dashboard and update it manually each Friday. Zero formulas, zero bugs.

---

## Formula syntax cheat sheet

| Need | Syntax |
|---|---|
| If/else | `if(condition, then, else)` |
| Multi-branch | `ifs(cond1, val1, cond2, val2, ..., elseVal)` |
| And / Or | `and`, `or` (lowercase, as keywords) |
| Equals | `==` |
| Not equals | `!=` |
| Empty check | `empty(prop("X"))` |
| Multi-select has value | `length(prop("X")) > 0` |
| Relation count | `length(prop("X"))` |
| Date diff in days | `dateBetween(now(), prop("Date"), "days")` |
| String concat | `"text " + format(prop("X"))` |
| Access property | `prop("Exact property name")` |

Notion is **case-sensitive on property names and exact-match on select values**. A typo silently returns empty — not an error. Always test formulas with a known row before trusting dashboard numbers.
