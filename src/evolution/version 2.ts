import * as fs from 'fs';
import * as path from 'path';

/**
 * version — semver helper for the Ouroboros self-evolution loop.
 * Stores the current version in `src/evolution/VERSION` (single line, no prefix).
 */

const VERSION_PATH = path.resolve(__dirname, 'VERSION.txt');
const DEFAULT_VERSION = '0.1.0';

export type BumpType = 'patch' | 'minor' | 'major';

interface SemVer { major: number; minor: number; patch: number }

function parse(input: string): SemVer {
  const match = input.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semver: "${input}"`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function format(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** Reads VERSION; creates it with 0.1.0 if missing. */
export function readVersion(): string {
  if (!fs.existsSync(VERSION_PATH)) {
    fs.writeFileSync(VERSION_PATH, DEFAULT_VERSION + '\n', 'utf8');
    return DEFAULT_VERSION;
  }
  const raw = fs.readFileSync(VERSION_PATH, 'utf8').trim();
  try {
    parse(raw);
    return raw;
  } catch {
    // File is corrupt — heal it.
    fs.writeFileSync(VERSION_PATH, DEFAULT_VERSION + '\n', 'utf8');
    return DEFAULT_VERSION;
  }
}

/** Increments the version and persists the new value. Returns the new string. */
export function bumpVersion(type: BumpType = 'patch'): string {
  const current = parse(readVersion());
  let next: SemVer;
  switch (type) {
    case 'major': next = { major: current.major + 1, minor: 0, patch: 0 }; break;
    case 'minor': next = { major: current.major, minor: current.minor + 1, patch: 0 }; break;
    case 'patch': next = { major: current.major, minor: current.minor, patch: current.patch + 1 }; break;
  }
  const str = format(next);
  fs.writeFileSync(VERSION_PATH, str + '\n', 'utf8');
  return str;
}

/** Test helper: force-write a specific version. */
export function writeVersion(v: string): void {
  parse(v); // validate
  fs.writeFileSync(VERSION_PATH, v + '\n', 'utf8');
}
