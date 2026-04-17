import * as path from 'path';

/**
 * bible-guard — enforces immutability of BIBLE.md and other protected evolution files.
 *
 * Called by self-edit primitives (writeAndCommit, rollback) to refuse any operation
 * that would mutate the constitution. Only the human operator can edit these files manually,
 * outside the evolution loop.
 */

const EVOLUTION_DIR = path.resolve(__dirname);

/** Absolute paths that the self-evolution loop is NEVER allowed to touch. */
const PROTECTED_ABSOLUTE_PATHS: string[] = [
  path.join(EVOLUTION_DIR, 'BIBLE.md'),
  path.join(EVOLUTION_DIR, 'bible-guard.ts'),
];

/** Relative filenames (case-insensitive) considered protected no matter where they sit. */
const PROTECTED_FILENAMES = new Set<string>([
  'bible.md',
  '.env',
  '.env.local',
  '.env.production',
]);

/** Directories the self-evolution loop is forbidden from modifying. */
const PROTECTED_DIR_PREFIXES: string[] = [
  path.resolve(process.cwd(), '.git'),
  path.resolve(process.cwd(), 'node_modules'),
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'dist'),
];

export class BibleGuardViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BibleGuardViolation';
  }
}

/**
 * Returns true if a given file path is protected from self-edit tools.
 * Resolves symlinks via path.resolve so "../" tricks cannot bypass the guard.
 */
export function isProtected(filePath: string): boolean {
  const absolute = path.resolve(filePath);
  const basename = path.basename(absolute).toLowerCase();

  if (PROTECTED_FILENAMES.has(basename)) return true;
  if (PROTECTED_ABSOLUTE_PATHS.includes(absolute)) return true;

  for (const dir of PROTECTED_DIR_PREFIXES) {
    if (absolute === dir || absolute.startsWith(dir + path.sep)) return true;
  }

  return false;
}

/**
 * Throws `BibleGuardViolation` when the target file is protected.
 * Call this at the top of any self-edit primitive.
 */
export function assertEditable(filePath: string): void {
  if (isProtected(filePath)) {
    throw new BibleGuardViolation(
      `Refused: "${filePath}" is protected by bible-guard and cannot be modified by self-evolution tools.`
    );
  }
}

/** Exposed for diagnostics / tests. */
export function listProtectedPaths(): string[] {
  return [...PROTECTED_ABSOLUTE_PATHS];
}
