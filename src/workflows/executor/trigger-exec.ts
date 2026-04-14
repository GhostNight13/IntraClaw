import type { WorkflowNode } from '../types';

/**
 * Trigger nodes (cron / webhook / event) are fired externally.
 * At execution time we simply pass through — variables are already injected
 * by the caller (scheduler or webhook handler).
 */
export async function executeTrigger(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  return { nextId: node.nextId, variables, output: { triggered: true } };
}
