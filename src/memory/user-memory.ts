/**
 * Per-user memory loading for multi-tenant mode.
 * In single-user mode, reads from ./memory/ files.
 * In multi-user mode (future), reads from DB per userId.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface MemoryFile {
  filename: string;
  content: string;
}

const MEMORY_FILES = [
  'SOUL.md', 'USER.md', 'MEMORY.md', 'HEARTBEAT.md',
  'AGENTS.md', 'TOOLS.md', 'IDENTITY.md', 'BOOTSTRAP.md'
];

// In-memory cache: userId → { files, loadedAt }
const memoryCache = new Map<string, { files: MemoryFile[]; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load memory files for a user.
 * Currently reads from ./memory/ (single-user).
 * TODO: When multi-tenant DB is ready, load from DB by userId.
 */
export async function loadMemoryForUser(userId: string): Promise<MemoryFile[]> {
  const cached = memoryCache.get(userId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.files;
  }

  const memoryDir = path.resolve(process.cwd(), 'memory');
  const files: MemoryFile[] = [];

  for (const filename of MEMORY_FILES) {
    const filepath = path.join(memoryDir, filename);
    try {
      if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');
        files.push({ filename, content });
      }
    } catch (err) {
      logger.warn('UserMemory', `Could not read ${filename}: ${err}`);
    }
  }

  memoryCache.set(userId, { files, loadedAt: Date.now() });
  logger.info('UserMemory', `Loaded ${files.length} memory files for user ${userId}`);
  return files;
}

/**
 * Invalidate cache for a user (call after memory updates).
 */
export function invalidateMemoryCache(userId: string): void {
  memoryCache.delete(userId);
}
