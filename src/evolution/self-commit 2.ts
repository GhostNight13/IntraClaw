import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { AgentTask } from '../types';
import { assertEditable, BibleGuardViolation } from './bible-guard';

/**
 * self-commit — low-level primitives for IntraClaw's Ouroboros loop.
 *
 * These functions let the agent modify its own source tree, but only on the
 * dedicated `ouroboros-evolution` branch. `main`/`master` are hard-blocked at
 * every entry point. Callers should layer the evolution-engine's constitution
 * check on top — these primitives intentionally do the minimum required to be
 * safe in isolation.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const SELF_EVOLUTION_BRANCH = 'ouroboros-evolution';

/** Branches that self-commit primitives must NEVER touch. */
const FORBIDDEN_BRANCHES = new Set<string>(['main', 'master']);

const GIT_TIMEOUT_MS = 30_000;
const TSC_TIMEOUT_MS = 180_000;
const REPO_ROOT = process.cwd();

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ForbiddenBranchError extends Error {
  constructor(branch: string) {
    super(`Refused: self-evolution cannot operate on forbidden branch "${branch}".`);
    this.name = 'ForbiddenBranchError';
  }
}

export class PreCommitGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreCommitGateError';
  }
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function git(args: string, opts: { cwd?: string; allowFail?: boolean } = {}): string {
  const cwd = opts.cwd ?? REPO_ROOT;
  try {
    const out = execSync(`git ${args}`, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    });
    return out.trim();
  } catch (err) {
    if (opts.allowFail) return '';
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args} failed: ${message}`);
  }
}

function getCurrentBranch(): string {
  return git('rev-parse --abbrev-ref HEAD');
}

function assertBranchAllowed(branch: string): void {
  if (FORBIDDEN_BRANCHES.has(branch)) {
    throw new ForbiddenBranchError(branch);
  }
}

/**
 * Ensures we are on `branchName`. Creates it from the current HEAD if needed.
 * Refuses to create or switch to `main`/`master`.
 */
export function ensureBranch(branchName: string = SELF_EVOLUTION_BRANCH): void {
  assertBranchAllowed(branchName);

  const current = getCurrentBranch();
  if (current === branchName) return;

  // Does the branch exist locally?
  const exists = git(`rev-parse --verify --quiet ${branchName}`, { allowFail: true });
  if (exists) {
    git(`checkout ${branchName}`);
    logger.info('SelfCommit', `Switched to existing branch ${branchName} (was on ${current})`);
  } else {
    git(`checkout -b ${branchName}`);
    logger.info('SelfCommit', `Created and switched to new branch ${branchName} (was on ${current})`);
  }
}

// ─── Pre-commit gate ──────────────────────────────────────────────────────────

export interface PreCommitGateResult {
  ok: boolean;
  output: string;
  durationMs: number;
}

/**
 * Runs `npx tsc --noEmit` to verify the working tree still type-checks.
 * Throws `PreCommitGateError` if tsc is missing or reports errors.
 */
export function preCommitGate(): PreCommitGateResult {
  const start = Date.now();
  try {
    const output = execSync('npx tsc --noEmit', {
      cwd: REPO_ROOT,
      timeout: TSC_TIMEOUT_MS,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env },
    });
    const durationMs = Date.now() - start;
    logger.info('SelfCommit', `Pre-commit gate passed (tsc --noEmit) in ${durationMs}ms`);
    return { ok: true, output, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const raw = err instanceof Error && 'stdout' in err
      ? String((err as NodeJS.ErrnoException & { stdout?: unknown }).stdout ?? err.message)
      : err instanceof Error ? err.message : String(err);
    logger.error('SelfCommit', 'Pre-commit gate FAILED (tsc --noEmit)', raw.slice(0, 2000));
    throw new PreCommitGateError(`tsc --noEmit failed:\n${raw}`);
  }
}

// ─── Multi-model review ───────────────────────────────────────────────────────

export interface MultiModelReview {
  approved: boolean;
  reason: string;
  raw: string;
}

/**
 * Asks the powerful-tier LLM to judge whether a proposed diff is safe and aligned
 * with IntraClaw's purpose. A second opinion by an LLM different from the one that
 * proposed the change.
 *
 * The caller should block the commit if `approved === false`.
 */
export async function multiModelReview(diff: string, rationale: string): Promise<MultiModelReview> {
  const trimmedDiff = diff.length > 12_000 ? diff.slice(0, 12_000) + '\n…[truncated]' : diff;

  const prompt = `Tu es le reviewer de sécurité d'IntraClaw. Un autre modèle propose la modification de code suivante.

RATIONALE DU PROPOSEUR :
${rationale}

DIFF :
\`\`\`diff
${trimmedDiff}
\`\`\`

Réponds STRICTEMENT au format JSON sur une seule ligne :
{"approved": true|false, "reason": "…"}

Règles :
- approved=false si le diff touche main/master, supprime BIBLE.md, introduit des secrets, désactive une sécurité, ou s'éloigne de la mission d'IntraClaw (agent IA personnel autonome).
- approved=true seulement si le changement est safe ET aligné avec la mission.
- reason: 1-2 phrases max.`;

  const response = await ask({
    messages: [
      { role: 'system', content: 'You are a strict code-safety reviewer. Output valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 400,
    modelTier: 'powerful',
    task: AgentTask.MAINTENANCE,
  });

  const raw = response.content.trim();
  const parsed = safeParseReview(raw);
  logger.info('SelfCommit', `Multi-model review: approved=${parsed.approved}`, { reason: parsed.reason });
  return { ...parsed, raw };
}

function safeParseReview(raw: string): { approved: boolean; reason: string } {
  // Extract first {...} block — be permissive, LLMs sometimes add prose
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) {
    return { approved: false, reason: 'Reviewer returned unparseable output' };
  }
  try {
    const obj = JSON.parse(match[0]) as { approved?: unknown; reason?: unknown };
    return {
      approved: obj.approved === true,
      reason: typeof obj.reason === 'string' ? obj.reason : 'no reason provided',
    };
  } catch {
    return { approved: false, reason: 'Reviewer returned invalid JSON' };
  }
}

