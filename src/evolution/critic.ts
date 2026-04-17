// src/evolution/critic.ts
// Voyager-style CriticAgent: verifies whether a skill actually accomplished the user's goal.
// Only verified skills are persisted to the learned-skill library.
import { ask } from '../ai';
import { logger } from '../utils/logger';
import { AgentTask } from '../types';

export interface CriticResult {
  verified: boolean;
  critique: string;
}

/**
 * Ask the LLM whether executing `skillName(params)` with `result` satisfies `originalGoal`.
 * Robust against malformed JSON: falls back to best-effort parsing and a conservative default.
 */
export async function verifySkillResult(
  skillName: string,
  params: unknown,
  result: unknown,
  originalGoal: string,
): Promise<CriticResult> {
  const paramsStr = safeStringify(params, 1500);
  const resultStr = safeStringify(result, 2500);

  const prompt = `You are the CriticAgent. Judge whether this skill execution truly achieved the user's goal.

ORIGINAL GOAL:
${originalGoal.slice(0, 1500)}

SKILL: ${skillName}

PARAMETERS USED:
${paramsStr}

EXECUTION RESULT:
${resultStr}

Decide strictly:
- success=true ONLY if the result concretely satisfies the goal.
- success=false if the result is empty, an error, tangential, or only partially addresses the goal.

Respond with ONE line of JSON only, no prose, no markdown, no code fences:
{"success": true, "critique": "why it succeeded / what's missing"}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'You are a strict verifier. JSON only, one line, no markdown.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 300,
      temperature: 0,
      task: AgentTask.MAINTENANCE,
      modelTier: 'fast',
    });

    const parsed = extractJson(response.content);
    if (!parsed) {
      logger.warn('Critic', `Could not parse JSON from critic for "${skillName}" — defaulting to unverified`);
      return { verified: false, critique: 'Critic returned unparseable output' };
    }

    const verified = parsed.success === true;
    const critique = typeof parsed.critique === 'string' ? parsed.critique : '';
    logger.info('Critic', `verify(${skillName}) → ${verified ? 'OK' : 'FAIL'}: ${critique.slice(0, 120)}`);
    return { verified, critique };
  } catch (err) {
    logger.warn('Critic', 'verification threw', err instanceof Error ? err.message : err);
    return { verified: false, critique: 'Critic call failed' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStringify(value: unknown, maxLen: number): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return s.slice(0, maxLen);
  } catch {
    return String(value).slice(0, maxLen);
  }
}

interface CriticJson {
  success?: boolean;
  critique?: string;
}

function extractJson(raw: string): CriticJson | null {
  // Strip code fences if present
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  // Try direct parse first
  try {
    return JSON.parse(cleaned) as CriticJson;
  } catch {
    // Try to locate the first {...} block
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as CriticJson;
    } catch {
      return null;
    }
  }
}
