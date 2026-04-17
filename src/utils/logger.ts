import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'warn' | 'error';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `intraclaw-${date}.log`);
}

function rotateLogs(): void {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('intraclaw-') && f.endsWith('.log'))
      .sort();

    const today = new Date().toISOString().slice(0, 10);
    const retentionDays = 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    for (const file of files) {
      const dateStr = file.replace('intraclaw-', '').replace('.log', '');
      if (dateStr < cutoffStr && dateStr !== today) {
        fs.unlinkSync(path.join(LOG_DIR, file));
      }
    }
  } catch {
    // silent — rotation failure must never crash the agent
  }
}

// ─── Secret redaction ───────────────────────────────────────────────────────
// Prevents API keys and tokens from leaking into log files. Applied to both
// the message and any serialized data.
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9-_]{20,}/g,       '[REDACTED_ANTHROPIC_KEY]'],
  [/sk-[A-Za-z0-9]{20,}/g,             '[REDACTED_OPENAI_KEY]'],
  [/ghp_[A-Za-z0-9]{20,}/g,            '[REDACTED_GITHUB_PAT]'],
  [/ghs_[A-Za-z0-9]{20,}/g,            '[REDACTED_GITHUB_APP]'],
  [/github_pat_[A-Za-z0-9_]{20,}/g,    '[REDACTED_GITHUB_PAT]'],
  [/xox[abprs]-[A-Za-z0-9-]{20,}/g,    '[REDACTED_SLACK_TOKEN]'],
  [/AIza[A-Za-z0-9_-]{35}/g,           '[REDACTED_GOOGLE_KEY]'],
  [/AKIA[0-9A-Z]{16}/g,                '[REDACTED_AWS_ACCESS_KEY]'],
  [/bot\d+:[A-Za-z0-9_-]{35}/g,        '[REDACTED_TELEGRAM_BOT]'],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/gi,   'Bearer [REDACTED]'],
  [/("password"\s*:\s*)"[^"]+"/g,      '$1"[REDACTED]"'],
  [/("api[_-]?key"\s*:\s*)"[^"]+"/gi,  '$1"[REDACTED]"'],
  [/("secret"\s*:\s*)"[^"]+"/gi,       '$1"[REDACTED]"'],
  [/("token"\s*:\s*)"[^"]+"/gi,        '$1"[REDACTED]"'],
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement);
  return out;
}

function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return redactSecrets(`[${ts}] [${level.toUpperCase().padEnd(5)}] [${module}] ${message}${dataStr}`);
}

function write(level: LogLevel, module: string, message: string, data?: unknown): void {
  ensureLogDir();
  const line = formatMessage(level, module, message, data);

  // stdout
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }

  // file
  try {
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf8');
  } catch {
    // ignore write errors
  }
}

// Rotate once at startup
ensureLogDir();
rotateLogs();

export const logger = {
  info(module: string, message: string, data?: unknown): void {
    write('info', module, message, data);
  },
  warn(module: string, message: string, data?: unknown): void {
    write('warn', module, message, data);
  },
  error(module: string, message: string, data?: unknown): void {
    write('error', module, message, data);
  },
};
