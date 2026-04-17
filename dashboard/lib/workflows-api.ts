const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export type NodeType =
  | 'trigger_cron'
  | 'ai_agent'
  | 'http_request'
  | 'condition'
  | 'wait'
  | 'set_variable'
  | 'send_message'
  | 'end';

export interface WorkflowNodeConfig {
  cron?: string;
  prompt?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: string;
  condition?: string;
  delay?: number;
  key?: string;
  value?: string;
  channel?: string;
  message?: string;
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: WorkflowNodeConfig;
  position: { x: number; y: number };
  next?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  runCount: number;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | 'running' | null;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  return request<WorkflowDefinition[]>('/workflows');
}

export async function getWorkflow(id: string): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`/workflows/${id}`);
}

export async function createWorkflow(
  data: Partial<WorkflowDefinition>,
): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>('/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWorkflow(
  id: string,
  patch: Partial<WorkflowDefinition>,
): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request<void>(`/workflows/${id}`, { method: 'DELETE' });
}

export async function runWorkflow(id: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/workflows/${id}/run`, { method: 'POST' });
}
