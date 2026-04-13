// src/reasoning/action-planner.ts
import { ask } from '../ai';
import { buildCompressedPrompt } from '../memory/core';
import { PerceptionContext, LoopAction, LoopActionType, AgentTask, Goal } from '../types';
import { getPrioritizedGoals } from './goal-manager';
import { getSkillIndex } from '../skills/skill-loader';
import { logger } from '../utils/logger';

const ACTION_TYPE_TO_TASK: Partial<Record<LoopActionType, AgentTask>> = {
  prospecting:    AgentTask.PROSPECTING,
  cold_email:     AgentTask.COLD_EMAIL,
  content:        AgentTask.CONTENT,
  reply_check:    AgentTask.MORNING_BRIEF,
  morning_brief:  AgentTask.MORNING_BRIEF,
  evening_report: AgentTask.EVENING_REPORT,
  maintenance:    AgentTask.MAINTENANCE,
};

function formatContext(ctx: PerceptionContext): string {
  return `ÉTAT SYSTÈME :
- Heure Brussels : ${ctx.hour}h (${ctx.timeOfDay})
- Jour ouvrable : ${ctx.isBusinessDay ? 'Oui' : 'Non (weekend)'}
- Utilisateur actif : ${ctx.isUserActive ? 'Oui' : 'Non (idle)'}
- App active : ${ctx.activeApp}
- CPU : ${ctx.cpuUsage}%

EMAILS :
- Non-lus : ${ctx.unreadEmailCount}
- Réponses prospects : ${ctx.prospectRepliesCount} (⚠️ URGENT si > 0)

PIPELINE PROSPECTS :
- Nouveaux (à contacter) : ${ctx.prospectsNew}
- Contactés : ${ctx.prospectsContacted}
- Ayant répondu : ${ctx.prospectsReplied}
- Emails envoyés aujourd'hui : ${ctx.emailsSentToday}/20

HISTORIQUE :
- Dernière action : ${ctx.lastActionType ?? 'aucune'} à ${ctx.lastActionAt ?? 'jamais'}
- Dernière prospection : ${ctx.lastProspectionAt ?? 'jamais'}
- Échecs consécutifs : ${ctx.consecutiveFailures}
- Itération boucle : ${ctx.loopIteration}`;
}

function formatGoals(goals: Goal[]): string {
  if (goals.length === 0) return 'Aucun objectif actif.';
  return goals.slice(0, 5).map((g, i) =>
    `${i + 1}. [${g.priority.toUpperCase()}] ${g.title} — ${g.successCriteria}`
  ).join('\n');
}

function defaultWait(reason: string): LoopAction {
  return { type: 'wait', reason, urgency: 1, estimatedDurationMs: 300000 };
}

export async function decidNextAction(ctx: PerceptionContext): Promise<LoopAction> {
  const goals = getPrioritizedGoals();

  const prompt = `Tu es IntraClaw, un agent IA autonome. Tu dois décider de la PROCHAINE ACTION à effectuer maintenant.

${formatContext(ctx)}

OBJECTIFS ACTIFS (par priorité) :
${formatGoals(goals)}

SKILLS DISPONIBLES :
${getSkillIndex()}

RÈGLES DE DÉCISION :
1. Si prospectRepliesCount > 0 → reply_check est URGENT (priorité absolue)
2. Si heure entre 7h-8h ET isBusinessDay ET lastActionType !== 'morning_brief' aujourd'hui → morning_brief
3. Si isBusinessDay ET prospectsNew < 10 ET (lastProspectionAt est null OU > 2h) → prospecting
4. Si isBusinessDay ET emailsSentToday < 15 ET prospectsNew > 5 → cold_email
5. Si isBusinessDay ET heure entre 9h-10h → content (si pas encore fait aujourd'hui)
6. Si heure >= 18 ET heure < 19 ET isBusinessDay → evening_report
7. Si heure === 3 ET dayOfWeek === 0 (dimanche) → maintenance
8. Si consecutiveFailures >= 5 → notify_user avec message d'alerte
9. Sinon → wait

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"type":"prospecting|cold_email|content|reply_check|morning_brief|evening_report|maintenance|wait|notify_user","reason":"1 phrase expliquant pourquoi cette action maintenant","urgency":7,"estimatedDurationMs":120000}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildCompressedPrompt() },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   200,
      temperature: 0.2,
      task:        AgentTask.MORNING_BRIEF,
      modelTier:   'fast',  // Simple JSON classification — cheap model
    });

    const jsonMatch = response.content.match(/\{[\s\S]*?"type"[\s\S]*?\}/);
    if (!jsonMatch) {
      logger.warn('ActionPlanner', 'No JSON in Claude response — defaulting to wait');
      return defaultWait('Claude response parse failed');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      type: LoopActionType;
      reason: string;
      urgency: number;
      estimatedDurationMs: number;
      notificationMessage?: string;
    };

    const action: LoopAction = {
      type:                parsed.type,
      reason:              parsed.reason,
      urgency:             Math.min(10, Math.max(1, parsed.urgency ?? 5)),
      estimatedDurationMs: parsed.estimatedDurationMs ?? 60000,
      agentTask:           ACTION_TYPE_TO_TASK[parsed.type],
      notificationMessage: parsed.notificationMessage,
    };

    logger.info('ActionPlanner', `Decision: ${action.type} (urgency ${action.urgency}) — ${action.reason}`);
    return action;

  } catch (err) {
    logger.error('ActionPlanner', 'Failed to decide action', err instanceof Error ? err.message : err);
    return defaultWait('Planning error: ' + (err instanceof Error ? err.message : 'unknown'));
  }
}
