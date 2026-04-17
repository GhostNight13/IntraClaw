import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { AgentTask } from '../types';
import {
  SELF_EVOLUTION_BRANCH,
  ensureBranch,
  preCommitGate,
  multiModelReview,
  writeAndCommit,
  rollback,
  requestRestart,
  getLastCommitDiff,
  PreCommitGateError,
  ForbiddenBranchError,
  BibleGuardViolation,
} from './self-commit';
import { checkAlignment } from './constitution-check';
import { isProtected } from './bible-guard';
import { bumpVersion, readVersion } from './version';

/**
 * evolution-engine — Ouroboros loop orchestrator.
 *
 * One `runEvolutionCycle(trigger)` call:
 *   1. Picks a source file to improve
 *   2. Asks the LLM for a proposal (new content + rationale)
 *   3. Pre-commit constitution check
 *   4. tsc --noEmit pre-commit gate
 *   5. Multi-model safety review
 *   6. Writes + commits on ouroboros-evolution branch
 *   7. Post-commit constitution re-check → rollback on violation
 *   8. Bumps VERSION (patch) and logs to memory/EVOLUTION_LOG.md
 *   9. Optionally signals a restart if the change touches runtime
 */

const REPO_ROOT = process.cwd();
const EVOLUTION_LOG = path.resolve(REPO_ROOT, 'memory', 'EVOLUTION_LOG.md');
const SRC_ROOT = path.resolve(REPO_ROOT, 'src');

// File extensions that can be self-edited
const EDITABLE_EXTS = new Set<string>(['.ts', '.md']);

// Runtime-sensitive paths — if the diff touches any, we request a restart at cycle end.
const RUNTIME_SENSITIVE = [
  path.resolve(SRC_ROOT, 'index.ts'),
  path.resolve(SRC_ROOT, 'server.ts'),
  path.resolve(SRC_ROOT, 'loop'),
  path.resolve(SRC_ROOT, 'channels'),
  path.resolve(SRC_ROOT, 'scheduler.ts'),
];

export type CycleOutcome =
  | 'committed'
  | 'committed-and-restarted'
  | 'rejected-by-constitution'
  | 'rejected-by-reviewer'
  | 'rejected-by-tsc'
  | 'rolled-back'
  | 'no-candidate'
  | 'error';

export interface CycleResult {
  outcome: CycleOutcome;
  trigger: string;
  filePath?: string;
  sha?: string;
  versionBefore: string;
  versionAfter: string;
  rationale?: string;
  violations?: string[];
  reviewerReason?: string;
  error?: string;
  durationMs: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runEvolutionCycle(trigger: string): Promise<CycleResult> {
  const startedAt = Date.now();
  const versionBefore = readVersion();
  logger.info('EvolutionEngine', `Cycle started (trigger=${trigger}, version=${versionBefore})`);

  try {
    // Ensure we're on the self-evolution branch BEFORE doing anything destructive.
    ensureBranch(SELF_EVOLUTION_BRANCH);

    // 1. Pick a candidate file
    const candidate = pickCandidateFile();
    if (!candidate) {
      logger.warn('EvolutionEngine', 'No candidate file found — cycle skipped');
      return finalize('no-candidate', trigger, startedAt, versionBefore, versionBefore, {});
    }
    logger.info('EvolutionEngine', `Candidate: ${path.relative(REPO_ROOT, candidate)}`);

    // 2. Ask the LLM for a proposal
    const proposal = await proposeChange(candidate);
    if (!proposal) {
      return finalize('no-candidate', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
      });
    }

    const { newContent, rationale, commitMessage, restartRequired } = proposal;

    // 3. Pre-commit constitution check (on the proposed diff-like description)
    const pseudoDiff = buildPseudoDiff(candidate, newContent);
    const preCheck = await checkAlignment(pseudoDiff, rationale);
    if (!preCheck.aligned) {
      logger.warn('EvolutionEngine', 'Pre-commit constitution check FAILED', preCheck.violations);
      return finalize('rejected-by-constitution', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
        rationale,
        violations: preCheck.violations,
      });
    }

