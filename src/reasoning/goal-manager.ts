// src/reasoning/goal-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Goal, GoalPriority, GoalStatus, GoalTimeframe, AgentTask } from '../types';
import { logger } from '../utils/logger';

const GOALS_PATH = path.resolve(process.cwd(), 'data', 'goals.json');

const PRIORITY_WEIGHT: Record<GoalPriority, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

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
      id: randomUUID(), title: 'Prospection quotidienne Belgium',
      description: 'Scraper 15-30 nouveaux prospects belges chaque jour ouvrable',
      priority: 'high', status: 'active', timeframe: 'ongoing',
      successCriteria: '15+ prospects ajoutés à Notion par jour',
      relatedTask: AgentTask.PROSPECTING, createdAt: now, updatedAt: now,
    },
    {
      id: randomUUID(), title: 'Cold email outreach',
      description: 'Contacter les prospects NEW avec des cold emails personnalisés FR/NL',
      priority: 'high', status: 'active', timeframe: 'ongoing',
      successCriteria: '20 emails envoyés par jour, taux réponse > 5%',
      relatedTask: AgentTask.COLD_EMAIL, createdAt: now, updatedAt: now,
    },
    {
      id: randomUUID(), title: 'Content LinkedIn hebdomadaire',
      description: 'Publier 3-5 posts LinkedIn par semaine sur web design, IA, SEO',
      priority: 'medium', status: 'active', timeframe: 'ongoing',
      successCriteria: '1 post créé par jour ouvrable',
      relatedTask: AgentTask.CONTENT, createdAt: now, updatedAt: now,
    },
    {
      id: randomUUID(), title: 'Surveillance des réponses prospects',
      description: 'Détecter et traiter les réponses des prospects contactés en temps réel',
      priority: 'critical', status: 'active', timeframe: 'ongoing',
      successCriteria: 'Toute réponse traitée dans les 30 minutes',
      relatedTask: AgentTask.MORNING_BRIEF, createdAt: now, updatedAt: now,
    },
  ];
}

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
  const goal: Goal = { id: randomUUID(), status: 'active', createdAt: now, updatedAt: now, ...params };
  goals.push(goal);
  saveGoals(goals);
  logger.info('GoalManager', `Goal added: ${goal.title}`);
  return goal;
}

export function updateGoalStatus(id: string, status: GoalStatus): void {
  const goals = loadGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal) { logger.warn('GoalManager', `Goal not found: ${id}`); return; }
  goal.status = status;
  goal.updatedAt = new Date().toISOString();
  if (status === 'completed') goal.completedAt = new Date().toISOString();
  saveGoals(goals);
}

export function getPrioritizedGoals(): Goal[] {
  const timeframeOrder: Record<GoalTimeframe, number> = {
    now: 4, today: 3, this_week: 2, ongoing: 1,
  };
  return getActiveGoals().sort((a, b) => {
    const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (diff !== 0) return diff;
    return timeframeOrder[b.timeframe] - timeframeOrder[a.timeframe];
  });
}
