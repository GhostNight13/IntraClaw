# Examples

Real Telegram interactions with IntraClaw. Each one shows the prompt, the
expected reply, and what happens under the hood — which tools fire, which
LLM tier picks it up, approximate latency, and fallback behavior.

All examples assume the Telegram adapter is configured and your user id is
on the whitelist.

---

## Example 1: Web search with summary

**Prompt:**
> Cherche les dernières news sur OpenAI et résume en 3 points.

**Expected response:**
```
✅ Task completed!

1. GPT-5 officially launched — 30 % faster reasoning, new vision mode.
2. o4-mini preview opened to Plus users today.
3. Multi-year Microsoft Azure partnership renewed through 2030.
```

**Under the hood:**
- Action pattern `/^cherche/i` matches in `handleText` → universal executor path
- `web-search` tool invoked: Google News RSS + DDG Instant Answer fired in parallel
- Lightweight `fast`-tier LLM (Haiku / Gemini Flash) formats the 3 bullets
- Total latency: ~3-5 s

---

## Example 2: Quick calculation

**Prompt:**
> Calcule 17% de 4850€ puis soustrais 120.

**Expected response:**
```
✅ Task completed!

(0.17 * 4850) - 120 = 704.50
```

**Under the hood:**
- `calcule` + `puis` trigger the multi-step action pattern
- `calculator` tool called — safe Pratt-parser, no `eval`
- No LLM call for the math itself, only for the short wrap-up sentence
- Latency: <1 s

---

## Example 3: File operations

**Prompt:**
> Lis le fichier data/autonomous-state.json et dis-moi combien d'actions aujourd'hui.

**Expected response:**
```
✅ Task completed!

240 actions exécutées aujourd'hui (dernière : maintenance, il y a 3 min).
```

**Under the hood:**
- `lis` pattern matches → universal executor
- `file-ops` reads the JSON, `datetime` normalizes the last-action timestamp
- `balanced`-tier LLM extracts the `totalActionsToday` field and phrases the reply
- Latency: ~2 s

---

## Example 4: Code refactor (multi-step)

**Prompt:**
> Regarde src/ai.ts, trouve les doublons dans le routing des providers, et propose un refactor.

**Expected response:**
```
✅ Task completed!

Found 3 near-duplicate blocks (lines 112-140, 201-229, 288-316) — all three
build the same `modelOptions` object with only the provider name changing.

Proposed: extract `buildProviderOptions(name, ctx)` helper. Full diff saved
to data/proposals/<id>.diff — review with /proposals, apply with /approve <id>.
```

**Under the hood:**
- `regarde` + `trouve` + `propose` → multi-step universal executor
- `file-ops` reads `src/ai.ts`, quality-tier LLM (Opus / Sonnet) does analysis
- Diff written via the self-improvement subsystem; no code touched yet
- Latency: ~20-40 s

---

## Example 5: Pause and resume

**Prompt:**
> pause

**Expected response:**
```
⏸ Boucle autonome + scheduler en pause.
Dis "reprends" pour relancer.
```

Then:
> reprends

```
▶️ Boucle autonome + scheduler relancés !
```

**Under the hood:**
- Regex fast-path in `handleText` — no LLM call at all
- Directly calls `pauseLoop()` + `stopScheduler()` (or the inverse)
- Latency: <100 ms

---

## Example 6: Natural conversation fallback

**Prompt:**
> Salut, comment ça roule aujourd'hui ?

**Expected response:**
```
🟢 Salut ! Ça roule : itération #847, 240 actions aujourd'hui, aucun échec.
Scheduler actif, 3 objectifs en cours. Besoin de quelque chose ?
```

**Under the hood:**
- `ça roule` matches the quick-status regex — hybrid path
- Reads `getLoopState()` + `getPrioritizedGoals()` synchronously
- `handleNaturalChat()` → `ask()` at `fast` tier, 300 tokens max, temp 0.6
- Latency: ~1-2 s

---

## Example 7: Learned skill reuse (Voyager)

**Prompt (first time):**
> Génère un rapport mensuel des prospects convertis en CSV.

**Expected response:**
```
✅ Task completed!

CSV exported to data/reports/prospects-2026-04.csv (47 rows).
New skill learned: "export-prospects-csv" (v1).
```

**Prompt (second time, a week later):**
> Même chose pour la semaine passée.

**Expected response:**
```
✅ Task completed! (reused skill export-prospects-csv v1, similarity 0.89)

CSV exported to data/reports/prospects-2026-04-week16.csv (12 rows).
```

**Under the hood:**
- First run: universal executor plans from scratch, calls Notion + file-ops,
  then `skillLibrary.addSkill()` distills the trajectory (code + description
  + embedding) into SQLite
- Second run: `findRelevant(query, k=5)` returns the stored skill at 0.89
  cosine similarity → executor short-circuits to the learned code path
- Latency first run: 15-30 s / second run: 3-5 s

---

## Example 8: Evolution cycle (Ouroboros)

**Prompt:**
> /evolve

**Expected response:**
```
🧬 Cycle d'évolution démarré
Version actuelle : v0.4.12
Étapes : candidat → LLM → constitution → tsc → review → commit → vérif post-commit.
Durée : typiquement 1-3 min…

✅ Cycle terminé : committed
⏱ 94.3s
📌 Version : v0.4.12 → v0.4.13
📄 Fichier : src/utils/rate-limiter.ts
🔖 Commit : 4f2a8e1c9b03
💡 Added exponential backoff to the claude provider to reduce 429 errors.
```

**Under the hood:**
- `/evolve` command → `runEvolutionCycle('telegram-manual')`
- Candidate file picked by the critic, patch drafted by quality-tier LLM
- Guards run in order: constitution check → `tsc --noEmit` → reviewer LLM
- On green light: commit to the `ouroboros-evolution` branch, version bump
- If any guard fails the cycle reports `rejected-by-*` and no commit lands
- Latency: 60-180 s

---

## Tips

- **Keep prompts specific.** "Analyze src/ai.ts" beats "analyze the code".
- **Chain with connectors.** Words like *puis*, *ensuite*, *et après* trigger the
  multi-step executor and get better plans than a single sentence.
- **Use fast-paths.** `pause`, `resume`, `status`, `/prospects`, `/proposals` skip
  the LLM entirely and answer in <200 ms.
- **Check `/blocked`.** If the autonomous loop hits something it can't resolve
  alone (missing credential, ambiguous intent), it parks the task and waits
  for `/unblock <id> retry|skip|abort`.
