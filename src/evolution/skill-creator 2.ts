// src/evolution/skill-creator.ts
// Creates a reusable learned-skill from a successful multi-step task execution.
// Flow: generate-skill-spec → critic verify → persist via skillLibrary.addSkill.
import { ask } from '../ai';
import { logger } from '../utils/logger';
import { AgentTask } from '../types';
import { skillLibrary, type LearnedSkillSummary } from './skill-library';
import { verifySkillResult } from './critic';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionStepSnapshot {
  stepNumber: number;
  description: string;
  tool: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface ExecutionResult {
  steps: ExecutionStepSnapshot[];
  finalOutput?: string;
  status: 'completed' | 'failed' | 'planning' | 'executing';
}

export interface SkillSpec {
  name: string;              // snake_case, <= 60 chars
  summary: string;           // one-liner
  code: string;              // TS function stub OR tool-spec JSON
  tags: string[];
  reusable: boolean;         // creator's self-assessment
}

export interface CreateSkillResult {
  created: boolean;
  skill?: LearnedSkillSummary;
  reason?: string;
  verification?: { verified: boolean; critique: string };
}

// ─── Skill spec generation ────────────────────────────────────────────────────

const SKILL_GENERATION_SYSTEM = `You distill successful agent task executions into reusable skills for IntraClaw's learned-skill library.
Rules:
- Skill NAME: snake_case, verb-first, under 60 chars (e.g. "scrape_google_maps_prospects").
- Skill CODE: one self-contained TypeScript function stub — pure, parameterized, no side-effects beyond clearly-named tool calls.
- Prefer parameters over hardcoded values. Replace concrete URLs/names/paths with parameters.
- If the task was too one-off to ever reuse, set reusable=false.
Respond with ONE JSON object, no markdown fences, no prose.`;

async function generateSkillSpec(
  taskRequest: string,
  plan: string,
  execution: ExecutionResult,
): Promise<SkillSpec | null> {
  const stepsDigest = execution.steps
    .filter(s => s.success)
    .slice(0, 12)
    .map(s => `[${s.stepNumber}] ${s.tool}: ${s.description}\n  → ${s.output.slice(0, 250)}`)
    .join('\n');

  const prompt = `TASK REQUEST:
${taskRequest}

EXECUTION PLAN:
${plan.slice(0, 1500)}

SUCCESSFUL STEPS (${execution.steps.filter(s => s.success).length}):
${stepsDigest}

FINAL OUTPUT:
${(execution.finalOutput ?? '').slice(0, 1000)}

Produce a JSON skill spec:
{
  "name": "snake_case_name",
  "summary": "one sentence — what and when",
  "code": "export async function skillName(params: { /* typed params */ }): Promise<unknown> {\\n  // implementation outline with tool calls\\n}",
  "tags": ["tag1", "tag2"],
  "reusable": true
}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: SKILL_GENERATION_SYSTEM },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1200,
      temperature: 0.2,
      task: AgentTask.MAINTENANCE,
      modelTier: 'balanced',
    });

    const parsed = extractJsonObject(response.content);
    if (!parsed) return null;
    if (typeof parsed.name !== 'string' || typeof parsed.code !== 'string') return null;

    const name = sanitizeName(parsed.name);
    if (!name) return null;

    return {
      name,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      code: parsed.code,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t): t is string => typeof t === 'string').slice(0, 10)
        : [],
      reusable: parsed.reusable !== false,
    };
  } catch (err) {
    logger.warn('SkillCreator', 'skill-spec generation failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateSkillOptions {
  /** Skip the critic check (used when the caller already verified the result). */
  skipCritic?: boolean;
  /** Minimum number of successful steps required before we try to learn anything. */
  minSuccessfulSteps?: number;
}

/**
 * Called after a multi-step task completes successfully.
 * Decides whether the run is worth turning into a reusable skill, verifies with the critic,
 * and persists to the library if verified.
 */
export async function createSkillFromTask(
  taskRequest: string,
  plan: string,
  execution: ExecutionResult,
  options: CreateSkillOptions = {},
): Promise<CreateSkillResult> {
  const minSteps = options.minSuccessfulSteps ?? 2;

  if (execution.status !== 'completed') {
    return { created: false, reason: 'Execution not completed' };
  }
  const successful = execution.steps.filter(s => s.success);
  if (successful.length < minSteps) {
    return { created: false, reason: `Only ${successful.length} successful steps (need ${minSteps})` };
  }

  // 1. Generate a skill spec.
  const spec = await generateSkillSpec(taskRequest, plan, execution);
  if (!spec) return { created: false, reason: 'Could not generate a valid skill spec' };
  if (!spec.reusable) return { created: false, reason: 'Creator judged the task non-reusable' };

  // 2. Ask the critic — did this run actually satisfy the user's goal?
  let verification: { verified: boolean; critique: string } = { verified: true, critique: 'skipped' };
  if (!options.skipCritic) {
    verification = await verifySkillResult(
      spec.name,
      { taskRequest },
      { finalOutput: execution.finalOutput, successfulSteps: successful.length },
      taskRequest,
    );
    if (!verification.verified) {
      logger.info('SkillCreator', `Skill "${spec.name}" rejected by critic: ${verification.critique}`);
      return { created: false, reason: 'Critic did not verify', verification };
    }
  }

  // 3. Persist.
  try {
    const { skill, bumpedVersion } = await skillLibrary.addSkill(
      spec.name,
      spec.code,
      `${taskRequest}\n\nSummary: ${spec.summary}`,
      { tags: spec.tags, descriptionOverride: spec.summary || undefined },
    );
    logger.info(
      'SkillCreator',
      `${bumpedVersion ? 'Bumped' : 'Learned new'} skill "${skill.name}" (v${skill.version})`,
    );
    return { created: true, skill, verification };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('SkillCreator', 'persist failed', msg);
    return { created: false, reason: `Persist failed: ${msg}`, verification };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeName(raw: string): string | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return normalized.length > 0 ? normalized : null;
}

interface SpecJson {
  name?: unknown;
  summary?: unknown;
  code?: unknown;
  tags?: unknown;
  reusable?: unknown;
}

function extractJsonObject(raw: string): SpecJson | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned) as SpecJson;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as SpecJson;
    } catch {
      return null;
    }
  }
}
