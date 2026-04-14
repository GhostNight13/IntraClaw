'use client';
import { useState } from 'react';
import { Code, Play, FileDiff, RotateCcw, Save, Loader2 } from 'lucide-react';

type Language = 'javascript' | 'typescript' | 'python' | 'bash';

export default function CoderPage() {
  const [code, setCode] = useState('// Write code here\nconsole.log("Hello from IntraClaw!");');
  const [language, setLanguage] = useState<Language>('javascript');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [diff, setDiff] = useState('');

  const BASE = 'http://localhost:3001';

  async function run() {
    setRunning(true);
    setOutput('');
    try {
      const r = await fetch(`${BASE}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await r.json() as { stdout: string; stderr: string; exitCode: number; durationMs: number };
      setOutput(`Exit: ${data.exitCode} (${data.durationMs}ms)\n\n${data.stdout}${data.stderr ? '\nSTDERR:\n' + data.stderr : ''}`);
    } catch (err) {
      setOutput(`Error: ${err}`);
    } finally {
      setRunning(false);
    }
  }

  async function previewDiff() {
    if (!filePath || !fileContent) return;
    const r = await fetch(`${BASE}/api/code/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: fileContent }),
    });
    const data = await r.json() as { unified: string; additions: number; deletions: number };
    setDiff(`+${data.additions} -${data.deletions}\n\n${data.unified}`);
  }

  async function writeFile() {
    if (!filePath || !fileContent) return;
    await fetch(`${BASE}/api/code/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: fileContent }),
    });
    alert('File saved with snapshot!');
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Code className="w-6 h-6 text-cyan-400" />
        <h1 className="text-2xl font-bold text-white">Agentic Coder</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code editor */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select value={language} onChange={e => setLanguage(e.target.value as Language)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none">
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="bash">Bash</option>
            </select>
            <button onClick={run} disabled={running}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run
            </button>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)}
            className="w-full h-64 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-green-400 font-mono text-sm resize-none focus:outline-none focus:border-cyan-500"
            spellCheck={false}
          />
          {output && (
            <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 font-mono overflow-x-auto max-h-40">
              {output}
            </pre>
          )}
        </div>

        {/* File writer */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">File Writer</h2>
          <input type="text" placeholder="File path..." value={filePath} onChange={e => setFilePath(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
          />
          <textarea value={fileContent} onChange={e => setFileContent(e.target.value)} rows={8}
            placeholder="File content..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-2">
            <button onClick={previewDiff} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-2 text-sm transition-colors">
              <FileDiff className="w-3.5 h-3.5" /> Preview Diff
            </button>
            <button onClick={writeFile} className="flex items-center gap-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg px-3 py-2 text-sm transition-colors">
              <Save className="w-3.5 h-3.5" /> Write File
            </button>
          </div>
          {diff && (
            <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
              {diff.split('\n').map((line, i) => (
                <span key={i} className={line.startsWith('+') && !line.startsWith('+++') ? 'text-green-400' : line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' : 'text-zinc-400'}>
                  {line}{'\n'}
                </span>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
