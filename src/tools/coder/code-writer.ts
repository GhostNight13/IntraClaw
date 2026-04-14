import * as fs from 'fs';
import * as path from 'path';
import { takeSnapshot } from './rollback';
import { generateDiff } from './diff-preview';
import type { DiffResult } from './types';
import { logger } from '../../utils/logger';

// Safety: disallow writes outside these base dirs
const ALLOWED_BASE_DIRS = [
  process.cwd(),
  '/tmp/intraclaw-sandbox',
];

function isSafePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_BASE_DIRS.some(base => resolved.startsWith(path.resolve(base)));
}

export function readFile(filePath: string): string {
  if (!isSafePath(filePath)) throw new Error(`Path not allowed: ${filePath}`);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

export function previewWrite(filePath: string, newContent: string): DiffResult {
  const original = readFile(filePath);
  return generateDiff(filePath, original, newContent);
}

export function writeFile(filePath: string, content: string, snapshotFirst = true): { snapshot: string | null } {
  if (!isSafePath(filePath)) throw new Error(`Path not allowed: ${filePath}`);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let snapshotId: string | null = null;
  if (snapshotFirst && fs.existsSync(filePath)) {
    const snap = takeSnapshot(filePath);
    snapshotId = snap.id;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  logger.info('Coder', `Wrote file: ${filePath} (${content.length} bytes)`);
  return { snapshot: snapshotId };
}

export function patchFile(filePath: string, searchStr: string, replaceStr: string): void {
  const content = readFile(filePath);
  if (!content.includes(searchStr)) throw new Error(`Search string not found in ${filePath}`);
  takeSnapshot(filePath);
  fs.writeFileSync(path.resolve(filePath), content.replace(searchStr, replaceStr), 'utf8');
  logger.info('Coder', `Patched ${filePath}`);
}
