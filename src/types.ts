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

/** Model routing tiers — controls cost vs quality tradeoff */
export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  task?: AgentTask;
  modelTier?: ModelTier;  // default: 'balanced'
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

// ─── Autonomous Loop Types ────────────────────────────────────────────────────

export interface PerceptionContext {
  timestamp: string;            // ISO8601
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  isBusinessDay: boolean;       // Lun-Ven, pas férié belge
  hour: number;                 // 0-23 Brussels time
  dayOfWeek: number;            // 0=Sunday, 6=Saturday

  // Système
  cpuUsage: number;             // % 0-100
  batteryLevel: number;         // % 0-100 (-1 si branché secteur)
  activeApp: string;            // "Google Chrome", "Code", etc.
  isUserActive: boolean;        // Mouse/keyboard < 5 min

  // Emails
  unreadEmailCount: number;
  prospectRepliesCount: number; // Emails de prospects contactés

  // Business
  prospectsNew: number;         // Status=NEW dans Notion
  prospectsContacted: number;
  prospectsReplied: number;
  emailsSentToday: number;
  lastProspectionAt: string | null;  // ISO8601

  // Agent state
  lastActionAt: string | null;  // ISO8601
  lastActionType: string | null;
  consecutiveFailures: number;
  loopIteration: number;
}

export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed';
export type GoalTimeframe = 'now' | 'today' | 'this_week' | 'ongoing';

export interface Goal {
  id: string;                   // uuid
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  timeframe: GoalTimeframe;
  successCriteria: string;      // "3 nouveaux prospects convertis"
  relatedTask?: AgentTask;      // Lien vers tâche existante si applicable
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type LoopActionType =
  | 'prospecting'
  | 'cold_email'
  | 'content'
  | 'reply_check'
  | 'morning_brief'
  | 'evening_report'
  | 'maintenance'
  | 'wait'          // Pas d'action urgente — attendre prochain cycle
  | 'notify_user';  // Envoyer message Telegram à Ayman

export interface LoopAction {
  type: LoopActionType;
  reason: string;               // Pourquoi cette action maintenant ?
  urgency: number;              // 1-10
  estimatedDurationMs: number;
  agentTask?: AgentTask;        // Si mappé à tâche existante
  notificationMessage?: string; // Si type='notify_user'
}

export interface LoopState {
  running: boolean;
  iteration: number;
  startedAt: string;
  lastPerceptionAt: string | null;
  lastActionAt: string | null;
  lastActionType: LoopActionType | null;
  consecutiveFailures: number;
  totalActionsToday: number;
  paused: boolean;
  pauseReason?: string;
}
