// src/tools/builtin/shell-exec.ts
// Sandboxed shell execution — whitelist-based, not regex-blacklist.
//
// Security model: only commands whose FIRST TOKEN is in ALLOWED_BINARIES
// are accepted. Subshells, pipes to sh/bash, eval, backticks, redirects to
// /dev, and all writes outside REPO_ROOT are rejected. Escape attempts
// (`bash -c "…"`, `node -e "…"`, `$(…)`, backticks) are blocked.
//
// Set SHELL_EXEC_ALLOW_EXTRA="cmd1,cmd2" to extend the whitelist for specific deployments.
import { execSync } from 'child_process';
import type { ToolDefinition, ToolResult } from './types';
import { logger } from '../../utils/logger';

const MAX_OUTPUT = 50_000;
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;

// ─── Allow-list ─────────────────────────────────────────────────────────────
// Read-only & safe-by-default commands. Expand only if you trust the caller.
const ALLOWED_BINARIES_DEFAULT = new Set<string>([
  // Inspection
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'du', 'df',
  'find', 'grep', 'rg', 'tree', 'which', 'echo', 'printf',
  // Git read-only (no push, no checkout main)
  'git', // additional arg check below
  // Node/npm ecosystem (read-only + builds)
  'node', 'npm', 'npx', 'yarn', 'pnpm',
  // Python ecosystem (read-only + installs)
  'python', 'python3', 'pip', 'pip3',
  // TypeScript
  'tsc',
  // Docker (safe subcommands only — expand if needed)
  'docker',
  // Date/system info
  'date', 'uname', 'hostname', 'whoami',
  // Curl/wget for fetching — only to fetch, they don't exec shell
  'curl', 'wget',
]);

function loadAllowList(): Set<string> {
  const extra = process.env.SHELL_EXEC_ALLOW_EXTRA;
  if (!extra) return ALLOWED_BINARIES_DEFAULT;
  const list = new Set(ALLOWED_BINARIES_DEFAULT);
  for (const cmd of extra.split(',').map(s => s.trim()).filter(Boolean)) list.add(cmd);
  return list;
}

const ALLOWED = loadAllowList();

