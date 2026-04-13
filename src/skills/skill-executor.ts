// src/skills/skill-executor.ts
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { Skill } from './skill-loader';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';
import type { AgentResult } from '../types';

export async function executeSkill(skill: Skill, context: string): Promise<AgentResult> {
  const startMs = Date.now();
  logger.info('SkillExecutor', `Executing skill: ${skill.name}`);

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: `${skill.prompt}\n\n---\nContexte système:\n${buildSystemPrompt()}` },
        { role: 'user',   content: context },
      ],
      maxTokens:   1000,
      temperature: 0.5,
      task:        AgentTask.MORNING_BRIEF,
      modelTier:   'balanced',
    });

    return {
      task:       AgentTask.MORNING_BRIEF,
      success:    true,
      data:       { skillId: skill.id, response: response.content },
      durationMs: Date.now() - startMs,
      model:      response.model,
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    return {
      task:       AgentTask.MORNING_BRIEF,
      success:    false,
      error:      err instanceof Error ? err.message : 'unknown',
      durationMs: Date.now() - startMs,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}
