# Autonomous Agent Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer IntraClaw d'un système de jobs cron réactifs en un agent autonome qui vit en permanence sur le Mac d'Ayman, perçoit son environnement, et décide lui-même quoi faire — sans attendre un horaire fixe.

**Architecture:** Remplacer `scheduler.ts` (6 cron jobs fixes) par une boucle autonome `autonomous-loop.ts` (Perception → Reasoning → Action → Observation → repeat). Un module de perception collecte en continu le contexte (emails, heure, système, Telegram). Claude décide de la prochaine action prioritaire via `action-planner.ts`. Les agents existants deviennent des "skills" appelables à la demande plutôt qu'à heure fixe.

**Tech Stack:** Node.js/TypeScript existant · `chokidar` (file watcher) · `systeminformation` (CPU/battery/app actif) · Claude CLI (Max subscription) · SQLite existing · grammy Telegram existing

---

## Fichiers créés / modifiés

### Nouveaux fichiers
| Fichier | Rôle |
|---------|------|
| `src/perception/email-watcher.ts` | Poll Gmail toutes les 5 min, émet des événements si nouveaux emails |
| `src/perception/system-observer.ts` | CPU, batterie, app active, heure Brussels, jour ouvrable |
| `src/perception/context-aggregator.ts` | Agrège tout en `PerceptionContext` snapshot |
| `src/reasoning/goal-manager.ts` | CRUD des goals (court/long terme) + queue de priorité |
| `src/reasoning/action-planner.ts` | Claude décide de la prochaine action en fonction du contexte |
| `src/loop/autonomous-loop.ts` | Boucle principale Perception → Reasoning → Action → Observation |
| `src/loop/observation-recorder.ts` | Log structuré des actions + mise à jour mémoire |

### Fichiers modifiés
| Fichier | Changement |
|---------|-----------|
| `src/types.ts` | +`Goal`, `PerceptionContext`, `LoopState`, `LoopAction` types |
| `src/index.ts` | Démarre `startAutonomousLoop()` au lieu de `startScheduler()` (garde scheduler en fallback) |
| `src/server.ts` | +`GET /api/loop/status`, `GET /api/goals`, `POST /api/goals` endpoints |
| `data/goals.json` | Fichier de persistence des goals (créé au runtime) |

---

## Task 1 — Types (`src/types.ts`)

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1 — Ajouter les types**

Ouvrir `src/types.ts` et ajouter à la fin du fichier :

```typescript
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
```

- [ ] **Step 2 — Vérifier que TypeScript compile**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreur (ou uniquement des erreurs pre-existantes non liées aux nouveaux types)

- [ ] **Step 3 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/types.ts
git commit -m "feat(loop): add PerceptionContext, Goal, LoopAction types"
```

---

## Task 2 — System Observer (`src/perception/system-observer.ts`)

**Files:**
- Create: `src/perception/system-observer.ts`

- [ ] **Step 1 — Installer `systeminformation`**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npm install systeminformation
```

Attendu : `added 1 package`

- [ ] **Step 2 — Créer le fichier**

```typescript
// src/perception/system-observer.ts
import si from 'systeminformation';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface SystemSnapshot {
  cpuUsage: number;
  batteryLevel: number;
  activeApp: string;
  isUserActive: boolean;
  hour: number;
  dayOfWeek: number;
  isBusinessDay: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

function getTimeOfDay(hour: number): SystemSnapshot['timeOfDay'] {
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function isBrusselsBusinessDay(): boolean {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
  const day = now.getDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

function getActiveApp(): string {
  try {
    // macOS only: get frontmost app name
    const script = 'tell application "System Events" to get name of first process whose frontmost is true';
    return execSync(`osascript -e '${script}'`, { timeout: 2000 }).toString().trim();
  } catch {
    return 'unknown';
  }
}

let _lastInputTime = Date.now();

// Call this on mouse/keyboard events — for now we approximate with 5min freshness
function isUserActive(): boolean {
  try {
    // Check if idle time < 5 minutes using ioreg on macOS
    const output = execSync(
      'ioreg -c IOHIDSystem | awk \'/HIDIdleTime/{print $NF/1000000000; exit}\'',
      { timeout: 2000 }
    ).toString().trim();
    const idleSeconds = parseFloat(output);
    return idleSeconds < 300; // < 5 minutes
  } catch {
    return true; // Assume active if check fails
  }
}

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  try {
    const [cpuData, batteryData] = await Promise.all([
      si.currentLoad(),
      si.battery(),
    ]);

    const nowBrussels = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
    );
    const hour = nowBrussels.getHours();
    const dayOfWeek = nowBrussels.getDay();

    return {
      cpuUsage:      Math.round(cpuData.currentLoad),
      batteryLevel:  batteryData.hasBattery ? Math.round(batteryData.percent) : -1,
      activeApp:     getActiveApp(),
      isUserActive:  isUserActive(),
      hour,
      dayOfWeek,
      isBusinessDay: isBrusselsBusinessDay(),
      timeOfDay:     getTimeOfDay(hour),
    };
  } catch (err) {
    logger.warn('SystemObserver', 'Failed to get system snapshot', err instanceof Error ? err.message : err);
    const nowBrussels = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
    );
    const hour = nowBrussels.getHours();
    return {
      cpuUsage:      0,
      batteryLevel:  -1,
      activeApp:     'unknown',
      isUserActive:  true,
      hour,
      dayOfWeek:     nowBrussels.getDay(),
      isBusinessDay: isBrusselsBusinessDay(),
      timeOfDay:     getTimeOfDay(hour),
    };
  }
}
```