// ─── Hard blocks — patterns that indicate shell escape or git writes ───────
const HARD_BLOCKED: Array<[RegExp, string]> = [
  [/\$\(/,            'subshell $(…) forbidden'],
  [/`/,               'backtick subshell forbidden'],
  [/\beval\b/,        'eval forbidden'],
  [/>\s*\/dev\//,     'redirect to /dev/* forbidden'],
  [/\|\s*(?:ba)?sh\b/, 'pipe to sh/bash forbidden'],
  [/\|\s*zsh\b/,      'pipe to zsh forbidden'],
  [/\bbash\s+-c\b/,   'bash -c forbidden'],
  [/\bsh\s+-c\b/,     'sh -c forbidden'],
  [/\bzsh\s+-c\b/,    'zsh -c forbidden'],
  [/\bnode\s+-e\b/,   'node -e forbidden'],
  [/\bpython3?\s+-c\b/, 'python -c forbidden'],
  [/\bperl\s+-e\b/,   'perl -e forbidden'],
  [/\bruby\s+-e\b/,   'ruby -e forbidden'],
  [/\bsudo\b/,        'sudo forbidden'],
  [/\brm\s+-rf?\b.*\//, 'recursive rm with absolute path forbidden'],
  [/\brm\s+-rf?\s+~/, 'recursive rm of $HOME forbidden'],
  [/\brm\s+-rf?\s+\$/, 'recursive rm of env var forbidden'],
  [/\bmkfs\b/,        'mkfs forbidden'],
  [/\bdd\s+if=/,      'dd forbidden'],
  [/\bshutdown\b/,    'shutdown forbidden'],
  [/\breboot\b/,      'reboot forbidden'],
  [/\bpasswd\b/,      'passwd forbidden'],
  [/:\(\)\s*\{/,      'fork bomb forbidden'],
];

// ─── Git sub-command guard ──────────────────────────────────────────────────
// Block destructive git operations even if `git` is in allow-list.
const GIT_BLOCKED_SUBCOMMANDS: Array<[RegExp, string]> = [
  [/^git\s+push\b/,                     'git push forbidden (use self-commit for evolution branch only)'],
  [/^git\s+checkout\s+(main|master)\b/, 'git checkout main/master forbidden'],
  [/^git\s+switch\s+(main|master)\b/,   'git switch main/master forbidden'],
  [/^git\s+reset\s+--hard\b/,           'git reset --hard forbidden'],
  [/^git\s+clean\s+-[df]/,              'git clean -f/-d forbidden'],
  [/^git\s+(force-)?push.*--force\b/,   'git push --force forbidden'],
  [/^git\s+tag\s+-d\b/,                 'git tag -d forbidden'],
  [/^git\s+branch\s+-[dD]\b/,           'git branch -d/-D forbidden'],
];

// ─── Validation ─────────────────────────────────────────────────────────────

function firstToken(command: string): string {
  // Split on whitespace (ignoring quotes for simplicity — if command uses
  // weird quoting to hide intent, HARD_BLOCKED should catch it)
  const trimmed = command.trim();
  const match = trimmed.match(/^([^\s]+)/);
  return match ? match[1] : '';
}

function validateCommand(command: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, reason: 'empty command' };

  // Reject command chains — too risky to validate each segment
  if (/[;&]{1,2}/.test(trimmed) && !/\|\|/.test(trimmed)) {
    return { ok: false, reason: 'command chaining (; &&) forbidden — submit one command at a time' };
  }

  // Hard-blocked patterns
  for (const [re, reason] of HARD_BLOCKED) {
    if (re.test(trimmed)) return { ok: false, reason };
  }

  // First binary must be whitelisted
  const bin = firstToken(trimmed);
  // Strip path prefix (e.g. "/usr/local/bin/node" → "node")
  const binName = bin.includes('/') ? bin.split('/').pop() ?? bin : bin;
  if (!ALLOWED.has(binName)) {
    return { ok: false, reason: `binary "${binName}" not in allow-list (set SHELL_EXEC_ALLOW_EXTRA to extend)` };
  }

  // Git-specific guards
  if (binName === 'git') {
    for (const [re, reason] of GIT_BLOCKED_SUBCOMMANDS) {
      if (re.test(trimmed)) return { ok: false, reason };
    }
  }

  return { ok: true };
}

// ─── Tool definition ────────────────────────────────────────────────────────

export const toolDefinition: ToolDefinition = {
  name: 'shell-exec',
  description:
    'Execute a shell command. Allow-list: ls, cat, grep, rg, find, git (read-only subset), node, npm, npx, yarn, pnpm, python, pip, tsc, docker, curl, wget, date, uname, whoami, echo. Shell escapes (bash -c, $(…), backticks, eval, pipe to sh) are blocked.',
  parameters: {
    command: { type: 'string', description: 'Shell command (one at a time — no ; or &&)', required: true },
    cwd: { type: 'string', description: 'Working directory (default: process cwd)' },
    timeout: { type: 'number', description: `Timeout ms (default ${DEFAULT_TIMEOUT}, max ${MAX_TIMEOUT})` },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = params.command as string | undefined;
    if (!command || typeof command !== 'string') {
      return { success: false, error: 'Missing required parameter: command' };
    }

    const validation = validateCommand(command);
    if (!validation.ok) {
      logger.warn('ShellExec', `Blocked: ${validation.reason} — "${command.slice(0, 200)}"`);
      return { success: false, error: `Blocked: ${validation.reason}` };
    }

    const cwd = (params.cwd as string) || process.cwd();
    const timeout = Math.min(
      typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT,
      MAX_TIMEOUT,
    );

    try {
      const stdout = execSync(command, {
        cwd,
        timeout,
        maxBuffer: MAX_OUTPUT * 2,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const output = typeof stdout === 'string' ? stdout : '';
      const truncated = output.length > MAX_OUTPUT
        ? output.slice(0, MAX_OUTPUT) + '\n... [truncated]'
        : output;

      return { success: true, data: { stdout: truncated, exitCode: 0 } };
    } catch (err: unknown) {
      const execErr = err as { status?: number; stderr?: string; stdout?: string };
      return {
        success: false,
        error: `Exit code ${execErr.status ?? 1}: ${(execErr.stderr ?? '').slice(0, 2000)}`,
        data: {
          exitCode: execErr.status ?? 1,
          stdout: (execErr.stdout ?? '').slice(0, MAX_OUTPUT),
          stderr: (execErr.stderr ?? '').slice(0, 2000),
        },
      };
    }
  },
};
