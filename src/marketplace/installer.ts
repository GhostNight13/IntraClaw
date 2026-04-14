import * as fs from 'fs';
import * as path from 'path';
import { installSkill } from './registry';
import { logger } from '../utils/logger';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

export async function downloadAndInstallSkill(slug: string): Promise<string> {
  const { content } = installSkill(slug);

  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

  const filename = `${slug}.yaml`;
  const filePath = path.join(SKILLS_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');

  logger.info('Marketplace', `Skill installed: ${filename}`);
  return filePath;
}