- [ ] **Step 3 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/perception/system-observer.ts package.json package-lock.json
git commit -m "feat(perception): system observer — CPU, battery, active app, idle"
```

---

## Task 3 — Email Watcher (`src/perception/email-watcher.ts`)

**Files:**
- Create: `src/perception/email-watcher.ts`

- [ ] **Step 1 — Créer le fichier**

```typescript
// src/perception/email-watcher.ts
import { getUnreadEmails, markAsRead } from '../tools/gmail';
import { getProspectsByStatus } from '../tools/notion';
import { ProspectStatus } from '../types';
import { logger } from '../utils/logger';

export interface EmailSnapshot {
  unreadCount: number;
  prospectRepliesCount: number;
  checkedAt: string;
}

let _lastSnapshot: EmailSnapshot = {
  unreadCount: 0,
  prospectRepliesCount: 0,
  checkedAt: new Date().toISOString(),
};

export async function getEmailSnapshot(): Promise<EmailSnapshot> {
  try {
    const [unread, contactedProspects] = await Promise.all([
      getUnreadEmails(20),
      getProspectsByStatus(ProspectStatus.CONTACTED),
    ]);

    const prospectEmails = new Set(
      contactedProspects
        .map(p => p.email?.toLowerCase())
        .filter(Boolean)
    );

    const prospectReplies = unread.filter(email =>
      prospectEmails.has(email.from.toLowerCase().split('<')[1]?.replace('>', '').trim()
        ?? email.from.toLowerCase())
    );

    _lastSnapshot = {
      unreadCount: unread.length,
      prospectRepliesCount: prospectReplies.length,
      checkedAt: new Date().toISOString(),
    };

    logger.info('EmailWatcher', `Unread: ${unread.length}, prospect replies: ${prospectReplies.length}`);
    return _lastSnapshot;
  } catch (err) {
    logger.warn('EmailWatcher', 'Failed to fetch emails', err instanceof Error ? err.message : err);
    return _lastSnapshot; // Return last known state on error
  }
}

export function getLastEmailSnapshot(): EmailSnapshot {
  return _lastSnapshot;
}
```

- [ ] **Step 2 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/perception/email-watcher.ts
git commit -m "feat(perception): email watcher — unread + prospect replies detection"
```

---

## Task 4 — Context Aggregator (`src/perception/context-aggregator.ts`)

**Files:**
- Create: `src/perception/context-aggregator.ts`

- [ ] **Step 1 — Créer le fichier**

Ce fichier combine toutes les sources de perception en un seul snapshot `PerceptionContext`.

```typescript
// src/perception/context-aggregator.ts
import { getSystemSnapshot } from './system-observer';
import { getEmailSnapshot } from './email-watcher';
import { getProspectsByStatus } from '../tools/notion';
import { ProspectStatus, PerceptionContext } from '../types';
import { getActions } from '../db';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const EMAILS_LOG_PATH = path.resolve(process.cwd(), 'data', 'emails-sent.json');

function getEmailsSentToday(): number {
  try {
    if (!fs.existsSync(EMAILS_LOG_PATH)) return 0;
    const raw = JSON.parse(fs.readFileSync(EMAILS_LOG_PATH, 'utf8')) as Array<{ sentAt: string }>;
    const today = new Date().toISOString().slice(0, 10);
    return raw.filter(e => e.sentAt?.startsWith(today)).length;
  } catch {
    return 0;
  }
}

function getLastAction(actions: Array<{ task: string; timestamp: string; success: number }>): {
  lastActionAt: string | null;
  lastActionType: string | null;
  consecutiveFailures: number;
} {
  if (actions.length === 0) {
    return { lastActionAt: null, lastActionType: null, consecutiveFailures: 0 };
  }

  const lastActionAt   = actions[0].timestamp;
  const lastActionType = actions[0].task;

  let consecutiveFailures = 0;
  for (const a of actions) {
    if (a.success === 0) consecutiveFailures++;
    else break;
  }

  return { lastActionAt, lastActionType, consecutiveFailures };
}

let _iteration = 0;

export async function buildPerceptionContext(): Promise<PerceptionContext> {
  _iteration++;
  logger.info('ContextAggregator', `Building perception context (iteration ${_iteration})`);

  const [system, emails, prospects, recentActions] = await Promise.all([
    getSystemSnapshot(),
    getEmailSnapshot(),
    Promise.all([
      getProspectsByStatus(ProspectStatus.NEW).catch(() => [] as unknown[]),
      getProspectsByStatus(ProspectStatus.CONTACTED).catch(() => [] as unknown[]),
      getProspectsByStatus(ProspectStatus.REPLIED).catch(() => [] as unknown[]),
    ]),
    Promise.resolve(getActions(20)), // Last 20 actions from SQLite
  ]);

  const [prospectsNew, prospectsContacted, prospectsReplied] = prospects;

  // Find last prospection run
  const lastProspection = recentActions.find(a => a.task === 'prospecting');

  const { lastActionAt, lastActionType, consecutiveFailures } = getLastAction(recentActions);

  return {
    timestamp:             new Date().toISOString(),
    timeOfDay:             system.timeOfDay,
    isBusinessDay:         system.isBusinessDay,
    hour:                  system.hour,
    dayOfWeek:             system.dayOfWeek,
    cpuUsage:              system.cpuUsage,
    batteryLevel:          system.batteryLevel,
    activeApp:             system.activeApp,
    isUserActive:          system.isUserActive,
    unreadEmailCount:      emails.unreadCount,
    prospectRepliesCount:  emails.prospectRepliesCount,
    prospectsNew:          prospectsNew.length,
    prospectsContacted:    prospectsContacted.length,
    prospectsReplied:      prospectsReplied.length,
    emailsSentToday:       getEmailsSentToday(),
    lastProspectionAt:     lastProspection?.timestamp ?? null,
    lastActionAt,
    lastActionType,
    consecutiveFailures,
    loopIteration:         _iteration,
  };
}
```

