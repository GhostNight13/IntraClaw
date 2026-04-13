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

const AMBIGUITY_THRESHOLD = 0.3;

/**
 * Analyse une demande et retourne un score d'ambiguïté.
 * Si trop flou → retourne des questions Socratiques à poser.
 */
export async function evaluateAmbiguity(request: string): Promise<AmbiguityResult> {
  logger.info('AmbiguityGate', `Evaluating: "${request.slice(0, 80)}..."`);

  const prompt = `Tu es un analyste de clarté. Évalue cette demande utilisateur :

DEMANDE : "${request}"

Analyse selon 3 dimensions (score 0.0 = parfaitement clair, 1.0 = totalement flou) :

1. **goalClarity** : Sait-on exactement CE QUE l'utilisateur veut ?
   - 0.0 = "Crée un fichier PDF avec le titre 'Rapport Q1' contenant les ventes par région"
   - 0.5 = "Crée un rapport"
   - 1.0 = "Fais un truc"

2. **constraintClarity** : Sait-on les LIMITES et CONTRAINTES ?
   - 0.0 = "En React, responsive, dark mode, déployé sur Vercel"
   - 0.5 = "Un site web"
   - 1.0 = pas d'info du tout

3. **successClarity** : Sait-on QUAND c'est terminé ?
   - 0.0 = "Le formulaire envoie un email et affiche un message de confirmation"
   - 0.5 = "Ça marche"
   - 1.0 = aucune idée de ce qui est attendu

Score global = goalClarity * 0.4 + constraintClarity * 0.3 + successClarity * 0.3

Si le score global > 0.3, génère 2-4 questions COURTES et PRÉCISES pour clarifier.
Les questions doivent être en français, directes, pas de blabla.

Réponds UNIQUEMENT en JSON :
{
  "goalClarity": 0.2,
  "constraintClarity": 0.5,
  "successClarity": 0.3,
  "score": 0.32,
  "questions": ["Quel format veux-tu ? (PDF, Word, PPT)", "C'est pour quel client ?"],
  "clarifiedRequest": "Si score <= 0.3, reformule la demande de manière claire et exécutable"
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
