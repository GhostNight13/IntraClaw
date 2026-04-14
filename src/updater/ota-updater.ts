/**
 * INTRACLAW — OTA Updater
 * Checks GitHub releases for newer version, applies git pull
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? 'ayman-idamre';
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? 'intraclaw';

// Suppress unused variable warnings — kept for env-driven future use
void REPO_OWNER;
void REPO_NAME;

function getCurrentVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getLocalChangelog(): string {
  try {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    if (!fs.existsSync(changelogPath)) return 'No CHANGELOG.md found';
    return fs.readFileSync(changelogPath, 'utf8').slice(0, 3000);
  } catch {
    return 'Could not read changelog';
  }
}

function getLatestCommitMessage(): string {
  try {
    return execSync('git log -5 --oneline', { encoding: 'utf8' }).trim();
  } catch {
    return 'Could not read git log';
  }
}

export interface UpdateInfo {
  currentVersion: string;
  currentHash: string;
  hasUpdates: boolean;
  latestLog: string;
  changelog: string;
}

export function checkForUpdates(): UpdateInfo {
  const currentVersion = getCurrentVersion();
  const currentHash = getGitHash();

  let hasUpdates = false;
  let latestLog = '';

  try {
    execSync('git fetch --dry-run 2>&1', { encoding: 'utf8', timeout: 10000 });
    const status = execSync('git status -uno', { encoding: 'utf8', timeout: 5000 });
    hasUpdates = status.includes('behind');
    latestLog = getLatestCommitMessage();
  } catch {
    latestLog = getLatestCommitMessage();
  }

  return {
    currentVersion,
    currentHash,
    hasUpdates,
    latestLog,
    changelog: getLocalChangelog(),
  };
}

export function applyUpdate(): { success: boolean; message: string } {
  logger.info('OTA', 'Applying update via git pull...');
  try {
    const pullResult = execSync('git pull', { encoding: 'utf8', timeout: 60000 });
    logger.info('OTA', `Git pull result: ${pullResult}`);

    // Install any new dependencies
    try {
      execSync('npm install --production', { encoding: 'utf8', timeout: 120000, cwd: process.cwd() });
    } catch (err) {
      logger.warn('OTA', `npm install failed (non-fatal): ${err}`);
    }

    return { success: true, message: pullResult.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('OTA', `Update failed: ${message}`);
    return { success: false, message };
  }
}