    // 4. Pre-commit gate (tsc --noEmit) — run BEFORE writing, so we know the
    //    baseline is green; we'll re-run it AFTER the write as well.
    try {
      preCommitGate();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('EvolutionEngine', 'Baseline tsc FAILED — aborting cycle', message);
      return finalize('rejected-by-tsc', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
        rationale,
        error: `baseline tsc failed: ${message.slice(0, 500)}`,
      });
    }

    // 5. Multi-model review of the proposed diff
    const review = await multiModelReview(pseudoDiff, rationale);
    if (!review.approved) {
      logger.warn('EvolutionEngine', 'Multi-model reviewer REJECTED the change', review.reason);
      return finalize('rejected-by-reviewer', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
        rationale,
        reviewerReason: review.reason,
      });
    }

    // 6. Write + commit on evolution branch
    const commit = writeAndCommit(candidate, newContent, commitMessage);

    // 7. Post-write tsc (catches the case where the change itself breaks types)
    try {
      preCommitGate();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('EvolutionEngine', 'Post-write tsc FAILED — rolling back', message);
      safeRollback();
      return finalize('rolled-back', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
        sha: commit.sha,
        rationale,
        error: `post-write tsc: ${message.slice(0, 500)}`,
      });
    }

    // 8. Post-commit constitution re-check against the ACTUAL commit diff
    const actualDiff = getLastCommitDiff();
    const postCheck = await checkAlignment(actualDiff, rationale);
    if (!postCheck.aligned) {
      logger.warn('EvolutionEngine', 'Post-commit constitution check FAILED — rolling back',
        postCheck.violations);
      safeRollback();
      return finalize('rolled-back', trigger, startedAt, versionBefore, versionBefore, {
        filePath: candidate,
        sha: commit.sha,
        rationale,
        violations: postCheck.violations,
      });
    }

    // 9. Bump VERSION (patch) and log
    const versionAfter = bumpVersion('patch');
    appendEvolutionLog({
      trigger,
      filePath: path.relative(REPO_ROOT, candidate),
      sha: commit.sha,
      versionBefore,
      versionAfter,
      rationale,
      insertions: commit.insertions,
      deletions: commit.deletions,
    });

    // 10. Optional restart signal
    if (restartRequired || touchesRuntime(candidate)) {
      requestRestart(`self-evolution v${versionAfter}`);
      return finalize('committed-and-restarted', trigger, startedAt, versionBefore, versionAfter, {
        filePath: candidate,
        sha: commit.sha,
        rationale,
      });
    }

    return finalize('committed', trigger, startedAt, versionBefore, versionAfter, {
      filePath: candidate,
      sha: commit.sha,
      rationale,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Any structural refusal (forbidden branch, guard violation, tsc missing) ends up here.
    logger.error('EvolutionEngine', 'Cycle aborted with error', message);

    if (err instanceof ForbiddenBranchError || err instanceof BibleGuardViolation) {
      // These are safety refusals — surface them distinctly.
      return finalize('rejected-by-constitution', trigger, startedAt, versionBefore, versionBefore, {
        error: message,
      });
    }
    if (err instanceof PreCommitGateError) {
      return finalize('rejected-by-tsc', trigger, startedAt, versionBefore, versionBefore, {
        error: message.slice(0, 800),
      });
    }
    return finalize('error', trigger, startedAt, versionBefore, versionBefore, {
      error: message.slice(0, 800),
    });
  }
}

// ─── File selection ───────────────────────────────────────────────────────────

