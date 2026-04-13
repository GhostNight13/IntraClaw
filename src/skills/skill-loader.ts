// src/skills/skill-loader.ts
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { logger } from '../utils/logger';

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  triggers: string[];       // Keywords that activate this skill
  requiredTools: string[];  // Tools needed (notion, gmail, puppeteer, etc.)
  prompt: string;           // System prompt for this skill
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function ensureSkillsDir(): void {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

export function loadSkill(filePath: string): Skill | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const skill = YAML.parse(raw) as Skill;
    if (!skill.id || !skill.name || !skill.prompt) {
      logger.warn('SkillLoader', `Invalid skill file (missing id/name/prompt): ${filePath}`);
      return null;
    }
    return skill;
  } catch (err) {
    logger.error('SkillLoader', `Failed to load skill: ${filePath}`, err instanceof Error ? err.message : err);
    return null;
  }
}

export function loadAllSkills(): Skill[] {
  ensureSkillsDir();
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const skills: Skill[] = [];

  for (const file of files) {
    const skill = loadSkill(path.join(SKILLS_DIR, file));
    if (skill && skill.enabled !== false) skills.push(skill);
  }

  logger.info('SkillLoader', `Loaded ${skills.length} skills from ${SKILLS_DIR}`);
  return skills;
}

export function findSkillByTrigger(message: string, skills: Skill[]): Skill | null {
  const lower = message.toLowerCase();
  for (const skill of skills) {
    for (const trigger of skill.triggers) {
      if (lower.includes(trigger.toLowerCase())) return skill;
    }
  }
  return null;
}

export function saveSkill(skill: Skill): void {
  ensureSkillsDir();
  const filePath = path.join(SKILLS_DIR, `${skill.id}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(skill), 'utf8');
  logger.info('SkillLoader', `Skill saved: ${skill.name} → ${filePath}`);
}

export function getSkillIndex(): string {
  const skills = loadAllSkills();
  if (skills.length === 0) return 'Aucun skill disponible.';
  return skills.map(s => `- **${s.name}** (${s.id}): ${s.description} [triggers: ${s.triggers.join(', ')}]`).join('\n');
}
