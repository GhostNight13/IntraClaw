// src/tools/terminal-exec.ts
import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

const MAX_OUTPUT_SIZE = 50000; // 50KB max stdout
const DEFAULT_TIMEOUT = 60000; // 60s default
const MAX_TIMEOUT     = 300000; // 5 min max
const LOGS_DIR        = path.resolve(process.cwd(), 'data', 'terminal-logs');

// Hard-blocked — shell escapes, destructive ops, secret-exfil vectors
const BLOCKED_COMMANDS: Array<[RegExp, string]> = [
  [/\$\(/,                    'subshell $(…) forbidden'],
  [/`[^`]*`/,                 'backtick subshell forbidden'],
  [/\beval\b/,                'eval forbidden'],
  [/>\s*\/dev\//,             'redirect to /dev/* forbidden'],
  [/\|\s*(?:ba|z)?sh\b/,      'pipe to sh/bash/zsh forbidden'],
  [/\b(?:ba|z)?sh\s+-c\b/,    'sh -c / bash -c / zsh -c forbidden'],
  [/\bnode\s+-e\b/,           'node -e forbidden'],
  [/\bpython3?\s+-c\b/,       'python -c forbidden'],
  [/\bperl\s+-e\b/,           'perl -e forbidden'],
  [/\bruby\s+-e\b/,           'ruby -e forbidden'],
  [/\bsudo\b/,                'sudo forbidden'],
  [/\brm\s+-rf?\b.*\//,       'recursive rm with absolute path forbidden'],
  [/\brm\s+-rf?\s+~/,         'recursive rm of $HOME forbidden'],
  [/\brm\s+-rf?\s+\$/,        'recursive rm of env var forbidden'],
  [/\bmkfs\b/,                'mkfs forbidden'],
  [/\bdd\s+if=/,              'dd forbidden'],
  [/\bshutdown\b/,            'shutdown forbidden'],
  [/\breboot\b/,              'reboot forbidden'],
  [/\bpasswd\b/,              'passwd forbidden'],
  [/:\(\)\s*\{/,              'fork bomb forbidden'],
  [/\bgit\s+push\b/,          'git push forbidden'],
  [/\bgit\s+checkout\s+(main|master)\b/, 'git checkout main/master forbidden'],
  [/\bgit\s+switch\s+(main|master)\b/,   'git switch main/master forbidden'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard forbidden'],
  [/\bgit\s+clean\s+-[df]/,   'git clean -f/-d forbidden'],
];

// Commands that need explicit confirmation (logged but allowed)
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bchmod\s+777\b/,
  /\bnpm\s+publish\b/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
];

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function isBlocked(command: string): boolean {
  return BLOCKED_COMMANDS.some(([pattern]) => pattern.test(command));
}

function blockReason(command: string): string {
  for (const [pattern, reason] of BLOCKED_COMMANDS) {
    if (pattern.test(command)) return reason;
  }
  return 'blocked';
}

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_SIZE) return output;
  const headSize = Math.floor(MAX_OUTPUT_SIZE * 0.4);
  const tailSize = Math.floor(MAX_OUTPUT_SIZE * 0.4);
  return output.slice(0, headSize) +
    `\n\n[...truncated ${output.length - headSize - tailSize} chars...]\n\n` +
    output.slice(-tailSize);
}

export interface TerminalResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  command: string;
  blocked?: boolean;
  dangerous?: boolean;
}

/**
 * Execute a shell command synchronously with timeout.
 */
export function execCommand(command: string, options?: {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}): TerminalResult {
  const startMs = Date.now();
  const cwd = options?.cwd ?? process.cwd();
  const timeout = Math.min(options?.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);

  // Security check
  if (isBlocked(command)) {
    logger.error('TerminalExec', `BLOCKED dangerous command: ${command}`);
    return {
      success: false, stdout: '', stderr: `Command blocked: ${blockReason(command)}`,
      exitCode: -1, durationMs: 0, command, blocked: true,
    };
  }

  const dangerous = isDangerous(command);
  if (dangerous) {
    logger.warn('TerminalExec', `Executing DANGEROUS command: ${command}`);
  }

  logger.info('TerminalExec', `Executing: ${command.slice(0, 200)}`, { cwd, timeout });

  try {
    const stdout = execSync(command, {
      cwd,
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const result: TerminalResult = {
      success: true,
      stdout: truncateOutput(stdout ?? ''),
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - startMs,
      command,
      dangerous,
    };

    logExecution(result);
    return result;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    const result: TerminalResult = {
      success: false,
      stdout: truncateOutput(error.stdout ?? ''),
      stderr: truncateOutput(error.stderr ?? error.message ?? 'Unknown error'),
      exitCode: error.status ?? 1,
      durationMs: Date.now() - startMs,
      command,
      dangerous,
    };

    logExecution(result);
    return result;
  }
}

/**
 * Execute a command asynchronously (for long-running processes).
 */
export function execCommandAsync(command: string, options?: {
  cwd?: string;
  timeout?: number;
}): Promise<TerminalResult> {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const cwd = options?.cwd ?? process.cwd();
    const timeout = Math.min(options?.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);

    if (isBlocked(command)) {
      resolve({
        success: false, stdout: '', stderr: 'Command blocked for safety',
        exitCode: -1, durationMs: 0, command, blocked: true,
      });
      return;
    }

    exec(command, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const result: TerminalResult = {
        success: !error,
        stdout: truncateOutput(stdout ?? ''),
        stderr: truncateOutput(stderr ?? ''),
        exitCode: error?.code ?? 0,
        durationMs: Date.now() - startMs,
        command,
      };
      logExecution(result);
      resolve(result);
    });
  });
}

// These wrappers now delegate to the builtin file-ops tool which already
// enforces REPO_ROOT confinement + protected-paths blacklist. Previously they
// bypassed those guards, creating a D1 P0 security hole.
import { toolDefinition as fileOpsTool } from './builtin/file-ops';

/**
 * Read a file from the filesystem (confined via file-ops builtin tool).
 */
export async function readFile(filePath: string): Promise<{ success: boolean; content: string }> {
  const result = await fileOpsTool.execute({ action: 'read', path: filePath });
  if (!result.success) {
    return { success: false, content: result.error ?? 'Read failed' };
  }
  const data = result.data as { content?: string } | undefined;
  return { success: true, content: (data?.content ?? '').slice(0, MAX_OUTPUT_SIZE) };
}

/**
 * Write a file (confined via file-ops builtin tool, with optional backup).
 */
export async function writeFile(filePath: string, content: string): Promise<{ success: boolean; backupPath?: string }> {
  const result = await fileOpsTool.execute({ action: 'write', path: filePath, content });
  if (!result.success) {
    logger.warn('TerminalExec', `writeFile blocked: ${result.error ?? 'unknown'}`);
    return { success: false };
  }
  return { success: true };
}

function logExecution(result: TerminalResult): void {
  ensureLogsDir();
  const logEntry = {
    timestamp: new Date().toISOString(),
    command: result.command,
    success: result.success,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    stdoutSize: result.stdout.length,
    stderrSize: result.stderr.length,
    blocked: result.blocked,
    dangerous: result.dangerous,
  };

  const logFile = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
}
