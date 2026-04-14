import type { WorkflowNode } from '../types';

export async function executeEnd(
  _node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  return { nextId: undefined, variables, output: { ended: true } };
}
