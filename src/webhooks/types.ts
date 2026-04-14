export type WebhookEventType =
  | 'agent.task'
  | 'notification.send'
  | 'workflow.trigger'
  | 'custom';

export interface WebhookConfig {
  id: string;
  name: string;
  secret: string;
  urlPath: string;
  eventType: WebhookEventType;
  enabled: boolean;
  createdAt: string;
  lastFiredAt: string | null;
  fireCount: number;
}

export interface WebhookFireLog {
  id: string;
  webhookId: string;
  payload: string;
  status: 'success' | 'error';
  error: string | null;
  createdAt: string;
}
