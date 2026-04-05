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

function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return `[${ts}] [${level.toUpperCase().padEnd(5)}] [${module}] ${message}${dataStr}`;
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
