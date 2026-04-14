import * as fs from 'fs';
import * as path from 'path';

export function isFirstRun(): boolean {
  const envPath  = path.join(process.cwd(), '.env');
  const flagPath = path.join(process.cwd(), 'data', '.setup-complete');
  return !fs.existsSync(envPath) || !fs.existsSync(flagPath);
}

export function markSetupComplete(): void {
  const flagDir  = path.join(process.cwd(), 'data');
  const flagPath = path.join(flagDir, '.setup-complete');
  if (!fs.existsSync(flagDir)) fs.mkdirSync(flagDir, { recursive: true });
  fs.writeFileSync(flagPath, new Date().toISOString());
}

export function getSetupDate(): string | null {
  const flagPath = path.join(process.cwd(), 'data', '.setup-complete');
  if (!fs.existsSync(flagPath)) return null;
  return fs.readFileSync(flagPath, 'utf-8').trim();
}
