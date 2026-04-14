import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CodeRunResult } from './types';
import { logger } from '../../utils/logger';

const TIMEOUT_MS = 30_000;
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

export async function runCode(code: string, language: 'javascript' | 'typescript' | 'python' | 'bash' = 'javascript'): Promise<CodeRunResult> {
  const safety = isSafeCode(code);
  if (!safety.safe) {
    return { stdout: '', stderr: `Blocked: ${safety.reason}`, exitCode: 1, durationMs: 0 };
  }

  ensureSandboxDir();
  const start = Date.now();

  if (language === 'bash') {
    return runBash(code, start);
  }

  const ext = { javascript: '.js', typescript: '.ts', python: '.py' }[language];
  const tmpFile = path.join(SANDBOX_DIR, `run-${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
    const cmd = language === 'python' ? `python3 "${tmpFile}"` : `node "${tmpFile}"`;
    return runProcess(cmd, start);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function runBash(code: string, start: number): CodeRunResult {
  const tmpFile = path.join(os.tmpdir(), `bash-run-${Date.now()}.sh`);
  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
    return runProcess(`bash "${tmpFile}"`, start);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function runProcess(cmd: string, start: number): CodeRunResult {
  try {
    const result = childProcess.execSync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: 512 * 1024,
      encoding: 'utf8',
      cwd: SANDBOX_DIR,
      env: { ...process.env, NODE_ENV: 'sandbox' },
    });
    return { stdout: result, stderr: '', exitCode: 0, durationMs: Date.now() - start };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? 'Unknown error',
      exitCode: e.status ?? 1,
      durationMs: Date.now() - start,
    };
  }
}
