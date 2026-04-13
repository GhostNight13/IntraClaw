// src/tools/terminal-exec.ts
import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

const MAX_OUTPUT_SIZE = 50000; // 50KB max stdout
const DEFAULT_TIMEOUT = 60000; // 60s default
const MAX_TIMEOUT     = 300000; // 5 min max
const LOGS_DIR        = path.resolve(process.cwd(), 'data', 'terminal-logs');

// Commands that are NEVER allowed
const BLOCKED_COMMANDS: RegExp[] = [
  /rm\s+-rf\s+\//,        // rm -rf /
  /mkfs/,                  // format disk
  /dd\s+if=/,              // disk destroy
  /:(){ :\|:& };:/,       // fork bomb
  /shutdown/,
  /reboot/,
  /passwd/,
  /sudo\s+rm/,
];

// Commands that need explicit confirmation (logged but allowed)
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf/,
  /sudo/,
  /chmod\s+777/,
  /npm\s+publish/,
  /git\s+push.*--force/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
];

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function isBlocked(command: string): boolean {
  return BLOCKED_COMMANDS.some(pattern => pattern.test(command));
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
      success: false, stdout: '', stderr: 'Command blocked for safety',
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

/**
 * Read a file from the filesystem.
 */
export function readFile(filePath: string): { success: boolean; content: string } {
  try {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, 'utf8');
    return { success: true, content: content.slice(0, MAX_OUTPUT_SIZE) };
  } catch (err) {
    return { success: false, content: err instanceof Error ? err.message : 'Read failed' };
  }
}

/**
 * Write a file to the filesystem (with backup).
 */
export function writeFile(filePath: string, content: string): { success: boolean; backupPath?: string } {
  try {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Backup if file exists
    let backupPath: string | undefined;
    if (fs.existsSync(resolved)) {
      backupPath = resolved + `.bak.${Date.now()}`;
      fs.copyFileSync(resolved, backupPath);
    }

    fs.writeFileSync(resolved, content, 'utf8');
    logger.info('TerminalExec', `File written: ${resolved}`);
    return { success: true, backupPath };
  } catch {
    return { success: false };
  }
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
