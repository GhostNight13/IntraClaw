import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { MemoryFile } from '../types';

const MEMORY_DIR = path.resolve(process.cwd(), 'memory');

// The 8 canonical memory files
const MEMORY_FILES = [
  'SOUL.md',
  'USER.md',
  'AGENTS.md',
  'BOOTSTRAP.md',
  'HEARTBEAT.md',
  'IDENTITY.md',
  'MEMORY.md',
  'TOOLS.md',
] as const;

let _loadedMemory: MemoryFile[] = [];

/**
 * Load all memory files from disk.
 * Call once at startup. Missing files are skipped with a warning.
 */
export function loadMemory(): MemoryFile[] {
  _loadedMemory = [];

  for (const filename of MEMORY_FILES) {
    const filePath = path.join(MEMORY_DIR, filename);
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn('Memory', `Missing memory file: ${filename}`);
        continue;
      }
      const content = fs.readFileSync(filePath, 'utf8').trim();
      _loadedMemory.push({
        filename,
        content,
        loadedAt: new Date().toISOString(),
      });
      logger.info('Memory', `Loaded ${filename} (${content.length} chars)`);
    } catch (err) {
      logger.error('Memory', `Failed to load ${filename}`, err);
    }
  }

  logger.info('Memory', `Memory loaded: ${_loadedMemory.length}/${MEMORY_FILES.length} files`);
  return _loadedMemory;
}

/**
 * Build a consolidated system prompt from all loaded memory files.
 * This is injected at the start of every AI request.
 */
export function buildSystemPrompt(extraContext?: string): string {
  if (_loadedMemory.length === 0) {
    logger.warn('Memory', 'buildSystemPrompt called before loadMemory()');
    loadMemory();
  }

  const sections: string[] = [];

  for (const file of _loadedMemory) {
    const sectionTitle = file.filename.replace('.md', '');
    sections.push(`## ${sectionTitle}\n${file.content}`);
  }

  const base = sections.join('\n\n---\n\n');

  return extraContext
    ? `${base}\n\n---\n\n## Contexte supplémentaire\n${extraContext}`
    : base;
}

/**
 * Reload a single memory file (useful after manual edits).
 */
export function reloadMemoryFile(filename: string): void {
  const filePath = path.join(MEMORY_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const idx = _loadedMemory.findIndex(m => m.filename === filename);
    const updated: MemoryFile = { filename, content, loadedAt: new Date().toISOString() };
    if (idx >= 0) {
      _loadedMemory[idx] = updated;
    } else {
      _loadedMemory.push(updated);
    }
    logger.info('Memory', `Reloaded ${filename}`);
  } catch (err) {
    logger.error('Memory', `Failed to reload ${filename}`, err);
  }
}

export function getLoadedMemory(): MemoryFile[] {
  return _loadedMemory;
}
