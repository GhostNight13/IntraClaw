'use client';
import { useState } from 'react';
import { Code2, Play, Save, RotateCcw, GitDiff, Loader2 } from 'lucide-react';

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
}

interface Snapshot {
  id: string;
  filePath: string;
  createdAt: string;
}

const BASE = 'http://localhost:3001';

export default function CoderPage() {
  const [code, setCode] = useState('// Write Node.js code here\nconsole.log("Hello from IntraClaw!");\n');
  const [lang, setLang] = useState<'node' | 'shell'>('node');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
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
    const r = await fetch(`${BASE}/api/code/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, newContent: code }),
    });
    setDiffResult(await r.json() as DiffResult);
  }

  async function writeFile() {
    if (!filePath) return;
    await fetch(`${BASE}/api/code/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content: code }),
    });
    setDiffResult(null);
    await loadSnapshots();
  }

  async function loadSnapshots() {
    const url = filePath
      ? `${BASE}/api/code/snapshots?path=${encodeURIComponent(filePath)}`
      : `${BASE}/api/code/snapshots`;
    const r = await fetch(url);
    setSnapshots(await r.json() as Snapshot[]);
  }

  async function rollback(id: string) {
    await fetch(`${BASE}/api/code/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotId: id }),
    });
    await loadSnapshots();
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
            onClick={() => { setTab(t); if (t === 'snapshots') void loadSnapshots(); }}
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
              onChange={e => setFilePath(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500"
            />
            <button
              onClick={() => void previewDiff()}
              className="bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5"
            >
              <GitDiff className="w-4 h-4" /> Diff
            </button>
            <button
              onClick={() => void writeFile()}
              className="bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Write
            </button>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            rows={12}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm font-mono resize-y focus:outline-none focus:border-green-500"
          />
          {diffResult && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
              <div className="flex gap-4 text-xs mb-3">
                <span className="text-green-400">+{diffResult.additions} additions</span>
                <span className="text-red-400">-{diffResult.deletions} deletions</span>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300 overflow-x-auto max-h-64">{diffResult.patch}</pre>
            </div>
          )}
        </div>
      )}

      {tab === 'snapshots' && (
        <div className="space-y-3">
          {snapshots.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No snapshots yet</p>
          ) : snapshots.map(snap => (
            <div key={snap.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-mono">{snap.filePath}</p>
                <p className="text-zinc-500 text-xs">{new Date(snap.createdAt).toLocaleString()} · {snap.id}</p>
              </div>
              <button
                onClick={() => void rollback(snap.id)}
                className="text-zinc-400 hover:text-orange-400 transition-colors flex items-center gap-1 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
