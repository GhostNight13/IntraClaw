'use client';
import { useState, useEffect } from 'react';
import { TestTube2, Play, Trophy, Plus, Loader2 } from 'lucide-react';

interface ABExperiment {
  id: string;
  name: string;
  promptA: string;
  promptB: string;
  metric: string;
  runsA: number;
  runsB: number;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  active: boolean;
  createdAt: string;
}

const BASE = 'http://localhost:3001';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', promptA: '', promptB: '', metric: 'response_length' });

  async function load() {
    const r = await fetch(`${BASE}/api/experiments`);
    setExperiments(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create() {
    await fetch(`${BASE}/api/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCreating(false);
    setForm({ name: '', promptA: '', promptB: '', metric: 'response_length' });
    load();
  }

  async function runExp(id: string) {
    setRunning(id);
    await fetch(`${BASE}/api/experiments/${id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setRunning(null);
    load();
  }

  async function conclude(id: string) {
    await fetch(`${BASE}/api/experiments/${id}/conclude`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <TestTube2 className="w-6 h-6 text-pink-400" />
          <h1 className="text-2xl font-bold text-white">A/B Prompt Testing</h1>
        </div>
        <button onClick={() => setCreating(!creating)}
          className="bg-pink-600 hover:bg-pink-500 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors">
          <Plus className="w-4 h-4" /> New Experiment
        </button>
      </div>

      {creating && (
        <div className="bg-zinc-900 border border-pink-900/50 rounded-xl p-5 mb-6 space-y-4">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Experiment name..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Prompt A</label>
              <textarea value={form.promptA} onChange={e => setForm({ ...form, promptA: e.target.value })} rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-pink-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Prompt B</label>
              <textarea value={form.promptB} onChange={e => setForm({ ...form, promptB: e.target.value })} rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-pink-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="response_length">Response Length</option>
              <option value="latency">Latency (speed)</option>
            </select>
            <button onClick={create} className="bg-pink-600 hover:bg-pink-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Create</button>
            <button onClick={() => setCreating(false)} className="text-zinc-500 hover:text-white text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {experiments.length === 0 && <p className="text-center text-zinc-600 py-12">No experiments yet</p>}
        {experiments.map(exp => (
          <div key={exp.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">{exp.name}</h3>
                  {exp.winner && (
                    <span className="text-xs bg-yellow-950/50 border border-yellow-800 text-yellow-400 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Winner: {exp.winner.toUpperCase()}
                    </span>
                  )}
                  {exp.active && !exp.winner && (
                    <span className="text-xs bg-pink-950/50 border border-pink-800 text-pink-400 rounded-full px-2 py-0.5">Active</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Metric: {exp.metric}</p>
              </div>
              <div className="flex gap-2">
                {exp.active && (
                  <>
                    <button onClick={() => runExp(exp.id)} disabled={running === exp.id}
                      className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors">
                      {running === exp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run
                    </button>
                    {(exp.runsA + exp.runsB) > 0 && (
                      <button onClick={() => conclude(exp.id)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-yellow-400 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors">
                        <Trophy className="w-3 h-3" /> Conclude
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['a', 'b'] as const).map(v => {
                const runs = v === 'a' ? exp.runsA : exp.runsB;
                const score = v === 'a' ? exp.scoreA : exp.scoreB;
                const isWinner = exp.winner === v;
                return (
                  <div key={v} className={`rounded-lg p-3 border ${isWinner ? 'border-yellow-700 bg-yellow-950/20' : 'border-zinc-700 bg-zinc-800'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold ${isWinner ? 'text-yellow-400' : 'text-zinc-300'}`}>Variant {v.toUpperCase()}</span>
                      <span className="text-xs text-zinc-500">{runs} runs</span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mb-2">{v === 'a' ? exp.promptA : exp.promptB}</p>
                    <div className="bg-zinc-700 rounded-full h-1.5">
                      <div className={`h-full rounded-full transition-all ${isWinner ? 'bg-yellow-500' : 'bg-zinc-500'}`} style={{ width: `${score * 100}%` }} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">score: {score.toFixed(3)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
