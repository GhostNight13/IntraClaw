import type { WorkflowNode } from '../types';

/** Interpolate {{variable}} placeholders in a string. */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export async function executeHttp(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<{ nextId?: string; variables: Record<string, unknown>; output?: unknown }> {
  const url     = interpolate(String(node.config.url ?? ''), variables);
  const method  = String(node.config.method ?? 'GET').toUpperCase();
  const headers = (node.config.headers as Record<string, string>) ?? {};
  const rawBody = node.config.body;

  const fetchOptions: RequestInit = { method, headers };

  if (rawBody !== undefined && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = typeof rawBody === 'string'
      ? interpolate(rawBody, variables)
      : JSON.stringify(rawBody);

    if (!headers['Content-Type'] && !headers['content-type']) {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, fetchOptions);
  let body: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  try {
    body = contentType.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }

  const outputKey = String(node.config.outputVariable ?? `${node.id}_output`);
  const updatedVars = { ...variables, [outputKey]: body };

  return { nextId: node.nextId, variables: updatedVars, output: body };
}
