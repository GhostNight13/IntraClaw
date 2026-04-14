import { diffLines, createPatch, applyPatch as applyDiffPatch } from 'diff';
import type { DiffResult } from './types';

export function generateDiff(filePath: string, original: string, modified: string): DiffResult {
  const changes = diffLines(original, modified);
  const patch = createPatch(filePath, original, modified);

  let additions = 0;
  let deletions = 0;
  for (const change of changes) {
    const lines = (change.value.match(/\n/g) ?? []).length;
    if (change.added) additions += lines;
    if (change.removed) deletions += lines;
  }

  return { filePath, original, modified, patch, additions, deletions };
}

export function hasDiff(original: string, modified: string): boolean {
  return original !== modified;
}

// Legacy alias kept for backward compatibility
export function generateUnifiedDiff(original: string, modified: string, filename = 'file'): DiffResult {
  return generateDiff(filename, original, modified);
}

export function applyPatch(original: string, patch: string): string {
  const result = applyDiffPatch(original, patch);
  if (result === false) throw new Error('Patch failed to apply');
  return result;
}

export function generateLineDiff(original: string, modified: string): { type: 'added' | 'removed' | 'unchanged'; value: string }[] {
  const changes = diffLines(original, modified);
  return changes.map(c => ({
    type: c.added ? 'added' : c.removed ? 'removed' : 'unchanged',
    value: c.value,
  }));
}