- [ ] **Step 2 — Vérifier que `getActions` existe dans `src/db.ts`**

```bash
grep -n "getActions\|export function" /Users/aymn_idm/Desktop/IntraClaw/src/db.ts | head -20
```

Si `getActions` n'existe pas, l'ajouter dans `src/db.ts` :

```typescript
// À ajouter dans src/db.ts
export function getActions(limit = 50): Array<{
  id: number;
  task: string;
  success: number;
  timestamp: string;
  durationMs: number;
  error: string | null;
}> {
  return db.prepare(
    'SELECT id, task, success, timestamp, duration_ms as durationMs, error FROM agent_actions ORDER BY id DESC LIMIT ?'
  ).all(limit) as Array<{ id: number; task: string; success: number; timestamp: string; durationMs: number; error: string | null }>;
}
```

- [ ] **Step 3 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/perception/ src/db.ts
git commit -m "feat(perception): context aggregator — unified PerceptionContext snapshot"
```

---

## Task 5 — Goal Manager (`src/reasoning/goal-manager.ts`)

**Files:**
- Create: `src/reasoning/goal-manager.ts`

- [ ] **Step 1 — Créer le fichier**

```typescript
// src/reasoning/goal-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Goal, GoalPriority, GoalStatus, GoalTimeframe, AgentTask } from '../types';
import { logger } from '../utils/logger';

const GOALS_PATH = path.resolve(process.cwd(), 'data', 'goals.json');

const PRIORITY_WEIGHT: Record<GoalPriority, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadGoals(): Goal[] {
  try {
    if (!fs.existsSync(GOALS_PATH)) return getDefaultGoals();
    return JSON.parse(fs.readFileSync(GOALS_PATH, 'utf8')) as Goal[];
  } catch {
    return getDefaultGoals();
  }
}

