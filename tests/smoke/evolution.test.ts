// Smoke tests — evolution/Ouroboros safety rails.
// Must never allow a commit outside `ouroboros-evolution` branch.
import { describe, it, expect } from 'vitest';
import { isProtected } from '../../src/evolution/bible-guard';
import { readVersion } from '../../src/evolution/version';

describe('bible-guard protects critical paths', () => {
  it('protects BIBLE.md', () => {
    expect(isProtected('src/evolution/BIBLE.md')).toBe(true);
  });

  it('protects bible-guard.ts itself', () => {
    expect(isProtected('src/evolution/bible-guard.ts')).toBe(true);
  });

  it('protects .env', () => {
    expect(isProtected('.env')).toBe(true);
  });

  it('protects .git', () => {
    expect(isProtected('.git/config')).toBe(true);
  });

  it('allows normal source file', () => {
    expect(isProtected('src/tools/vision/index.ts')).toBe(false);
  });
});

describe('version management', () => {
  it('reads current version as semver', () => {
    const v = readVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
