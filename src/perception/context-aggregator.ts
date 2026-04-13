// src/perception/context-aggregator.ts
import { getSystemSnapshot } from './system-observer';
import { getEmailSnapshot } from './email-watcher';
import { getProspectsByStatus } from '../tools/notion';
import { ProspectStatus, PerceptionContext } from '../types';
import { getActions, ActionRecord } from '../db';
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

function getLastActionInfo(actions: ActionRecord[]): {
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
    if (a.status === 'error') consecutiveFailures++;
    else break;
  }
  return { lastActionAt, lastActionType, consecutiveFailures };
}

let _iteration = 0;

export async function buildPerceptionContext(): Promise<PerceptionContext> {
  _iteration++;
  logger.info('ContextAggregator', `Building perception context (iteration ${_iteration})`);

  const [system, emails, [prospectsNew, prospectsContacted, prospectsReplied], recentActions] = await Promise.all([
    getSystemSnapshot(),
    getEmailSnapshot(),
    Promise.all([
      getProspectsByStatus(ProspectStatus.NEW).catch(() => []),
      getProspectsByStatus(ProspectStatus.CONTACTED).catch(() => []),
      getProspectsByStatus(ProspectStatus.REPLIED).catch(() => []),
    ]),
    Promise.resolve(getActions(20)),
  ]);

  const lastProspection = recentActions.find(a => a.task === 'prospecting');
  const { lastActionAt, lastActionType, consecutiveFailures } = getLastActionInfo(recentActions);

  return {
    timestamp:            new Date().toISOString(),
    timeOfDay:            system.timeOfDay,
    isBusinessDay:        system.isBusinessDay,
    hour:                 system.hour,
    dayOfWeek:            system.dayOfWeek,
    cpuUsage:             system.cpuUsage,
    batteryLevel:         system.batteryLevel,
    activeApp:            system.activeApp,
    isUserActive:         system.isUserActive,
    unreadEmailCount:     emails.unreadCount,
    prospectRepliesCount: emails.prospectRepliesCount,
    prospectsNew:         prospectsNew.length,
    prospectsContacted:   prospectsContacted.length,
    prospectsReplied:     prospectsReplied.length,
    emailsSentToday:      getEmailsSentToday(),
    lastProspectionAt:    lastProspection?.timestamp ?? null,
    lastActionAt,
    lastActionType,
    consecutiveFailures,
    loopIteration:        _iteration,
  };
}