function pickCandidateFile(): string | null {
  // Strategy: pick the smallest editable .ts file under src/ that is NOT protected.
  // Small = higher chance a single-cycle edit fits and type-checks cleanly.
  const all = walk(SRC_ROOT).filter(f =>
    EDITABLE_EXTS.has(path.extname(f)) && !isProtected(f)
  );
  if (all.length === 0) return null;

  const withSize = all.map(f => ({ f, size: safeStatSize(f) })).filter(x => x.size > 0);
  withSize.sort((a, b) => a.size - b.size);

  // Pick randomly within the smallest 20% to add variety over cycles.
  const topN = Math.max(1, Math.floor(withSize.length * 0.2));
  const pool = withSize.slice(0, topN);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick ? pick.f : null;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      walk(full, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function safeStatSize(f: string): number {
  try { return fs.statSync(f).size; } catch { return 0; }
}

function touchesRuntime(filePath: string): boolean {
  const abs = path.resolve(filePath);
  return RUNTIME_SENSITIVE.some(p => abs === p || abs.startsWith(p + path.sep));
}

// ─── LLM proposal ─────────────────────────────────────────────────────────────

interface Proposal {
  newContent: string;
  rationale: string;
  commitMessage: string;
  restartRequired: boolean;
}

async function proposeChange(filePath: string): Promise<Proposal | null> {
  const original = fs.readFileSync(filePath, 'utf8');
  const bible = fs.readFileSync(path.resolve(__dirname, 'BIBLE.md'), 'utf8');

  // Grab a tiny slice of the live memory so the proposal is grounded in identity.
  let soul = '';
  try {
    soul = fs.readFileSync(path.resolve(REPO_ROOT, 'memory', 'SOUL.md'), 'utf8');
  } catch { /* optional */ }

  const prompt = `Tu es IntraClaw en train d'améliorer ton propre code (boucle Ouroboros).

BIBLE (constitution) :
${bible}

SOUL (mission) :
${soul.slice(0, 2000)}

FICHIER CIBLE : ${path.relative(REPO_ROOT, filePath)}

CONTENU ACTUEL :
\`\`\`
${original.slice(0, 8000)}${original.length > 8000 ? '\n…[truncated]' : ''}
\`\`\`

Propose UNE amélioration cohérente et limitée à ce fichier (P8 : un changement cohérent par cycle).
Exemples : ajout d'un commentaire éclairant, petit refactor, meilleur nommage, guard clause, correction de typo, clarification d'une erreur.
N'INTRODUIS PAS de nouvelles dépendances. N'ÉCRIS PAS de secrets. NE TOUCHE PAS à main/master.

Réponds STRICTEMENT au format JSON sur plusieurs lignes :
{
  "newContent": "…contenu complet du fichier après modification…",
  "rationale": "Pourquoi cette amélioration sert P0..P8",
  "commitMessage": "<50 char en anglais, style conventional-commits sans le type (ex: 'clarify ambiguity gate error')>",
  "restartRequired": false
}

Si aucune amélioration valable ne vient, renvoie : {"skip": true, "reason": "…"}`;

  const response = await ask({
    messages: [
      { role: 'system', content: 'You are IntraClaw improving your own code. Output strict JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 4000,
    modelTier: 'powerful',
    task: AgentTask.MAINTENANCE,
  });

  return parseProposal(response.content, original);
}

function parseProposal(raw: string, original: string): Proposal | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    logger.warn('EvolutionEngine', 'Proposer returned non-JSON output');
    return null;
  }
  try {
    const obj = JSON.parse(match[0]) as {
      newContent?: unknown;
      rationale?: unknown;
      commitMessage?: unknown;
      restartRequired?: unknown;
      skip?: unknown;
      reason?: unknown;
    };

    if (obj.skip === true) {
      logger.info('EvolutionEngine', 'Proposer skipped', {
        reason: typeof obj.reason === 'string' ? obj.reason : 'n/a',
      });
      return null;
    }

    if (typeof obj.newContent !== 'string'
      || typeof obj.rationale !== 'string'
      || typeof obj.commitMessage !== 'string') {
      logger.warn('EvolutionEngine', 'Proposer returned malformed fields');
      return null;
    }

    // Refuse no-op proposals
    if (obj.newContent.trim() === original.trim()) {
      logger.info('EvolutionEngine', 'Proposer returned identical content — skipping');
      return null;
    }

    return {
      newContent: obj.newContent,
      rationale: obj.rationale,
      commitMessage: obj.commitMessage.slice(0, 120),
      restartRequired: obj.restartRequired === true,
    };
  } catch (err) {
    logger.warn('EvolutionEngine', 'Proposer JSON parse failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPseudoDiff(filePath: string, newContent: string): string {
  const relative = path.relative(REPO_ROOT, filePath);
  const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  // Give the reviewer enough signal without shipping raw file dumps — snippets only.
  const origHead = original.split('\n').slice(0, 40).join('\n');
  const newHead  = newContent.split('\n').slice(0, 40).join('\n');
  return `--- a/${relative}\n${origHead}\n...\n+++ b/${relative}\n${newHead}\n...`;
}

function safeRollback(): void {
  try { rollback(); } catch (err) {
    logger.error('EvolutionEngine', 'Rollback FAILED', err instanceof Error ? err.message : err);
  }
}

// ─── EVOLUTION_LOG.md ─────────────────────────────────────────────────────────

interface LogEntry {
  trigger: string;
  filePath: string;
  sha: string;
  versionBefore: string;
  versionAfter: string;
  rationale: string;
  insertions: number;
  deletions: number;
}

function appendEvolutionLog(entry: LogEntry): void {
  try {
    const dir = path.dirname(EVOLUTION_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(EVOLUTION_LOG)) {
      fs.writeFileSync(EVOLUTION_LOG,
        '# EVOLUTION_LOG.md\n\nChronologie des auto-commits Ouroboros.\n\n', 'utf8');
    }
    const ts = new Date().toISOString();
    const md = [
      `## ${entry.versionAfter} — ${ts}`,
      ``,
      `- **Trigger**: \`${entry.trigger}\``,
      `- **File**: \`${entry.filePath}\``,
      `- **SHA**: \`${entry.sha.slice(0, 12)}\``,
      `- **Stats**: +${entry.insertions} / -${entry.deletions}`,
      `- **Version**: ${entry.versionBefore} → ${entry.versionAfter}`,
      ``,
      `> ${entry.rationale.replace(/\n/g, '\n> ')}`,
      ``,
    ].join('\n');
    fs.appendFileSync(EVOLUTION_LOG, md + '\n', 'utf8');
  } catch (err) {
    logger.warn('EvolutionEngine', 'Failed to append EVOLUTION_LOG', err instanceof Error ? err.message : err);
  }
}

export function readEvolutionLog(): string {
  if (!fs.existsSync(EVOLUTION_LOG)) return '';
  return fs.readFileSync(EVOLUTION_LOG, 'utf8');
}

// ─── Finalize helper ──────────────────────────────────────────────────────────

function finalize(
  outcome: CycleOutcome,
  trigger: string,
  startedAt: number,
  versionBefore: string,
  versionAfter: string,
  extras: Partial<CycleResult>,
): CycleResult {
  const result: CycleResult = {
    outcome,
    trigger,
    versionBefore,
    versionAfter,
    durationMs: Date.now() - startedAt,
    ...extras,
  };
  logger.info('EvolutionEngine', `Cycle ended: ${outcome} (${result.durationMs}ms)`);
  return result;
}
