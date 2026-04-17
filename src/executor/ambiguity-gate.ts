// src/executor/ambiguity-gate.ts
import { ask } from '../ai';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';

export interface AmbiguityResult {
  score: number;              // 0.0 (parfaitement clair) à 1.0 (totalement flou)
  canProceed: boolean;        // score <= 0.3
  questions: string[];        // Questions à poser si trop flou
  clarifiedRequest?: string;  // Version clarifiée si score <= 0.3
  breakdown: {
    goalClarity: number;      // 0-1 : on sait CE QU'il veut ?
    constraintClarity: number;// 0-1 : on sait les LIMITES ?
    successClarity: number;   // 0-1 : on sait quand c'est FINI ?
  };
}

const AMBIGUITY_THRESHOLD = 0.7; // permissif — agir plutôt que bloquer

/**
 * Analyse une demande et retourne un score d'ambiguïté.
 * Si trop flou → retourne des questions Socratiques à poser.
 */
export async function evaluateAmbiguity(request: string): Promise<AmbiguityResult> {
  logger.info('AmbiguityGate', `Evaluating: "${request.slice(0, 80)}..."`);

  const prompt = `Tu es un analyste de clarté. Évalue cette demande utilisateur.

RÈGLE IMPORTANTE : Si tu peux deviner l'intention de l'utilisateur, même vaguement, le score doit être BAS (< 0.5).
On préfère AGIR et se tromper que de BLOQUER l'utilisateur avec des questions.
"Crée une app" = clair (on sait qu'il veut une app). "Fais un truc" = flou.

DEMANDE : "${request}"

Score 0.0 = parfaitement clair, 1.0 = totalement impossible à comprendre.
Score > 0.7 SEULEMENT si on ne sait VRAIMENT PAS ce que l'utilisateur veut.

Réponds UNIQUEMENT en JSON :
{
  "goalClarity": 0.2,
  "constraintClarity": 0.5,
  "successClarity": 0.3,
  "score": 0.32,
  "questions": [],
  "clarifiedRequest": "reformule la demande"
}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu analyses la clarté des demandes. Réponds en JSON uniquement.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 400,
      temperature: 0.1,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'fast',
    });

    const match = response.content.match(/\{[\s\S]*"score"[\s\S]*\}/);
    if (!match) {
      logger.warn('AmbiguityGate', 'Failed to parse response — allowing execution');
      return defaultResult(request);
    }

    const parsed = JSON.parse(match[0]) as {
      goalClarity: number;
      constraintClarity: number;
      successClarity: number;
      score: number;
      questions: string[];
      clarifiedRequest?: string;
    };

    const result: AmbiguityResult = {
      score: Math.max(0, Math.min(1, parsed.score)),
      canProceed: parsed.score <= AMBIGUITY_THRESHOLD,
      questions: parsed.questions ?? [],
      clarifiedRequest: parsed.clarifiedRequest,
      breakdown: {
        goalClarity: parsed.goalClarity,
        constraintClarity: parsed.constraintClarity,
        successClarity: parsed.successClarity,
      },
    };

    logger.info('AmbiguityGate', `Score: ${result.score.toFixed(2)} — ${result.canProceed ? 'CLEAR' : 'AMBIGUOUS'}`);
    return result;
  } catch (err) {
    logger.error('AmbiguityGate', 'Evaluation failed', err instanceof Error ? err.message : err);
    return defaultResult(request);
  }
}

/**
 * Re-évalue après avoir reçu des réponses aux questions.
 */
export async function clarifyAndReevaluate(
  originalRequest: string,
  answers: string,
): Promise<AmbiguityResult> {
  const enrichedRequest = `${originalRequest}\n\nPRÉCISIONS : ${answers}`;
  return evaluateAmbiguity(enrichedRequest);
}

function defaultResult(request: string): AmbiguityResult {
  return {
    score: 0.0,
    canProceed: true,
    questions: [],
    clarifiedRequest: request,
    breakdown: { goalClarity: 0, constraintClarity: 0, successClarity: 0 },
  };
}
