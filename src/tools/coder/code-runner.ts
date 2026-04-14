import { execFile } from 'child_process';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { CodeRunResult } from './types';
import { logger } from '../../utils/logger';

const TIMEOUT_MS = 10_000; // 10s max
const SANDBOX_DIR = '/tmp/intraclaw-sandbox';

const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /:\(\)\s*\{/,  // fork bomb
  />\s*\/dev\/sda/,
  /mkfs/i,
  /shutdown/i,
  /reboot/i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
  /dd\s+if=/i,
];

function isSafeCode(code: string): { safe: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { safe: false, reason: `Blocked pattern: ${pattern.source}` };
    }
  }
  return { safe: true };
}

function ensureSandboxDir(): void {
  if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

// ─── New async API (spec-aligned) ────────────────────────────────────────────

export async function runNodeCode(code: string): Promise<CodeRunResult> {
  const safety = isSafeCode(code);
  if (!safety.safe) throw new Error(`Blocked: ${safety.reason}`);

  ensureSandboxDir();
  const tmpFile = path.join(os.tmpdir(), `intraclaw-run-${crypto.randomBytes(4).toString('hex')}.js`);
  fs.writeFileSync(tmpFile, code, 'utf8');

  const start = Date.now();
  return new Promise((resolve) => {
    let timedOut = false;
    const child = execFile('node', [tmpFile], { timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      fs.unlink(tmpFile, () => {});
      resolve({
        stdout: stdout.slice(0, 10_000),
        stderr: stderr.slice(0, 2_000),
        exitCode: timedOut ? 124 : (error?.code as number ?? 0),
        durationMs: Date.now() - start,
        timedOut,
      });
    });
    setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
  });
}

export async function runShellCommand(cmd: string, cwd?: string): Promise<CodeRunResult> {
  const safety = isSafeCode(cmd);
  if (!safety.safe) throw new Error(`Blocked: ${safety.reason}`);
  logger.info('Coder', `Running: ${cmd.slice(0, 80)}`);

  const start = Date.now();
  return new Promise((resolve) => {
    let timedOut = false;
    const child = execFile('bash', ['-c', cmd], { timeout: TIMEOUT_MS, cwd }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.slice(0, 10_000),
        stderr: stderr.slice(0, 2_000),
        exitCode: timedOut ? 124 : (error ? (error.code as number ?? 1) : 0),
        durationMs: Date.now() - start,
        timedOut,
      });
    });
    setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
  });
}

// ─── Legacy sync API (kept for backward compatibility) ────────────────────────

export async function runCode(code: string, language: 'javascript' | 'typescript' | 'python' | 'bash' = 'javascript'): Promise<CodeRunResult> {
  if (language === 'bash') return runShellCommand(code);

  const safety = isSafeCode(code);
  if (!safety.safe) {
    return { stdout: '', stderr: `Blocked: ${safety.reason}`, exitCode: 1, durationMs: 0, timedOut: false };
  }

  ensureSandboxDir();
  const start = Date.now();

  const ext = { javascript: '.js', typescript: '.ts', python: '.py' }[language] ?? '.js';
  const tmpFile = path.join(SANDBOX_DIR, `run-${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
    const cmd = language === 'python' ? `python3 "${tmpFile}"` : `node "${tmpFile}"`;
    return runLegacyProcess(cmd, start);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function runLegacyProcess(cmd: string, start: number): CodeRunResult {
  try {
    const result = childProcess.execSync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: 512 * 1024,
      encoding: 'utf8',
      cwd: SANDBOX_DIR,
      env: { ...process.env, NODE_ENV: 'sandbox' },
    });
    return { stdout: result, stderr: '', exitCode: 0, durationMs: Date.now() - start, timedOut: false };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? 'Unknown error',
      exitCode: e.status ?? 1,
      durationMs: Date.now() - start,
      timedOut: false,
    };
  }
}
