import { ask } from '../../ai';
import type { WorkflowNode } from '../types';

/** Interpolate {{variable}} placeholders in a string. */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export async function executeAgent(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  const rawPrompt = String(node.config.prompt ?? '');
  const prompt = interpolate(rawPrompt, variables);

  const response = await ask({
    messages: [{ role: 'user', content: prompt }],
    modelTier: (node.config.modelTier as 'fast' | 'balanced' | 'powerful') ?? 'balanced',
  });

  const outputKey = String(node.config.outputVariable ?? `${node.id}_output`);
  const updatedVars = { ...variables, [outputKey]: response.content };

  return { nextId: node.nextId, variables: updatedVars, output: response.content };
}
