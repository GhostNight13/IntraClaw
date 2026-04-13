// src/memory/context-compressor.ts
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const MEMORY_DIR = path.resolve(process.cwd(), 'memory');
const CACHE_DIR  = path.resolve(process.cwd(), 'data', 'prompt-cache');

// Files that rarely change → cache aggressively
const STATIC_FILES  = ['SOUL.md', 'IDENTITY.md', 'USER.md', 'AGENTS.md', 'BOOTSTRAP.md', 'TOOLS.md'];
// Files that change often → always fresh
const DYNAMIC_FILES = ['HEARTBEAT.md', 'MEMORY.md'];

interface CachedPrompt {
  hash: string;
  compressed: string;
  timestamp: string;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function fileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Compress a memory file: strip comments, collapse whitespace, truncate to maxChars.
 */
function compressMarkdown(content: string, maxChars: number): string {
  let compressed = content
    .replace(/<!--[\s\S]*?-->/g, '')          // Remove HTML comments
    .replace(/^#{1,6}\s*[-=]+\s*$/gm, '')     // Remove separator lines
    .replace(/\n{3,}/g, '\n\n')               // Collapse multiple blank lines
    .replace(/^\s+$/gm, '')                    // Remove whitespace-only lines
    .trim();

  if (compressed.length > maxChars) {
    // Keep head (identity) + tail (recent info)
    const headSize = Math.floor(maxChars * 0.6);
    const tailSize = maxChars - headSize - 50;
    compressed = compressed.slice(0, headSize) + '\n\n[...condensé...]\n\n' + compressed.slice(-tailSize);
  }

  return compressed;
}

/**
 * Build a compressed system prompt with caching.
 * Static files are cached based on content hash.
 * Dynamic files are always fresh but compressed.
 */
export function buildCompressedSystemPrompt(maxTokenEstimate = 4000): string {
  ensureCacheDir();

  // ~4 chars per token estimate
  const maxTotalChars = maxTokenEstimate * 4;
  const staticBudget  = Math.floor(maxTotalChars * 0.5);  // 50% for static
  const dynamicBudget = Math.floor(maxTotalChars * 0.4);  // 40% for dynamic
  // 10% reserve for separators

  const parts: string[] = [];

  // 1. Static files (cached)
  const staticContent = STATIC_FILES
    .map(f => {
      const filePath = path.join(MEMORY_DIR, f);
      if (!fs.existsSync(filePath)) return '';
      return fs.readFileSync(filePath, 'utf8');
    })
    .join('\n\n');

  const staticHash = fileHash(staticContent);
  const cachePath  = path.join(CACHE_DIR, `static-${staticHash}.json`);

  let compressedStatic: string;
  if (fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CachedPrompt;
    compressedStatic = cached.compressed;
    logger.info('ContextCompressor', 'Static prompt loaded from cache');
  } else {
    compressedStatic = compressMarkdown(staticContent, staticBudget);
    const cacheEntry: CachedPrompt = {
      hash: staticHash,
      compressed: compressedStatic,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry), 'utf8');
    logger.info('ContextCompressor', `Static prompt cached (${compressedStatic.length} chars)`);
  }
  parts.push(compressedStatic);

  // 2. Dynamic files (always fresh, compressed)
  const perFileBudget = Math.floor(dynamicBudget / DYNAMIC_FILES.length);
  for (const f of DYNAMIC_FILES) {
    const filePath = path.join(MEMORY_DIR, f);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    parts.push(compressMarkdown(raw, perFileBudget));
  }

  const result = parts.filter(Boolean).join('\n\n---\n\n');
  logger.info('ContextCompressor', `System prompt: ${result.length} chars (~${Math.ceil(result.length / 4)} tokens)`);
  return result;
}

/**
 * Clear the prompt cache (call after memory files are updated).
 */
export function clearPromptCache(): void {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) fs.unlinkSync(path.join(CACHE_DIR, f));
  logger.info('ContextCompressor', `Cleared ${files.length} cached prompts`);
}
