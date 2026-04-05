// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ProspectStatus {
  NEW         = 'new',
  CONTACTED   = 'contacted',
  REPLIED     = 'replied',
  DEMO_BOOKED = 'demo_booked',
  CONVERTED   = 'converted',
  REJECTED    = 'rejected',
}

export enum EmailType {
  COLD_OUTREACH = 'cold_outreach',
  FOLLOW_UP     = 'follow_up',
  PROPOSAL      = 'proposal',
  ONBOARDING    = 'onboarding',
}

export enum ContentPlatform {
  LINKEDIN  = 'linkedin',
  INSTAGRAM = 'instagram',
  TWITTER   = 'twitter',
}

export enum AgentTask {
  MORNING_BRIEF  = 'morning_brief',
  PROSPECTING    = 'prospecting',
  CONTENT        = 'content',
  COLD_EMAIL     = 'cold_email',
  EVENING_REPORT = 'evening_report',
  MAINTENANCE    = 'maintenance',
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Prospect {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone?: string;
  website?: string;
  industry: string;
  location: string;
  status: ProspectStatus;
  source: string;          // e.g. "google_maps", "linkedin", "referral"
  painPoints: string[];
  notes: string;
  createdAt: string;       // ISO date
  lastContactedAt?: string;
  convertedAt?: string;
}

export interface ColdEmail {
  id: string;
  prospectId: string;
  type: EmailType;
  subject: string;
  body: string;
  sentAt?: string;
  openedAt?: string;
  repliedAt?: string;
  generatedBy: 'claude' | 'gemma' | 'llama';
  templateVersion: number;
}

export interface ContentPost {
  id: string;
  platform: ContentPlatform;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  scheduledFor?: string;  // ISO date
  publishedAt?: string;
  generatedBy: 'claude' | 'gemma' | 'llama';
  topic: string;
}

export interface DailyReport {
  id: string;
  date: string;            // YYYY-MM-DD
  prospectsFound: number;
  emailsSent: number;
  repliesReceived: number;
  contentPublished: number;
  costEur: number;
  apiCalls: number;
  highlights: string[];
  blockers: string[];
  nextActions: string[];
  generatedAt: string;
}

export interface AgentResult<T = unknown> {
  task: AgentTask;
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  model: 'claude' | 'gemma' | 'llama' | 'none';
  tokensUsed?: number;
  costEur?: number;
  timestamp: string;
}

// ─── AI provider types ────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  task?: AgentTask;
}

export interface AIResponse {
  content: string;
  model: 'claude' | 'gemma' | 'llama';
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ─── Memory types ─────────────────────────────────────────────────────────────

export interface MemoryFile {
  filename: string;
  content: string;
  loadedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  task?: AgentTask;
}

export interface ConversationBuffer {
  messages: ConversationMessage[];
  totalMessages: number;
  compactedAt?: string;
}

// ─── Scheduler types ──────────────────────────────────────────────────────────

export interface ScheduledJob {
  name: string;
  cronExpression: string;
  task: AgentTask;
  lastRunAt?: string;
  nextRunAt?: string;
  enabled: boolean;
}
