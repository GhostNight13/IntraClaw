// src/tools/builtin/file-ops.ts
// File operations tool — confined to REPO_ROOT, protected secrets blacklist.
//
// Security model:
//   1. All paths resolve under REPO_ROOT (process.cwd() by default)
//   2. Protected paths (.env*, ~/.ssh, ~/.aws, .git/config) are blocked for
//      read/write/append
//   3. path.resolve() + startsWith check prevents traversal (../../.ssh/id_rsa)
//
// Override REPO_ROOT via FILE_OPS_ROOT env var. Extend blacklist via
// FILE_OPS_EXTRA_BLOCKED="pattern1,pattern2".
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ToolDefinition, ToolResult } from './types';
import { logger } from '../../utils/logger';

const REPO_ROOT = path.resolve(process.env.FILE_OPS_ROOT ?? process.cwd());
const MAX_READ_BYTES = 5 * 1024 * 1024;

// ─── Protected path patterns ───────────────────────────────────────────────

const PROTECTED_GLOBS: RegExp[] = [
  /\.env(\.|$)/,                // .env, .env.local, .env.prod
  /\.env$/,
  /\/\.git\/(config|hooks|credentials)/,
  /\/\.ssh\//,
  /\/\.aws\//,
  /\/\.config\/gh\//,
  /\/\.config\/git\//,
  /\/\.docker\/config\.json/,
  /\/\.npmrc$/,
  /\/\.yarnrc/,
  /id_rsa/,
  /id_ed25519/,
  /id_ecdsa/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /authorized_keys/,
  /known_hosts/,
];

function loadExtraProtected(): RegExp[] {
  const extra = process.env.FILE_OPS_EXTRA_BLOCKED;
  if (!extra) return [];
  return extra.split(',').map(s => s.trim()).filter(Boolean).map(p => new RegExp(p));
}

const ALL_PROTECTED = [...PROTECTED_GLOBS, ...loadExtraProtected()];

// ─── Path validation ──────────────────────────────────────────────────────

interface ValidatedPath {
  ok: true;
  resolved: string;
}
interface RejectedPath {
  ok: false;
  reason: string;
}
type PathCheck = ValidatedPath | RejectedPath;

function validatePath(input: string, action: 'read' | 'write' | 'append' | 'list'): PathCheck {
  if (!input || typeof input !== 'string') {
    return { ok: false, reason: 'path is empty' };
  }

  // Expand ~ to home (but still validate against REPO_ROOT after)
  const expanded = input.startsWith('~')
    ? path.join(os.homedir(), input.slice(1))
    : input;

  const resolved = path.resolve(expanded);

  // Confine to REPO_ROOT (prevents ../../ traversal and absolute-path abuse)
  if (!resolved.startsWith(REPO_ROOT + path.sep) && resolved !== REPO_ROOT) {
    return { ok: false, reason: `path outside REPO_ROOT (${REPO_ROOT}). Resolved: ${resolved}` };
  }

  // Protected-patterns blacklist — applies to read AND write
  for (const re of ALL_PROTECTED) {
    if (re.test(resolved)) {
      return { ok: false, reason: `protected path (matches ${re.source})` };
    }
  }

  // Extra write/append check: never modify package-lock, lock files, .git internals
  if (action === 'write' || action === 'append') {
    if (/\/\.git\//.test(resolved)) {
      return { ok: false, reason: 'cannot write inside .git/' };
    }
  }

  return { ok: true, resolved };
}

// ─── Actions ──────────────────────────────────────────────────────────────

function readFileAction(filePath: string): ToolResult {
  const check = validatePath(filePath, 'read');
  if (!check.ok) {
    logger.warn('FileOps', `Read blocked: ${check.reason} — "${filePath}"`);
    return { success: false, error: `Blocked: ${check.reason}` };
  }
  try {
    if (!fs.existsSync(check.resolved)) {
      return { success: false, error: `File not found: ${check.resolved}` };
    }
    const stat = fs.statSync(check.resolved);
    if (stat.size > MAX_READ_BYTES) {
      return { success: false, error: `File too large (>${MAX_READ_BYTES / 1024 / 1024}MB)` };
    }
    const content = fs.readFileSync(check.resolved, 'utf8');
    return { success: true, data: { path: check.resolved, content, size: stat.size } };
  } catch (err) {
    return { success: false, error: `Read failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function writeFileAction(filePath: string, content: string): ToolResult {
  const check = validatePath(filePath, 'write');
  if (!check.ok) {
    logger.warn('FileOps', `Write blocked: ${check.reason} — "${filePath}"`);
    return { success: false, error: `Blocked: ${check.reason}` };
  }
  try {
    const dir = path.dirname(check.resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(check.resolved, content, 'utf8');
    return { success: true, data: { path: check.resolved, bytesWritten: Buffer.byteLength(content) } };
  } catch (err) {
    return { success: false, error: `Write failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function listDirAction(dirPath: string): ToolResult {
  const check = validatePath(dirPath, 'list');
  if (!check.ok) {
    logger.warn('FileOps', `List blocked: ${check.reason} — "${dirPath}"`);
    return { success: false, error: `Blocked: ${check.reason}` };
  }
  try {
    if (!fs.existsSync(check.resolved)) {
      return { success: false, error: `Directory not found: ${check.resolved}` };
    }
    const entries = fs.readdirSync(check.resolved, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      size: e.isFile() ? fs.statSync(path.join(check.resolved, e.name)).size : undefined,
    }));
    return { success: true, data: { path: check.resolved, entries: items, count: items.length } };
  } catch (err) {
    return { success: false, error: `List failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function appendFileAction(filePath: string, content: string): ToolResult {
  const check = validatePath(filePath, 'append');
  if (!check.ok) {
    logger.warn('FileOps', `Append blocked: ${check.reason} — "${filePath}"`);
    return { success: false, error: `Blocked: ${check.reason}` };
  }
  try {
    fs.appendFileSync(check.resolved, content, 'utf8');
    return { success: true, data: { path: check.resolved, appended: Buffer.byteLength(content) } };
  } catch (err) {
    return { success: false, error: `Append failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

// ─── Tool definition ──────────────────────────────────────────────────────

export const toolDefinition: ToolDefinition = {
  name: 'file-ops',
  description:
    `Read, write, list, or append files within REPO_ROOT (${REPO_ROOT}). ` +
    'Protected: .env*, .git config/hooks, ~/.ssh, ~/.aws, *.pem, *.key, id_rsa, authorized_keys.',
  parameters: {
    action: { type: 'string', description: 'One of: read, write, list, append', required: true },
    path: { type: 'string', description: 'Path relative to REPO_ROOT (absolute paths resolved & validated)', required: true },
    content: { type: 'string', description: 'Content for write/append' },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = params.action as string | undefined;
    const filePath = params.path as string | undefined;

    if (!action || !filePath) {
      return { success: false, error: 'Missing required parameters: action, path' };
    }

    switch (action) {
      case 'read':
        return readFileAction(filePath);
      case 'write': {
        const content = params.content as string | undefined;
        if (content === undefined) {
          return { success: false, error: 'Missing required parameter: content (for write)' };
        }
        return writeFileAction(filePath, content);
      }
      case 'list':
        return listDirAction(filePath);
      case 'append': {
        const content = params.content as string | undefined;
        if (content === undefined) {
          return { success: false, error: 'Missing required parameter: content (for append)' };
        }
        return appendFileAction(filePath, content);
      }
      default:
        return { success: false, error: `Unknown action: ${action}. Use read, write, list, or append.` };
    }
  },
};
