import * as diffLib from 'diff';
import type { DiffResult } from './types';

export function generateUnifiedDiff(original: string, modified: string, filename = 'file'): DiffResult {
  const patch = diffLib.createPatch(filename, original, modified, 'original', 'modified');
  const lines = patch.split('\n');
  const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
  return { unified: patch, additions, deletions, hasChanges: additions > 0 || deletions > 0 };
}

export function applyPatch(original: string, patch: string): string {
  const result = diffLib.applyPatch(original, patch);
  if (result === false) throw new Error('Patch failed to apply');
  return result;
}

export function generateLineDiff(original: string, modified: string): { type: 'added' | 'removed' | 'unchanged'; value: string }[] {
  const changes = diffLib.diffLines(original, modified);
  return changes.map(c => ({
    type: c.added ? 'added' : c.removed ? 'removed' : 'unchanged',
    value: c.value,
  }));
}
