export type NodeType =
  | 'trigger_cron' | 'trigger_webhook' | 'trigger_event'
  | 'ai_agent' | 'http_request' | 'send_email' | 'send_message'
  | 'condition' | 'loop_foreach'
  | 'set_variable' | 'wait' | 'end';

export interface WorkflowNode {
  id:      string;
  type:    NodeType;
  label:   string;
  config:  Record<string, unknown>;
  nextId?: string;   // happy path
  elseId?: string;   // condition false branch
}

export interface WorkflowDefinition {
  id:           string;
  userId:       string;
  name:         string;
  description?: string;
  nodes:        WorkflowNode[];
  enabled:      boolean;
  createdAt:    string;
  lastRunAt?:   string;
  runCount:     number;
}

export interface WorkflowRunLog {
  workflowId:    string;
  startedAt:     string;
  finishedAt?:   string;
  status:        'running' | 'completed' | 'failed';
  nodeId:        string;
  variables:     Record<string, unknown>;
  logs:          { nodeId: string; ts: string; status: 'ok' | 'error'; output?: unknown }[];
  error?:        string;
}