// ─── Write + commit ───────────────────────────────────────────────────────────

export interface SelfCommitResult {
  sha: string;
  branch: string;
  filePath: string;
  insertions: number;
  deletions: number;
}

/**
 * Writes `newContent` to `filePath` and commits it to the self-evolution branch.
 *
 * Guards:
 * - `bible-guard.assertEditable` rejects protected files.
 * - Current branch must NOT be main/master — switches to SELF_EVOLUTION_BRANCH if needed.
 * - Caller is responsible for running `preCommitGate` and `multiModelReview` first.
 */
export function writeAndCommit(
  filePath: string,
  newContent: string,
  commitMessage: string,
): SelfCommitResult {
  const absolutePath = path.resolve(filePath);
  assertEditable(absolutePath);

  // Switch to the evolution branch BEFORE writing — never mutate user's working tree on main.
  ensureBranch(SELF_EVOLUTION_BRANCH);
  const branch = getCurrentBranch();
  assertBranchAllowed(branch);

  // Ensure parent directory exists
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(absolutePath, newContent, 'utf8');
  logger.info('SelfCommit', `Wrote ${absolutePath} (${newContent.length} bytes)`);

  // Stage only this file — never `git add -A`.
  const relativePath = path.relative(REPO_ROOT, absolutePath);
  git(`add -- "${relativePath}"`);

  // Double-check the branch right before commit (paranoia).
  const finalBranch = getCurrentBranch();
  assertBranchAllowed(finalBranch);

  const safeMessage = commitMessage.replace(/"/g, '\\"');
  git(`commit -m "ouroboros: ${safeMessage}" --no-verify`);

  const sha = git('rev-parse HEAD');

  // Parse insertions/deletions from last commit
  const shortStat = git('show --shortstat --format= HEAD', { allowFail: true });
  const insertions = Number(shortStat.match(/(\d+) insertion/)?.[1] ?? 0);
  const deletions  = Number(shortStat.match(/(\d+) deletion/)?.[1] ?? 0);

  logger.info('SelfCommit', `Committed ${sha.slice(0, 7)} on ${finalBranch}`, {
    filePath: relativePath, insertions, deletions,
  });

  return { sha, branch: finalBranch, filePath: relativePath, insertions, deletions };
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

export interface RollbackResult {
  rolledBackSha: string;
  newHeadSha: string;
  branch: string;
}

/**
 * `git reset --hard HEAD~1` on the self-evolution branch only.
 * Refuses to run on main/master, or if there's no commit to roll back to.
 */
export function rollback(): RollbackResult {
  const branch = getCurrentBranch();
  assertBranchAllowed(branch);

  if (branch !== SELF_EVOLUTION_BRANCH) {
    throw new Error(
      `Rollback refused: current branch is "${branch}", expected "${SELF_EVOLUTION_BRANCH}".`
    );
  }

  const currentSha = git('rev-parse HEAD');

  // Sanity: must have a parent to roll back to
  const parent = git('rev-parse HEAD~1', { allowFail: true });
  if (!parent) {
    throw new Error('Rollback refused: no parent commit (branch has a single commit).');
  }

  git('reset --hard HEAD~1');
  const newHead = git('rev-parse HEAD');
  logger.warn('SelfCommit', `Rolled back ${currentSha.slice(0, 7)} → ${newHead.slice(0, 7)}`);

  return { rolledBackSha: currentSha, newHeadSha: newHead, branch };
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

/** Diff between the last commit and HEAD~1, used for post-commit review & logging. */
export function getLastCommitDiff(): string {
  return git('show HEAD', { allowFail: true });
}

/** Diff of working-tree changes staged for the next commit. */
export function getStagedDiff(): string {
  return git('diff --cached', { allowFail: true });
}

// ─── Restart signal ───────────────────────────────────────────────────────────

export const RESTART_SIGNAL_FILE = path.join(REPO_ROOT, 'data', 'evolution-restart.signal');

/**
 * Touches a signal file that a supervisor (pm2, docker healthcheck, our own
 * autonomous loop) can poll to trigger a graceful restart. We intentionally
 * avoid `process.kill` — the caller decides when to actually cycle the process.
 */
export function requestRestart(reason: string = 'self-evolution cycle'): void {
  const dir = path.dirname(RESTART_SIGNAL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = JSON.stringify({
    requestedAt: new Date().toISOString(),
    reason,
    pid: process.pid,
  }, null, 2);
  fs.writeFileSync(RESTART_SIGNAL_FILE, payload, 'utf8');
  logger.warn('SelfCommit', `Restart requested → ${RESTART_SIGNAL_FILE}`, { reason });
}

/** Re-export guard error so callers can distinguish it. */
export { BibleGuardViolation };
