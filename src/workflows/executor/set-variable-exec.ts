import type { WorkflowNode } from '../types';

export async function executeSetVariable(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  const key   = String(node.config.key ?? '');
  const value = node.config.value;

  if (!key) {
    return { nextId: node.nextId, variables, output: { skipped: 'no key' } };
  }

  const updatedVars = { ...variables, [key]: value };
  return { nextId: node.nextId, variables: updatedVars, output: { key, value } };
}
