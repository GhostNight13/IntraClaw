// src/executor/wonder-reflect.ts
// Light version of Ouroboros Wonder/Reflect loop for skill auto-improvement
import * as fs from 'fs';
import * as path from 'path';
import { ask } from '../ai';
import { saveSkill } from '../skills/skill-loader';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';
import type { Skill } from '../skills/skill-loader';

const BACKUP_DIR = path.resolve(process.cwd(), 'data', 'skill-backups');

interface WonderOutput {
  gaps: string[];        // What didn't the skill know?
  failures: string[];    // What went wrong?
  surprises: string[];   // What was unexpected?
  suggestions: string[]; // How to improve?
}

interface ReflectOutput {
  shouldUpdate: boolean;
  updatedPrompt?: string;
  updatedTriggers?: string[];
  reasoning: string;
}

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Wonder: "What didn't we know? What went wrong? What was surprising?"
 */
async function wonder(
  taskRequest: string,
  stepsResults: Array<{ description: string; success: boolean; output: string }>,
  skillUsed?: Skill,
): Promise<WonderOutput> {
  const successCount = stepsResults.filter(s => s.success).length;
  const failedSteps = stepsResults.filter(s => !s.success);

  const prompt = `Tu analyses l'exécution d'une tâche pour identifier les améliorations possibles.

TÂCHE : "${taskRequest}"
RÉSULTAT : ${successCount}/${stepsResults.length} étapes réussies

${failedSteps.length > 0 ? `ÉTAPES ÉCHOUÉES :\n${failedSteps.map(s => `- ${s.description}: ${s.output.slice(0, 200)}`).join('\n')}` : 'Aucun échec.'}

${skillUsed ? `SKILL UTILISÉ : ${skillUsed.name}\nPROMPT DU SKILL : ${skillUsed.prompt.slice(0, 300)}` : 'Aucun skill spécifique utilisé.'}

Analyse et réponds en JSON :
{
  "gaps": ["Ce que le système ne savait pas et aurait dû savoir"],
  "failures": ["Ce qui a échoué et pourquoi"],
  "surprises": ["Ce qui était inattendu"],
  "suggestions": ["Améliorations concrètes pour le skill ou le système"]
}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu es un analyste de performance agent. JSON uniquement.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 400,
      temperature: 0.2,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'fast',
    });

    const match = response.content.match(/\{[\s\S]*"gaps"[\s\S]*\}/);
    if (!match) return { gaps: [], failures: [], surprises: [], suggestions: [] };
    return JSON.parse(match[0]) as WonderOutput;
  } catch {
    return { gaps: [], failures: [], surprises: [], suggestions: [] };
  }
}

/**
 * Reflect: "How should the skill evolve based on what we learned?"
 */
async function reflect(
  skill: Skill,
  wonderOutput: WonderOutput,
): Promise<ReflectOutput> {
  if (wonderOutput.suggestions.length === 0 && wonderOutput.gaps.length === 0) {
    return { shouldUpdate: false, reasoning: 'No improvements needed' };
  }

  const prompt = `Tu dois décider si un skill YAML doit être mis à jour.

SKILL ACTUEL :
- Nom : ${skill.name}
- Prompt : ${skill.prompt}
- Triggers : ${skill.triggers.join(', ')}

WONDER ANALYSIS :
- Gaps : ${wonderOutput.gaps.join('; ') || 'Aucun'}
- Failures : ${wonderOutput.failures.join('; ') || 'Aucun'}
- Suggestions : ${wonderOutput.suggestions.join('; ') || 'Aucun'}

Décide :
1. shouldUpdate (bool) : Le prompt du skill doit-il être amélioré ?
2. Si oui, écris le nouveau prompt (COMPLET, pas juste les changements)
3. Si oui, propose de nouveaux triggers si pertinent

IMPORTANT : Ne modifie que si les améliorations sont SIGNIFICATIVES. Pas de changements cosmétiques.

JSON :
{
  "shouldUpdate": true/false,
  "updatedPrompt": "Le nouveau prompt complet si shouldUpdate=true",
  "updatedTriggers": ["trigger1", "trigger2"],
  "reasoning": "Pourquoi mettre à jour ou non"
}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu es un ingénieur de skills IA. JSON uniquement.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      temperature: 0.2,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'balanced',
    });

    const match = response.content.match(/\{[\s\S]*"shouldUpdate"[\s\S]*\}/);
    if (!match) return { shouldUpdate: false, reasoning: 'Parse failed' };
    return JSON.parse(match[0]) as ReflectOutput;
  } catch {
    return { shouldUpdate: false, reasoning: 'Reflect failed' };
  }
}

/**
 * Full Wonder/Reflect cycle after task execution.
 * Analyzes what happened and optionally updates the relevant skill.
 */
export async function wonderReflectCycle(params: {
  taskRequest: string;
  stepsResults: Array<{ description: string; success: boolean; output: string; tool: string }>;
  skillUsed?: Skill;
}): Promise<{
  wonderOutput: WonderOutput;
  reflectOutput: ReflectOutput | null;
  skillUpdated: boolean;
}> {
  logger.info('WonderReflect', `Starting cycle for: "${params.taskRequest.slice(0, 80)}..."`);

  // Phase 1: Wonder
  const wonderOutput = await wonder(
    params.taskRequest,
    params.stepsResults,
    params.skillUsed,
  );

  logger.info('WonderReflect', `Wonder: ${wonderOutput.gaps.length} gaps, ${wonderOutput.suggestions.length} suggestions`);

  // Phase 2: Reflect (only if there's a skill to improve and there are suggestions)
  if (!params.skillUsed || (wonderOutput.suggestions.length === 0 && wonderOutput.gaps.length === 0)) {
    return { wonderOutput, reflectOutput: null, skillUpdated: false };
  }

  const reflectOutput = await reflect(params.skillUsed, wonderOutput);
  logger.info('WonderReflect', `Reflect: shouldUpdate=${reflectOutput.shouldUpdate} — ${reflectOutput.reasoning}`);

  // Phase 3: Apply mutation (with backup)
  if (reflectOutput.shouldUpdate && reflectOutput.updatedPrompt) {
    ensureBackupDir();

    // Backup current skill
    const backupPath = path.join(BACKUP_DIR, `${params.skillUsed.id}-${Date.now()}.yaml`);
    const currentPath = path.join(process.cwd(), 'skills', `${params.skillUsed.id}.yaml`);
    if (fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, backupPath);
      logger.info('WonderReflect', `Skill backed up: ${backupPath}`);
    }

    // Update skill
    const updatedSkill: Skill = {
      ...params.skillUsed,
      prompt: reflectOutput.updatedPrompt,
      triggers: reflectOutput.updatedTriggers ?? params.skillUsed.triggers,
      updatedAt: new Date().toISOString(),
    };

    saveSkill(updatedSkill);
    logger.info('WonderReflect', `Skill updated: ${updatedSkill.name}`);

    return { wonderOutput, reflectOutput, skillUpdated: true };
  }

  return { wonderOutput, reflectOutput, skillUpdated: false };
}
