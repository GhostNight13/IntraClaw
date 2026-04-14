'use client';
import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
  filePath: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

type DiffLineKind = 'added' | 'removed' | 'unchanged';

interface DiffLine {
  kind: DiffLineKind;
  content: string;
  lineNo: number | null;
}

/** Very simple LCS-based unified diff (no external deps). */
function computeDiff(original: string, modified: string): DiffLine[] {
  const origLines = original === '' ? [] : original.split('\n');
  const modLines = modified === '' ? [] : modified.split('\n');

  const oLen = origLines.length;
  const mLen = modLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: oLen + 1 }, () =>
    new Array<number>(mLen + 1).fill(0),
  );
  for (let i = 1; i <= oLen; i++) {
    for (let j = 1; j <= mLen; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = oLen;
  let j = mLen;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      result.unshift({ kind: 'unchanged', content: origLines[i - 1], lineNo: i });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ kind: 'added', content: modLines[j - 1], lineNo: j });
      j--;
    } else {
      result.unshift({ kind: 'removed', content: origLines[i - 1], lineNo: i });
      i--;
    }
  }

  return result;
}

function lineClasses(kind: DiffLineKind): { row: string; prefix: string } {
  switch (kind) {
    case 'added':
      return { row: 'bg-green-950/60 border-l-2 border-green-500', prefix: 'text-green-400' };
    case 'removed':
      return { row: 'bg-red-950/60 border-l-2 border-red-500', prefix: 'text-red-400' };
    default:
      return { row: 'border-l-2 border-transparent', prefix: 'text-zinc-600' };
  }
}

export default function DiffViewer({
  original,
  modified,
  filePath,
  onConfirm,
  onCancel,
  showActions = true,
}: DiffViewerProps) {
  const lines = useMemo(() => computeDiff(original, modified), [original, modified]);

  const additions = lines.filter(l => l.kind === 'added').length;
  const deletions = lines.filter(l => l.kind === 'removed').length;

  const hasChanges = additions > 0 || deletions > 0;

  return (
    <div className="rounded-xl border border-zinc-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-800/80 border-b border-zinc-700">
        <span className="text-sm font-mono text-zinc-200 truncate max-w-xs" title={filePath}>
          {filePath || '(untitled)'}
        </span>
        <div className="flex items-center gap-4 text-xs shrink-0">
          {hasChanges ? (
            <>
              <span className="text-green-400 font-medium">+{additions}</span>
              <span className="text-red-400 font-medium">-{deletions}</span>
            </>
          ) : (
            <span className="text-zinc-500">No changes</span>
          )}
        </div>
      </div>

      {/* Diff body */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const { row, prefix } = lineClasses(line.kind);
              const symbol =
                line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' ';
              return (
                <tr key={idx} className={`${row} hover:brightness-110 transition-all`}>
                  <td className="select-none w-10 text-right pr-3 py-0.5 text-zinc-600 border-r border-zinc-800">
                    {line.lineNo ?? ''}
                  </td>
                  <td className={`select-none w-5 text-center py-0.5 ${prefix}`}>{symbol}</td>
                  <td className="pl-2 pr-4 py-0.5 whitespace-pre text-zinc-200">
                    {line.content}
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-6 text-zinc-600">
                  Empty file
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-zinc-800/60 border-t border-zinc-700">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-green-700 hover:bg-green-600 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Write
            </button>
          )}
        </div>
      )}
    </div>
  );
}
