import * as fs from 'fs';
import * as path from 'path';
import { ask } from '../ai';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';

/**
 * constitution-check — consults BIBLE.md and asks the LLM whether a proposed
 * diff upholds IntraClaw's 9 principles. Called before AND after every
 * self-commit by the evolution engine.
 */

const BIBLE_PATH = path.resolve(__dirname, 'BIBLE.md');

export interface AlignmentResult {
  aligned: boolean;
  violations: string[];
  rationale: string;
}

let cachedBible: string | null = null;

function readBible(): string {
  if (cachedBible !== null) return cachedBible;
  if (!fs.existsSync(BIBLE_PATH)) {
    throw new Error(`Constitution missing: ${BIBLE_PATH}`);
  }
  cachedBible = fs.readFileSync(BIBLE_PATH, 'utf8');
  return cachedBible;
}

/** Clears the in-memory BIBLE cache — mostly for tests. */
export function refreshBibleCache(): void {
  cachedBible = null;
}

/**
 * Checks whether a proposed change aligns with the constitution.
 * Returns `aligned=false` with a `violations[]` list if the LLM detects a breach.
 *
 * Fail-safe: if the LLM call errors or returns garbage, returns aligned=false —
 * it is always safer to reject an ambiguous change than to accept it.
 */
export async function checkAlignment(
  proposedChange: string,
  rationale: string,
): Promise<AlignmentResult> {
  const bible = readBible();
  const trimmed = proposedChange.length > 12_000
    ? proposedChange.slice(0, 12_000) + '\n…[truncated]'
    : proposedChange;

  const prompt = `Tu es le gardien constitutionnel d'IntraClaw. Voici la constitution immuable :

--- BIBLE.md ---
${bible}
--- FIN BIBLE ---

Rationale du proposeur :
${rationale}

Diff proposé :
\`\`\`diff
${trimmed}
\`\`\`

Analyse : ce diff respecte-t-il les 9 principes (P0-P8) et le contrat de sûreté ?

Réponds STRICTEMENT au format JSON sur une seule ligne :
{"aligned": true|false, "violations": ["P2: …", "P7: …"], "rationale": "…"}

Règles :
- violations = [] si tout va bien
- Chaque violation cite le principe (P0..P8) suivi d'une explication courte
- aligned=false dès qu'au moins une violation est listée
- rationale: 1-2 phrases qui justifient la décision globale`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'You are the constitutional guardian. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 600,
      modelTier: 'powerful',
      task: AgentTask.MAINTENANCE,
    });

    const parsed = parseAlignment(response.content);
    logger.info('ConstitutionCheck', `aligned=${parsed.aligned}`, {
      violations: parsed.violations.length,
    });
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ConstitutionCheck', 'LLM call failed — defaulting to NOT aligned', message);
    return {
      aligned: false,
      violations: ['guardian: LLM unavailable — fail-closed'],
      rationale: `Could not reach the constitutional guardian (${message}). Failing closed for safety.`,
    };
  }
}

function parseAlignment(raw: string): AlignmentResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      aligned: false,
      violations: ['guardian: unparseable output'],
      rationale: 'Guardian returned non-JSON output; failing closed.',
    };
  }
  try {
    const obj = JSON.parse(match[0]) as {
      aligned?: unknown;
      violations?: unknown;
      rationale?: unknown;
    };
    const violations = Array.isArray(obj.violations)
      ? obj.violations.filter((v): v is string => typeof v === 'string')
      : [];
    return {
      aligned: obj.aligned === true && violations.length === 0,
      violations,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : 'no rationale provided',
    };
  } catch {
    return {
      aligned: false,
      violations: ['guardian: invalid JSON'],
      rationale: 'Guardian returned invalid JSON; failing closed.',
    };
  }
}
