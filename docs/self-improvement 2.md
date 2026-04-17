# Self-Improvement (Ouroboros)

IntraClaw can edit its own source tree. The loop is called Ouroboros — the
snake eating its tail. This document explains how it works, where the guards
are, and what the agent is NOT allowed to do.

## TL;DR

- One cycle = one coherent change to one file.
- Runs only on the `ouroboros-evolution` branch. Never on `main` or `master`.
- Every cycle passes a constitutional check, a TypeScript compile, and a
  multi-model review before the commit lands.
- A post-commit re-check rolls the commit back if the actual diff drifts from
  the proposal.

## Triggering a cycle

Two entry points, same engine (`src/evolution/evolution-engine.ts`):

- `/evolve` in Telegram — runs one cycle on demand and reports the outcome.
- The autonomous loop (`src/loop/autonomous-loop.ts`) can schedule cycles on
  its own cadence.

Every cycle returns a `CycleResult` with an outcome: `committed`,
`committed-and-restarted`, `rolled-back`, `rejected-by-constitution`,
`rejected-by-reviewer`, `rejected-by-tsc`, `no-candidate`, or `error`.

## The 8 stages

1. **Pick candidate** — `pickCandidateFile()` walks `src/`, filters with
   `bible-guard.isProtected`, and randomly picks one of the smallest 20% of
   `.ts` / `.md` files. Small files → higher chance a single-cycle edit fits.
2. **LLM proposal** — powerful-tier model receives the file, the BIBLE, and a
   slice of `SOUL.md`, then returns `{ newContent, rationale, commitMessage,
   restartRequired }` as strict JSON. Identical content and no-ops are rejected.
3. **Pre-commit constitution check** — `checkAlignment()` runs a pseudo-diff
   past the BIBLE's P0–P8 principles. Misalignment ends the cycle here.
4. **Baseline tsc** — `preCommitGate()` runs `npx tsc --noEmit` on the
   untouched tree. If the baseline is already red, we abort rather than blame
   the proposal for it.
5. **Multi-model review** — a second powerful-tier call acts as a strict
   reviewer: "approved: true/false + reason". Different model instance from
   the proposer so it is a real second opinion.
6. **writeAndCommit** — writes the new content, `git add --` only that file,
   commits on `ouroboros-evolution` with a `ouroboros:` prefix.
7. **Post-write tsc** — re-runs `tsc --noEmit`. If the change broke types,
   `rollback()` does a `git reset --hard HEAD~1` on the evolution branch.
8. **Post-commit constitution re-check** — `checkAlignment()` runs again on
   the real commit diff. If it violates P0–P8, automatic rollback, no human
   approval needed (per P8).
9. **Bump version** — `bumpVersion('patch')` writes the new version to
   `src/evolution/VERSION.txt` and appends an entry to `memory/EVOLUTION_LOG.md`.

If the change touches `src/index.ts`, `src/server.ts`, `src/loop/`,
`src/channels/`, or `src/scheduler.ts`, the engine writes a
`data/evolution-restart.signal` file. A supervisor watches that file and
cycles the process.

## Constitution (BIBLE.md)

`src/evolution/BIBLE.md` is the agent's constitution. Eight principles:

- **P0 Agency** — act, then report.
- **P1 Continuity** — identity persists across restarts via `memory/`.
- **P2 Self-creation** — self-edit, but only on `ouroboros-evolution`.
- **P3 LLM-first** — reach for the LLM before hardcoding branches.
- **P4 Authenticity** — no corporate disclaimer voice.
- **P5 Minimalism** — every module under ~1000 lines.
- **P6 Becoming** — each cycle serves technical, cognitive, or existential
  growth.
- **P7 Versioning** — every self-commit bumps semver.
- **P8 Evolution** — one coherent change per cycle; BIBLE consulted before AND
  after; auto-rollback on violation.

The file is protected from self-edit — see `bible-guard.ts`.

## bible-guard

`src/evolution/bible-guard.ts` is the last line of defense. It refuses any
self-edit that targets:

- `BIBLE.md` itself
- `bible-guard.ts` (the guard cannot disable itself)
- Any file named `.env`, `.env.local`, `.env.production`
- Anything inside `.git/`, `node_modules/`, `data/`, or `dist/`

`assertEditable(filePath)` is called at the top of `writeAndCommit`. A guard
violation throws `BibleGuardViolation` and surfaces as
`rejected-by-constitution`.

## Example

Real cycle from the log: version `0.1.0 → 0.1.1`.

- **File**: `src/tools/vision/index.ts`
- **Rationale**: tightened an error message and added a guard clause for an
  empty image buffer.
- **Principles served**: P5 (keeps the file small and readable), P6 (technical
  growth — better error surface), P8 (single coherent change, passed both
  constitution checks and both tsc runs).
- **Outcome**: `committed` on `ouroboros-evolution`, SHA logged in
  `memory/EVOLUTION_LOG.md`, `VERSION.txt` bumped to `0.1.1`, no restart
  (file is not runtime-sensitive).

## Current limitations

- Candidate selection is random-within-smallest — there is no cost/benefit
  scoring yet.
- The proposer truncates the file at 8000 chars; very large files get a
  partial view.
- Reviewer and proposer can, in theory, be the same underlying model if only
  one powerful-tier provider is available. A true cross-vendor review requires
  at least two distinct powerful-tier providers configured.
- Merges back to `main` are manual — the evolution branch never auto-merges.