function saveGoals(goals: Goal[]): void {
  const dir = path.dirname(GOALS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(GOALS_PATH, JSON.stringify(goals, null, 2), 'utf8');
}

function getDefaultGoals(): Goal[] {
  const now = new Date().toISOString();
  return [
    {
      id:               randomUUID(),
      title:            'Prospection quotidienne Belgium',
      description:      'Scraper 15-30 nouveaux prospects belges chaque jour ouvrable',
      priority:         'high',
      status:           'active',
      timeframe:        'ongoing',
      successCriteria:  '15+ prospects ajoutés à Notion par jour',
      relatedTask:      AgentTask.PROSPECTING,
      createdAt:        now,
      updatedAt:        now,
    },
    {
      id:               randomUUID(),
      title:            'Cold email outreach',
      description:      'Contacter les prospects NEW avec des cold emails personnalisés FR/NL',
      priority:         'high',
      status:           'active',
      timeframe:        'ongoing',
      successCriteria:  '20 emails envoyés par jour, taux réponse > 5%',
      relatedTask:      AgentTask.COLD_EMAIL,
      createdAt:        now,
      updatedAt:        now,
    },
    {
      id:               randomUUID(),
      title:            'Content LinkedIn hebdomadaire',
      description:      'Publier 3-5 posts LinkedIn par semaine sur web design, IA, SEO',
      priority:         'medium',
      status:           'active',
      timeframe:        'ongoing',
      successCriteria:  '1 post créé par jour ouvrable',
      relatedTask:      AgentTask.CONTENT,
      createdAt:        now,
      updatedAt:        now,
    },
    {
      id:               randomUUID(),
      title:            'Surveillance des réponses prospects',
      description:      'Détecter et traiter les réponses des prospects contactés en temps réel',
      priority:         'critical',
      status:           'active',
      timeframe:        'ongoing',
      successCriteria:  'Toute réponse traitée dans les 30 minutes',
      relatedTask:      AgentTask.MORNING_BRIEF,
      createdAt:        now,
      updatedAt:        now,
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllGoals(): Goal[] {
  return loadGoals();
}

export function getActiveGoals(): Goal[] {
  return loadGoals().filter(g => g.status === 'active');
}

export function addGoal(params: {
  title: string;
  description: string;
  priority: GoalPriority;
  timeframe: GoalTimeframe;
  successCriteria: string;
  relatedTask?: AgentTask;
}): Goal {
  const goals = loadGoals();
  const now = new Date().toISOString();
  const goal: Goal = {
    id:          randomUUID(),
    status:      'active',
    createdAt:   now,
    updatedAt:   now,
    ...params,
  };
  goals.push(goal);
  saveGoals(goals);
  logger.info('GoalManager', `Goal added: ${goal.title}`);
  return goal;
}

export function updateGoalStatus(id: string, status: GoalStatus): void {
  const goals = loadGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal) {
    logger.warn('GoalManager', `Goal not found: ${id}`);
    return;
  }
  goal.status    = status;
  goal.updatedAt = new Date().toISOString();
  if (status === 'completed') goal.completedAt = new Date().toISOString();
  saveGoals(goals);
}

/**
 * Returns goals sorted by priority (critical first) then timeframe (now first).
 */
export function getPrioritizedGoals(): Goal[] {
  const timeframeOrder: Record<GoalTimeframe, number> = {
    now: 4, today: 3, this_week: 2, ongoing: 1,
  };
  return getActiveGoals().sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return timeframeOrder[b.timeframe] - timeframeOrder[a.timeframe];
  });
}
```

- [ ] **Step 2 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/reasoning/goal-manager.ts
git commit -m "feat(reasoning): goal manager — CRUD + prioritized goal queue"
```

---

## Task 6 — Action Planner (`src/reasoning/action-planner.ts`)

**Files:**
- Create: `src/reasoning/action-planner.ts`

C'est le cerveau : Claude reçoit le contexte complet et les goals, et décide de la prochaine action.

- [ ] **Step 1 — Créer le fichier**

```typescript
// src/reasoning/action-planner.ts
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { PerceptionContext, LoopAction, LoopActionType, AgentTask } from '../types';
import { getPrioritizedGoals } from './goal-manager';
import { logger } from '../utils/logger';

const ACTION_TYPE_TO_TASK: Partial<Record<LoopActionType, AgentTask>> = {
  prospecting:    AgentTask.PROSPECTING,
  cold_email:     AgentTask.COLD_EMAIL,
  content:        AgentTask.CONTENT,
  reply_check:    AgentTask.MORNING_BRIEF,
  morning_brief:  AgentTask.MORNING_BRIEF,
  evening_report: AgentTask.EVENING_REPORT,
  maintenance:    AgentTask.MAINTENANCE,
};

function formatContext(ctx: PerceptionContext): string {
  return `
ÉTAT SYSTÈME :
- Heure Brussels : ${ctx.hour}h (${ctx.timeOfDay})
- Jour ouvrable : ${ctx.isBusinessDay ? 'Oui' : 'Non (weekend)'}
- Utilisateur actif : ${ctx.isUserActive ? 'Oui' : 'Non (idle)'}
- App active : ${ctx.activeApp}
- CPU : ${ctx.cpuUsage}%

EMAILS :
- Non-lus : ${ctx.unreadEmailCount}
- Réponses prospects : ${ctx.prospectRepliesCount} (⚠️ URGENT si > 0)

PIPELINE PROSPECTS :
- Nouveaux (à contacter) : ${ctx.prospectsNew}
- Contactés : ${ctx.prospectsContacted}
- Ayant répondu (à suivre) : ${ctx.prospectsReplied}
- Emails envoyés aujourd'hui : ${ctx.emailsSentToday}/20

HISTORIQUE RÉCENT :
- Dernière action : ${ctx.lastActionType ?? 'aucune'} à ${ctx.lastActionAt ?? 'jamais'}
- Dernière prospection : ${ctx.lastProspectionAt ?? 'jamais'}
- Échecs consécutifs : ${ctx.consecutiveFailures}
- Itération boucle : ${ctx.loopIteration}
`.trim();
}

function formatGoals(goals: ReturnType<typeof getPrioritizedGoals>): string {
  if (goals.length === 0) return 'Aucun objectif actif.';
  return goals.slice(0, 5).map((g, i) =>
    `${i + 1}. [${g.priority.toUpperCase()}] ${g.title} — ${g.successCriteria}`
  ).join('\n');
}

export async function decidNextAction(ctx: PerceptionContext): Promise<LoopAction> {
  const goals = getPrioritizedGoals();

  const prompt = `
Tu es IntraClaw, un agent IA autonome. Tu dois décider de la PROCHAINE ACTION à effectuer maintenant.

${formatContext(ctx)}

OBJECTIFS ACTIFS (par priorité) :
${formatGoals(goals)}

RÈGLES DE DÉCISION :
1. Si prospectRepliesCount > 0 → reply_check est URGENT (priorité absolue)
2. Si heure entre 7h-8h ET isBusinessDay ET lastActionType !== 'morning_brief' aujourd'hui → morning_brief
3. Si isBusinessDay ET prospectsNew < 10 ET lastProspectionAt > 2h → prospecting
4. Si isBusinessDay ET emailsSentToday < 15 ET prospectsNew > 5 → cold_email
5. Si isBusinessDay ET heure entre 9h-10h → content (si pas encore fait aujourd'hui)
6. Si heure 18h ET isBusinessDay → evening_report
7. Si heure 3h ET dayOfWeek === 0 (dimanche) → maintenance
8. Si consecutiveFailures >= 5 → notify_user avec message d'alerte
9. Sinon → wait (attendre prochain cycle de 5 min)

Réponds UNIQUEMENT en JSON valide :
{
  "type": "prospecting|cold_email|content|reply_check|morning_brief|evening_report|maintenance|wait|notify_user",
  "reason": "Explication concise en 1 phrase de pourquoi cette action maintenant",
  "urgency": 7,
  "estimatedDurationMs": 120000,
  "notificationMessage": "Message Telegram si type=notify_user, sinon omis"
}
`.trim();

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   200,
      temperature: 0.2,
      task:        AgentTask.MORNING_BRIEF, // Réutilise task existante pour tracking
    });

    const jsonMatch = response.content.match(/\{[\s\S]*"type"[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('ActionPlanner', 'No JSON in Claude response — defaulting to wait');
      return defaultWait('Claude response parse failed');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      type: LoopActionType;
      reason: string;
      urgency: number;
      estimatedDurationMs: number;
      notificationMessage?: string;
    };

    const action: LoopAction = {
      type:                  parsed.type,
      reason:                parsed.reason,
      urgency:               Math.min(10, Math.max(1, parsed.urgency)),
      estimatedDurationMs:   parsed.estimatedDurationMs ?? 60000,
      agentTask:             ACTION_TYPE_TO_TASK[parsed.type],
      notificationMessage:   parsed.notificationMessage,
    };

    logger.info('ActionPlanner', `Decision: ${action.type} (urgency ${action.urgency}) — ${action.reason}`);
    return action;

  } catch (err) {
    logger.error('ActionPlanner', 'Failed to decide action', err instanceof Error ? err.message : err);
    return defaultWait('Planning error: ' + (err instanceof Error ? err.message : 'unknown'));
  }
}

function defaultWait(reason: string): LoopAction {
  return {
    type:                'wait',
    reason,
    urgency:             1,
    estimatedDurationMs: 300000, // 5 min
  };
}
```

- [ ] **Step 2 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/reasoning/action-planner.ts
git commit -m "feat(reasoning): action planner — Claude decides next action from context"
```

---

## Task 7 — Observation Recorder (`src/loop/observation-recorder.ts`)

**Files:**
- Create: `src/loop/observation-recorder.ts`

- [ ] **Step 1 — Créer le fichier**

```typescript
// src/loop/observation-recorder.ts
import { insertAction } from '../db';
import { LoopAction, AgentResult } from '../types';
import { addLearnedFact } from '../memory/enhanced';
import { logger } from '../utils/logger';

export interface Observation {
  action:     LoopAction;
  result:     AgentResult | null;
  startedAt:  string;
  finishedAt: string;
  durationMs: number;
}

/**
 * Record what the agent just did and the outcome.
 * Extracts learnable facts to persist in memory.
 */
export async function recordObservation(obs: Observation): Promise<void> {
  const { action, result, durationMs } = obs;

  // 1. Log to SQLite (existing system)
  insertAction({
    task:       action.type,
    success:    result?.success ?? false,
    durationMs,
    model:      result?.model ?? 'none',
    error:      result?.success === false ? result.error : undefined,
    data:       result?.data ? JSON.stringify(result.data) : undefined,
  });

  // 2. Extract learnable facts from results
  if (result?.success && result.data) {
    const facts = extractFacts(action, result);
    for (const fact of facts) {
      await addLearnedFact(fact).catch(err =>
        logger.warn('ObservationRecorder', 'Failed to save learned fact', err instanceof Error ? err.message : err)
      );
    }
  }

  // 3. Log summary
  const status = result?.success ? '✅' : '❌';
  logger.info(
    'ObservationRecorder',
    `${status} ${action.type} completed in ${durationMs}ms — ${action.reason}`
  );
}

function extractFacts(action: LoopAction, result: AgentResult): string[] {
  const facts: string[] = [];
  const data = result.data as Record<string, unknown> ?? {};
  const date = new Date().toISOString().slice(0, 10);

  switch (action.type) {
    case 'prospecting': {
      const count = data.prospectsAdded as number;
      if (typeof count === 'number' && count > 0) {
        facts.push(`[${date}] Prospection: ${count} nouveaux prospects ajoutés au CRM Notion`);
      }
      break;
    }
    case 'cold_email': {
      const sent = data.emailsSent as number;
      if (typeof sent === 'number' && sent > 0) {
        facts.push(`[${date}] Cold email: ${sent} emails envoyés via Gmail`);
      }
      break;
    }
    case 'content': {
      const topic = data.topic as string;
      if (topic) {
        facts.push(`[${date}] LinkedIn post créé sur le topic: ${topic}`);
      }
      break;
    }
  }

  return facts;
}
```

- [ ] **Step 2 — Vérifier que `insertAction` et `addLearnedFact` ont les bons paramètres**

```bash
grep -n "insertAction\|addLearnedFact\|export function" /Users/aymn_idm/Desktop/IntraClaw/src/db.ts | head -10
grep -n "addLearnedFact\|export" /Users/aymn_idm/Desktop/IntraClaw/src/memory/enhanced.ts | head -10
```

Si `insertAction` a une signature différente, ajuster les paramètres dans `recordObservation` pour correspondre à la signature réelle.

- [ ] **Step 3 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/loop/observation-recorder.ts
git commit -m "feat(loop): observation recorder — log actions + extract learned facts"
```

---

## Task 8 — Autonomous Loop (`src/loop/autonomous-loop.ts`)

**Files:**
- Create: `src/loop/autonomous-loop.ts`

C'est le cœur : la boucle qui tourne en permanence.

- [ ] **Step 1 — Créer le fichier**

```typescript
// src/loop/autonomous-loop.ts
import { buildPerceptionContext } from '../perception/context-aggregator';
import { decidNextAction } from '../reasoning/action-planner';
import { recordObservation } from './observation-recorder';
import { runTask } from '../agents/coordinator';
import { runAutonomous } from '../agents/autonomous-runner';
import { sendTelegramMessage } from '../channels/telegram';
import { broadcastWS } from '../server';
import { LoopState, LoopAction, AgentResult } from '../types';
import { logger } from '../utils/logger';

// ─── Config ───────────────────────────────────────────────────────────────────

const PERCEPTION_INTERVAL_MS = 5  * 60 * 1000; // 5 min between cycles
const MIN_ACTION_GAP_MS       = 30 * 1000;      // Min 30s between actions
const MAX_CONSECUTIVE_WAIT    = 6;              // After 30 min idle → send brief
const WAIT_ACTION_MS          = PERCEPTION_INTERVAL_MS;

// ─── State ────────────────────────────────────────────────────────────────────

let _state: LoopState = {
  running:          false,
  iteration:        0,
  startedAt:        new Date().toISOString(),
  lastPerceptionAt: null,
  lastActionAt:     null,
  lastActionType:   null,
  consecutiveFailures: 0,
  totalActionsToday: 0,
  paused:           false,
};

let _consecutiveWaits = 0;
let _loopTimeout: NodeJS.Timeout | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function getLoopState(): LoopState {
  return { ..._state };
}

export function pauseLoop(reason: string): void {
  _state.paused      = true;
  _state.pauseReason = reason;
  logger.info('AutonomousLoop', `Paused: ${reason}`);
}

export function resumeLoop(): void {
  _state.paused      = false;
  _state.pauseReason = undefined;
  logger.info('AutonomousLoop', 'Resumed');
}

export async function startAutonomousLoop(): Promise<void> {
  if (_state.running) {
    logger.warn('AutonomousLoop', 'Already running — ignoring startAutonomousLoop()');
    return;
  }

  _state.running   = true;
  _state.startedAt = new Date().toISOString();
  logger.info('AutonomousLoop', '=== Autonomous loop started ===');

  await tick(); // First tick immediately
}

export function stopAutonomousLoop(): void {
  _state.running = false;
  if (_loopTimeout) {
    clearTimeout(_loopTimeout);
    _loopTimeout = null;
  }
  logger.info('AutonomousLoop', 'Stopped');
}

// ─── Core tick ────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!_state.running) return;

  _state.iteration++;
  const tickStart = Date.now();

  try {
    if (_state.paused) {
      logger.info('AutonomousLoop', `Paused (${_state.pauseReason}) — skipping tick`);
      scheduleNext(PERCEPTION_INTERVAL_MS);
      return;
    }

    // 1. PERCEPTION — build context snapshot
    logger.info('AutonomousLoop', `=== Tick #${_state.iteration} — Perceiving... ===`);
    const ctx = await buildPerceptionContext();
    _state.lastPerceptionAt = ctx.timestamp;

    broadcastWS({ type: 'loop_perception', iteration: _state.iteration, ctx });

    // 2. REASONING — Claude decides next action
    const action = await decidNextAction(ctx);

    broadcastWS({ type: 'loop_decision', action });

    // 3. ACTION — execute or wait
    if (action.type === 'wait') {
      _consecutiveWaits++;
      logger.info('AutonomousLoop', `Wait decision (${_consecutiveWaits} consecutive) — ${action.reason}`);

      if (_consecutiveWaits >= MAX_CONSECUTIVE_WAIT) {
        _consecutiveWaits = 0;
        await sendTelegramMessage(
          `🤖 IntraClaw en veille depuis ${MAX_CONSECUTIVE_WAIT * 5} min. Tout est calme côté pipeline.`
        ).catch(() => {});
      }

      scheduleNext(WAIT_ACTION_MS);
      return;
    }

    _consecutiveWaits = 0;

    // Respect minimum gap between actions
    const sinceLastAction = _state.lastActionAt
      ? Date.now() - new Date(_state.lastActionAt).getTime()
      : Infinity;

    if (sinceLastAction < MIN_ACTION_GAP_MS) {
      const waitMs = MIN_ACTION_GAP_MS - sinceLastAction;
      logger.info('AutonomousLoop', `Too soon since last action — waiting ${waitMs}ms`);
      scheduleNext(waitMs + 1000);
      return;
    }

    // Execute action
    if (action.type === 'notify_user') {
      await executeNotify(action);
    } else if (action.agentTask) {
      await executeAgentTask(action);
    }

  } catch (err) {
    _state.consecutiveFailures++;
    logger.error('AutonomousLoop', `Tick error (failure #${_state.consecutiveFailures})`,
      err instanceof Error ? err.message : err);

    if (_state.consecutiveFailures >= 5) {
      await sendTelegramMessage(
        `🚨 IntraClaw: ${_state.consecutiveFailures} erreurs consécutives dans la boucle autonome. Vérification requise.`
      ).catch(() => {});
    }
  }

  const elapsed = Date.now() - tickStart;
  const nextIn  = Math.max(1000, PERCEPTION_INTERVAL_MS - elapsed);
  scheduleNext(nextIn);
}

