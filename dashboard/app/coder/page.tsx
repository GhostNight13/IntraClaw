'use client';
import { useState } from 'react';
import { Code2, Play, Save, GitDiff, Loader2 } from 'lucide-react';
import DiffViewer from '@/components/DiffViewer';
import RollbackPanel from '@/components/RollbackPanel';

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

interface DiffResult {
  patch: string;
  additions: number;
  deletions: number;
  originalContent?: string;
}

const BASE = 'http://localhost:3001';

export default function CoderPage() {
  const [code, setCode] = useState('// Write Node.js code here\nconsole.log("Hello from IntraClaw!");\n');
  const [lang, setLang] = useState<'node' | 'shell'>('node');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [originalContent, setOriginalContent] = useState('');
  const [pendingWrite, setPendingWrite] = useState(false);
  const [tab, setTab] = useState<'run' | 'write' | 'snapshots'>('run');

  async function runCode() {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, lang }),
      });
      setResult(await r.json() as RunResult);
    } finally {
      setRunning(false);
    }
  }

  async function previewDiff() {
    if (!filePath) return;
    // Fetch the existing file content for DiffViewer's "original" side
    let orig = '';
    try {
      const readR = await fetch(`${BASE}/api/code/read?path=${encodeURIComponent(filePath)}`);
      if (readR.ok) {
        const readData = (await readR.json()) as { content?: string };
        orig = readData.content ?? '';
      }
    } catch {
      // file may not exist yet — treat as empty
    }
    setOriginalContent(orig);

    const r = await fetch(`${BASE}/api/code/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, newContent: code }),
    });
    setDiffResult(await r.json() as DiffResult);
    setPendingWrite(true);
  }

  async function writeFile() {
    if (!filePath) return;
    await fetch(`${BASE}/api/code/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content: code }),
    });
    setDiffResult(null);
    setPendingWrite(false);
  }

  function cancelDiff() {
    setDiffResult(null);
    setPendingWrite(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Code2 className="w-6 h-6 text-green-400" />
        <h1 className="text-2xl font-bold text-white">Agentic Coder</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 w-fit">
        {(['run', 'write', 'snapshots'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); }}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'run' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <select
                value={lang}
                onChange={e => setLang(e.target.value as 'node' | 'shell')}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5"
              >
                <option value="node">Node.js</option>
                <option value="shell">Shell (bash)</option>
              </select>
              <button
                onClick={() => void runCode()}
                disabled={running}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run
              </button>
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              rows={14}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-green-300 text-sm font-mono resize-y focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 min-h-64 font-mono text-sm">
            {result ? (
              <div className="space-y-3">
                <div className="flex gap-3 text-xs text-zinc-500">
                  <span className={result.exitCode === 0 ? 'text-green-400' : 'text-red-400'}>exit {result.exitCode}</span>
                  <span>{result.durationMs}ms</span>
                  {result.timedOut && <span className="text-yellow-400">TIMEOUT</span>}
                </div>
                {result.stdout && <pre className="text-green-300 whitespace-pre-wrap">{result.stdout}</pre>}
                {result.stderr && <pre className="text-red-400 whitespace-pre-wrap">{result.stderr}</pre>}
              </div>
            ) : <p className="text-zinc-600">Output will appear here...</p>}
          </div>
        </div>
      )}

      {tab === 'write' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="/path/to/file.ts"
              value={filePath}
              onChange={e => { setFilePath(e.target.value); setDiffResult(null); setPendingWrite(false); }}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500"
            />
            <button
              onClick={() => void previewDiff()}
              disabled={!filePath}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5"
            >
              <GitDiff className="w-4 h-4" /> Diff
            </button>
            {/* Write button only available when NOT in pending-confirm state */}
            {!pendingWrite && (
              <button
                onClick={() => void writeFile()}
                disabled={!filePath}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Write
              </button>
            )}
          </div>
          <textarea
            value={code}
            onChange={e => { setCode(e.target.value); setDiffResult(null); setPendingWrite(false); }}
            rows={12}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm font-mono resize-y focus:outline-none focus:border-green-500"
          />
          {/* DiffViewer shown after clicking Diff — user must confirm before write */}
          {diffResult && pendingWrite && (
            <DiffViewer
              original={originalContent}
              modified={code}
              filePath={filePath}
              showActions={true}
              onConfirm={() => void writeFile()}
              onCancel={cancelDiff}
            />
          )}
        </div>
      )}

      {tab === 'snapshots' && (
        <RollbackPanel
          filePath={filePath}
          onRollback={(_snapshotId, content) => {
            setCode(content);
            setTab('write');
          }}
        />
      )}
    </div>
  );
}
