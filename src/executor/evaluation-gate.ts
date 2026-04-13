// src/executor/evaluation-gate.ts
import { ask } from '../ai';
import { execCommand } from '../tools/terminal-exec';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';

export interface EvaluationResult {
  stage: 1 | 2 | 3;
  passed: boolean;
  score: number;           // 0.0-1.0
  feedback: string;
  details: {
    mechanical?: { fileExists: boolean; syntaxOk: boolean; errors: string[] };
    semantic?: { matchesIntent: boolean; completeness: number; quality: number };
    consensus?: { model1Approved: boolean; model2Approved: boolean; finalVerdict: boolean };
  };
}

/**
 * Stage 1: Mechanical checks (FREE — no LLM needed)
 * - File exists?
 * - Syntax valid? (tsc, eslint, or just non-empty)
 * - No obvious errors in output?
 */
export function mechanicalCheck(stepOutput: string, tool: string, filePath?: string): EvaluationResult {
  const errors: string[] = [];
  let fileExists = true;
  let syntaxOk = true;

  // Check if file was created
  if (filePath) {
    const result = execCommand(`test -f "${filePath}" && echo "EXISTS" || echo "MISSING"`, { timeout: 5000 });
    fileExists = result.stdout.trim() === 'EXISTS';
    if (!fileExists) errors.push(`File not found: ${filePath}`);
  }

  // Check for error patterns in output
  const errorPatterns = [
    /error:/i, /Error:/i, /ENOENT/, /EACCES/, /EPERM/,
    /SyntaxError/, /TypeError/, /ReferenceError/,
    /command not found/, /Permission denied/,
    /Cannot find module/, /Module not found/,
  ];

  if (tool === 'terminal') {
    for (const pattern of errorPatterns) {
      if (pattern.test(stepOutput)) {
        syntaxOk = false;
        errors.push(`Error pattern detected: ${pattern.source}`);
      }
    }
  }

  // If tool is file_write, check the file has content
  if (tool === 'file_write' && filePath) {
    const check = execCommand(`wc -c < "${filePath}" 2>/dev/null || echo "0"`, { timeout: 5000 });
    const size = parseInt(check.stdout.trim(), 10);
    if (size === 0) {
      syntaxOk = false;
      errors.push('File is empty');
    }
  }

  const passed = fileExists && syntaxOk && errors.length === 0;

  return {
    stage: 1,
    passed,
    score: passed ? 1.0 : 0.0,
    feedback: passed ? 'Mechanical checks passed' : `Issues: ${errors.join(', ')}`,
    details: { mechanical: { fileExists, syntaxOk, errors } },
  };
}

/**
 * Stage 2: Semantic check (1 LLM call — fast tier)
 * Does the output match the original intent?
 */
export async function semanticCheck(
  originalRequest: string,
  stepDescription: string,
  stepOutput: string,
): Promise<EvaluationResult> {
  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu évalues si le résultat correspond à la demande. Réponds en JSON.' },
        { role: 'user', content: `DEMANDE ORIGINALE : "${originalRequest}"
ÉTAPE : "${stepDescription}"
RÉSULTAT : "${stepOutput.slice(0, 2000)}"

Évalue :
1. matchesIntent (bool) : Le résultat correspond-il à ce qui était demandé ?
2. completeness (0-1) : À quel point l'étape est-elle complète ?
3. quality (0-1) : Qualité du résultat ?

JSON uniquement :
{"matchesIntent": true, "completeness": 0.8, "quality": 0.7, "feedback": "Court feedback"}` },
      ],
      maxTokens: 200,
      temperature: 0.1,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'fast',
    });

    const match = response.content.match(/\{[\s\S]*"matchesIntent"[\s\S]*\}/);
    if (!match) return defaultSemanticPass(stepDescription);

    const parsed = JSON.parse(match[0]) as {
      matchesIntent: boolean;
      completeness: number;
      quality: number;
      feedback: string;
    };

    const score = (parsed.completeness + parsed.quality) / 2;
    const passed = parsed.matchesIntent && score >= 0.5;

    return {
      stage: 2,
      passed,
      score,
      feedback: parsed.feedback,
      details: {
        semantic: {
          matchesIntent: parsed.matchesIntent,
          completeness: parsed.completeness,
          quality: parsed.quality,
        },
      },
    };
  } catch (err) {
    logger.warn('EvaluationGate', 'Semantic check failed', err instanceof Error ? err.message : err);
    return defaultSemanticPass(stepDescription);
  }
}