function scheduleNext(delayMs: number): void {
  if (!_state.running) return;
  _loopTimeout = setTimeout(() => {
    tick().catch(err =>
      logger.error('AutonomousLoop', 'Unhandled tick error', err instanceof Error ? err.message : err)
    );
  }, delayMs);
}

async function executeNotify(action: LoopAction): Promise<void> {
  if (!action.notificationMessage) return;
  await sendTelegramMessage(action.notificationMessage);
  _state.lastActionAt   = new Date().toISOString();
  _state.lastActionType = 'notify_user';
  broadcastWS({ type: 'loop_action', action, success: true });
}

async function executeAgentTask(action: LoopAction): Promise<void> {
  if (!action.agentTask) return;

  const startedAt  = new Date().toISOString();
  const startMs    = Date.now();

  logger.info('AutonomousLoop', `Executing: ${action.type} — ${action.reason}`);
  broadcastWS({ type: 'loop_action_start', action });

  let result: AgentResult | null = null;

  try {
    result = await runAutonomous(action.agentTask, runTask, sendTelegramMessage);

    if (result.success) {
      _state.consecutiveFailures = 0;
      _state.totalActionsToday++;
    } else {
      _state.consecutiveFailures++;
    }
  } catch (err) {
    _state.consecutiveFailures++;
    result = {
      task:       action.agentTask,
      success:    false,
      error:      err instanceof Error ? err.message : 'unknown',
      durationMs: Date.now() - startMs,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }

  _state.lastActionAt   = new Date().toISOString();
  _state.lastActionType = action.type;

  const obs = {
    action,
    result,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
  };

  await recordObservation(obs).catch(err =>
    logger.warn('AutonomousLoop', 'recordObservation failed', err instanceof Error ? err.message : err)
  );

  broadcastWS({ type: 'loop_action_done', action, result });
}
```

- [ ] **Step 2 — Vérifier que `broadcastWS` est exportée depuis `src/server.ts`**

```bash
grep -n "broadcastWS\|broadcast\|export" /Users/aymn_idm/Desktop/IntraClaw/src/server.ts | head -20
```

Si `broadcastWS` n'est pas exportée, l'ajouter dans `src/server.ts` :

```typescript
// Dans src/server.ts, ajouter après la création du wss :
export function broadcastWS(data: Record<string, unknown>): void {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
```

- [ ] **Step 3 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/loop/autonomous-loop.ts src/server.ts
git commit -m "feat(loop): autonomous loop — Perception→Reasoning→Action→Observation cycle"
```

---

## Task 9 — Wiring dans `src/index.ts`

**Files:**
- Modify: `src/index.ts`

Remplacer `startScheduler()` par `startAutonomousLoop()`. Garder le scheduler comme fallback optionnel via variable d'env.

- [ ] **Step 1 — Modifier `src/index.ts`**

Remplacer le bloc `main()` entier :

```typescript
// src/index.ts
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger } from './utils/logger';
import { loadMemory } from './memory/core';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { initTelegram, sendTelegramMessage } from './channels/telegram';
import { startServer } from './server';
import { startAutonomousLoop, stopAutonomousLoop, pauseLoop, resumeLoop } from './loop/autonomous-loop';

// Fallback: keep scheduler available for manual trigger only
import { triggerJob } from './scheduler';
import { AgentTask } from './types';

async function main(): Promise<void> {
  logger.info('Main', '=== IntraClaw starting (Autonomous Mode) ===');

  // 1. Load memory files
  const memory = loadMemory();
  logger.info('Main', `Memory ready: ${memory.length} files loaded`);

  // 2. Print status
  const ratioStatus = rateLimiter.getStatus();
  const costStatus  = costTracker.getStatus();
  logger.info('Main', 'Rate limits', ratioStatus);
  logger.info('Main', 'Cost status', costStatus);

  // 3. Init Telegram
  initTelegram();

  // 4. Start API server
  startServer();

  // 5. Start autonomous loop (replaces scheduler)
  await startAutonomousLoop();

  logger.info('Main', 'IntraClaw autonomous — perceiving, deciding, acting. Press Ctrl+C to stop.');

  // 6. Graceful shutdown
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function shutdown(signal: string): void {
  logger.info('Main', `Received ${signal} — shutting down`);
  stopAutonomousLoop();
  process.exit(0);
}

main().catch(err => {
  logger.error('Main', 'Fatal startup error', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2 — Vérifier compilation complète**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1
```

Corriger toutes les erreurs avant de continuer.

- [ ] **Step 3 — Test de démarrage (dry run 30 secondes)**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npm run build && timeout 30 node dist/index.js 2>&1 | head -50
```

Attendu dans les logs :
```
[Main] === IntraClaw starting (Autonomous Mode) ===
[Main] Memory ready: 8 files loaded
[AutonomousLoop] === Autonomous loop started ===
[ContextAggregator] Building perception context (iteration 1)
[ActionPlanner] Decision: ...
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/index.ts
git commit -m "feat: wire autonomous loop as primary runtime — replace scheduler"
```

---

## Task 10 — API endpoints (`src/server.ts`)

**Files:**
- Modify: `src/server.ts`

Ajouter les endpoints pour exposer l'état de la boucle et les goals au dashboard.

- [ ] **Step 1 — Ajouter les routes dans `src/server.ts`**

Trouver la section des routes Express et ajouter :

```typescript
// Ajouter ces imports en haut de src/server.ts :
import { getLoopState, pauseLoop, resumeLoop } from './loop/autonomous-loop';
import { getAllGoals, addGoal, updateGoalStatus, getPrioritizedGoals } from './reasoning/goal-manager';

// Ajouter ces routes dans la fonction startServer() :

// Loop status
app.get('/api/loop/status', (_req, res) => {
  res.json(getLoopState());
});

app.post('/api/loop/pause', (req, res) => {
  const { reason } = req.body as { reason?: string };
  pauseLoop(reason ?? 'Manual pause');
  res.json({ paused: true });
});

app.post('/api/loop/resume', (_req, res) => {
  resumeLoop();
  res.json({ paused: false });
});

// Goals
app.get('/api/goals', (_req, res) => {
  res.json(getPrioritizedGoals());
});

app.post('/api/goals', (req, res) => {
  const body = req.body as {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    timeframe: 'now' | 'today' | 'this_week' | 'ongoing';
    successCriteria: string;
  };
  const goal = addGoal(body);
  res.json(goal);
});

app.patch('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: 'active' | 'paused' | 'completed' | 'failed' };
  updateGoalStatus(id, status);
  res.json({ ok: true });
});
```

- [ ] **Step 2 — Vérifier compilation**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 — Tester les endpoints**

```bash
# Dans un terminal : npm start
# Dans un autre terminal :
curl -s http://localhost:3001/api/loop/status | python3 -m json.tool
curl -s http://localhost:3001/api/goals | python3 -m json.tool
```

- [ ] **Step 4 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add src/server.ts
git commit -m "feat(api): loop status + goals CRUD endpoints"
```

---

## Task 11 — Dashboard : Loop Status Widget

**Files:**
- Modify: `dashboard/app/page.tsx`

Ajouter un widget "Loop Status" en haut du dashboard principal.

- [ ] **Step 1 — Ajouter le composant dans `dashboard/app/page.tsx`**

Au début du fichier (après les imports existants), ajouter le hook et le composant :

```typescript
// Ajouter dans dashboard/app/page.tsx

// Hook pour loop status
function useLoopStatus() {
  const [status, setStatus] = React.useState<{
    running: boolean;
    iteration: number;
    lastActionType: string | null;
    lastActionAt: string | null;
    paused: boolean;
    totalActionsToday: number;
    consecutiveFailures: number;
  } | null>(null);

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/loop/status');
        setStatus(await res.json());
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return status;
}

// LoopStatusWidget component
function LoopStatusWidget() {
  const status = useLoopStatus();

  if (!status) return null;

  const statusColor = status.paused
    ? 'text-yellow-400'
    : status.running
    ? 'text-green-400'
    : 'text-red-400';

  const statusText = status.paused ? '⏸ Pausé' : status.running ? '🟢 Actif' : '🔴 Arrêté';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Boucle Autonome
          </h2>
          <p className={`text-lg font-bold mt-1 ${statusColor}`}>{statusText}</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>Itération #{status.iteration}</div>
          <div>{status.totalActionsToday} actions aujourd'hui</div>
          {status.consecutiveFailures > 0 && (
            <div className="text-red-400">{status.consecutiveFailures} échecs consécutifs</div>
          )}
        </div>
      </div>
      {status.lastActionType && (
        <div className="mt-3 text-xs text-gray-500">
          Dernière action : <span className="text-gray-300">{status.lastActionType}</span>
          {status.lastActionAt && (
            <span> — {new Date(status.lastActionAt).toLocaleTimeString('fr-BE')}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

Puis ajouter `<LoopStatusWidget />` en haut du JSX retourné par la page principale, avant les KPI cards existantes.

- [ ] **Step 2 — Vérifier que le dashboard compile**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw/dashboard && npm run build 2>&1 | tail -20
```

- [ ] **Step 3 — Commit**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add dashboard/app/page.tsx
git commit -m "feat(dashboard): loop status widget — real-time autonomous loop state"
```

---

## Task 12 — Test de bout en bout

- [ ] **Step 1 — Lancer IntraClaw en mode autonome**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw && npm run build && node dist/index.js
```

- [ ] **Step 2 — Observer les logs pendant 2 cycles (10 minutes)**

Attendu :
```
[AutonomousLoop] === Tick #1 — Perceiving... ===
[ContextAggregator] Building perception context (iteration 1)
[SystemObserver] ...
[EmailWatcher] Unread: X, prospect replies: Y
[ActionPlanner] Decision: prospecting (urgency 7) — ...
[AutonomousLoop] Executing: prospecting — ...
[ObservationRecorder] ✅ prospecting completed in 45000ms — ...
[AutonomousLoop] === Tick #2 — Perceiving... ===
```

- [ ] **Step 3 — Vérifier le dashboard**

Ouvrir `http://localhost:3000` :
- Le widget "Boucle Autonome" doit afficher 🟢 Actif
- L'itération doit s'incrémenter
- Les actions doivent apparaître dans l'history

- [ ] **Step 4 — Vérifier les goals**

```bash
curl -s http://localhost:3001/api/goals | python3 -m json.tool
```

Attendu : 4 goals par défaut (prospection, cold email, content, reply check)

- [ ] **Step 5 — Vérifier `data/goals.json` créé**

```bash
cat /Users/aymn_idm/Desktop/IntraClaw/data/goals.json | python3 -m json.tool | head -30
```

- [ ] **Step 6 — Commit final**

```bash
cd /Users/aymn_idm/Desktop/IntraClaw
git add data/goals.json 2>/dev/null || true
git commit -m "feat: IntraClaw autonomous agent — full Perception→Reasoning→Action loop"
```

---

## Self-Review

### Couverture des requirements

| Requirement | Couvert par |
|-------------|-------------|
| Agent vit en permanence sur le Mac | Task 8 (loop tourne 24/7 avec setTimeout) |
| Perçoit le contexte | Tasks 2-4 (SystemObserver, EmailWatcher, ContextAggregator) |
| Agit de sa propre initiative | Tasks 5-6 (GoalManager + ActionPlanner Claude) |
| Décide lui-même sans schedule fixe | Task 6 (Claude décide, pas cron) |
| Réponses prospects détectées en temps réel | Task 3 (EmailWatcher poll 5 min) |
| Dashboard montre l'état | Task 11 (LoopStatusWidget) |
| Pause/resume possible | Task 8 (pauseLoop/resumeLoop) |
| Mémoire des actions | Task 7 (ObservationRecorder) |

### Pas de placeholders détectés ✅

### Cohérence des types
- `LoopAction.type` = `LoopActionType` — utilisé partout ✅
- `PerceptionContext` défini en Task 1, consommé en Tasks 4 et 6 ✅
- `Goal` défini en Task 1, utilisé en Task 5 ✅
- `AgentResult` existant, réutilisé en Task 7 ✅
