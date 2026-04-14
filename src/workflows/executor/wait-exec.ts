import type { WorkflowNode } from '../types';

export async function executeWait(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  const ms = Number(node.config.ms ?? 1000);
  await new Promise<void>(resolve => setTimeout(resolve, ms));
  return { nextId: node.nextId, variables, output: { waited_ms: ms } };
}