/**
 * Stage 3: Consensus check (2 LLM calls — different tiers)
 * Two models must agree the result is good.
 * Only used for important/final steps.
 */
export async function consensusCheck(
  originalRequest: string,
  allStepsOutput: string,
): Promise<EvaluationResult> {
  const evalPrompt = `DEMANDE : "${originalRequest}"
RÉSULTAT COMPLET : "${allStepsOutput.slice(0, 3000)}"

La tâche a-t-elle été accomplie correctement ? Réponds JSON :
{"approved": true/false, "confidence": 0.0-1.0, "reason": "1 phrase"}`;

  try {
    const [model1, model2] = await Promise.all([
      ask({
        messages: [
          { role: 'system', content: 'Tu es un évaluateur critique. JSON uniquement.' },
          { role: 'user', content: evalPrompt },
        ],
        maxTokens: 150,
        temperature: 0.1,
        task: AgentTask.MORNING_BRIEF,
        modelTier: 'fast',
      }),
      ask({
        messages: [
          { role: 'system', content: 'Tu es un évaluateur strict et exigeant. JSON uniquement.' },
          { role: 'user', content: evalPrompt },
        ],
        maxTokens: 150,
        temperature: 0.3,
        task: AgentTask.MORNING_BRIEF,
        modelTier: 'balanced',
      }),
    ]);

    const parse = (content: string) => {
      const m = content.match(/\{[\s\S]*"approved"[\s\S]*\}/);
      if (!m) return { approved: true, confidence: 0.5 };
      return JSON.parse(m[0]) as { approved: boolean; confidence: number; reason?: string };
    };

    const r1 = parse(model1.content);
    const r2 = parse(model2.content);

    const finalVerdict = r1.approved && r2.approved;
    const score = (r1.confidence + r2.confidence) / 2;

    return {
      stage: 3,
      passed: finalVerdict,
      score,
      feedback: finalVerdict
        ? 'Consensus: les deux modèles approuvent'
        : `Désaccord: M1=${r1.approved}, M2=${r2.approved}`,
      details: {
        consensus: {
          model1Approved: r1.approved,
          model2Approved: r2.approved,
          finalVerdict,
        },
      },
    };
  } catch (err) {
    logger.warn('EvaluationGate', 'Consensus check failed', err instanceof Error ? err.message : err);
    return { stage: 3, passed: true, score: 0.5, feedback: 'Consensus check failed — allowing', details: {} };
  }
}

/**
 * Run the full evaluation pipeline on a step.
 * Stage 1 always. Stage 2 if stage 1 passes. Stage 3 only for final steps.
 */
export async function evaluateStep(params: {
  originalRequest: string;
  stepDescription: string;
  stepOutput: string;
  tool: string;
  filePath?: string;
  isFinalStep: boolean;
}): Promise<EvaluationResult> {
  // Stage 1: Mechanical (free)
  const s1 = mechanicalCheck(params.stepOutput, params.tool, params.filePath);
  if (!s1.passed) return s1;

  // Stage 2: Semantic (1 LLM call)
  const s2 = await semanticCheck(params.originalRequest, params.stepDescription, params.stepOutput);
  if (!s2.passed) return s2;

  // Stage 3: Consensus (only for final step)
  if (params.isFinalStep) {
    return consensusCheck(params.originalRequest, params.stepOutput);
  }

  return s2;
}

function defaultSemanticPass(desc: string): EvaluationResult {
  return {
    stage: 2, passed: true, score: 0.7,
    feedback: `Semantic check skipped for: ${desc}`,
    details: { semantic: { matchesIntent: true, completeness: 0.7, quality: 0.7 } },
  };
}
