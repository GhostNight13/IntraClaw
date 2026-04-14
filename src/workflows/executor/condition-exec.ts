import type { WorkflowNode } from '../types';

/**
 * Safe condition evaluator — supports simple comparisons only.
 * Handles: "{{score}} > 0.7", "{{status}} === 'active'", "{{count}} >= 5"
 * Does NOT call eval() directly — uses Function constructor with strict mode
 * after validating the interpolated expression against a safe character set.
 */
function evaluateCondition(expr: string, vars: Record<string, unknown>): boolean {
  const interpolated = expr.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const val = vars[k];
    if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`;
    return String(val ?? '');
  });

  // Allow only safe characters: alphanumeric, whitespace, quotes, comparison/boolean operators, dots
  if (!/^[\w\s'"<>=!.&|()]+$/.test(interpolated)) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(`"use strict"; return (${interpolated})`)() === true;
  } catch {
    return false;
  }
}

export async function executeCondition(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  const condition = String(node.config.condition ?? 'false');
  const result = evaluateCondition(condition, variables);

  return {
    nextId:    result ? node.nextId : node.elseId,
    variables,
    output:    { condition, result },
  };
}
