'use client';
import { useState, useEffect } from 'react';
import { Network, Plus, Search, Trash2, Link } from 'lucide-react';

interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  updatedAt: string;
}

interface Neighbor {
  entity: Entity;
  relation: { id: string; type: string; weight: number };
}

const TYPE_COLORS: Record<string, string> = {
  person: 'bg-blue-950 border-blue-700 text-blue-300',
  company: 'bg-purple-950 border-purple-700 text-purple-300',
  project: 'bg-green-950 border-green-700 text-green-300',
  task: 'bg-yellow-950 border-yellow-700 text-yellow-300',
  concept: 'bg-pink-950 border-pink-700 text-pink-300',
  tool: 'bg-cyan-950 border-cyan-700 text-cyan-300',
  document: 'bg-orange-950 border-orange-700 text-orange-300',
};

export default function GraphPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('person');
  const [stats, setStats] = useState<{ entityCount: number; relationshipCount: number } | null>(null);
  const BASE = 'http://localhost:3001';

  async function loadEntities(q = '') {
    const url = q ? `${BASE}/api/graph/entities?q=${encodeURIComponent(q)}` : `${BASE}/api/graph/entities`;
    const r = await fetch(url);
    setEntities(await r.json());
  }

  async function loadStats() {
    const r = await fetch(`${BASE}/api/graph/stats`);
    setStats(await r.json());
  }

  async function selectEntity(e: Entity) {
    setSelected(e);
    const r = await fetch(`${BASE}/api/graph/entities/${e.id}/neighbors`);
    setNeighbors(await r.json());
  }

  async function createEntity() {
    if (!newName.trim()) return;
    await fetch(`${BASE}/api/graph/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newType, name: newName }),
    });
    setNewName('');
    await loadEntities(search);
    await loadStats();
  }

  async function deleteEntity(id: string) {
    await fetch(`${BASE}/api/graph/entities/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    await loadEntities(search);
    await loadStats();
  }

  useEffect(() => { loadEntities(); loadStats(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Graph Memory</h1>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm text-zinc-400">
            <span>{stats.entityCount} entities</span>
            <span>{stats.relationshipCount} relationships</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={search} onChange={e => { setSearch(e.target.value); loadEntities(e.target.value); }}
                placeholder="Search entities..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
              {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createEntity()}
              placeholder="Entity name..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
            <button onClick={createEntity} className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-2 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {entities.map(e => (
              <div key={e.id} onClick={() => selectEntity(e)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selected?.id === e.id ? 'border-violet-500 bg-violet-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[e.type] ?? 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>{e.type}</span>
                  <span className="text-white text-sm">{e.name}</span>
                </div>
                <button onClick={ev => { ev.stopPropagation(); deleteEntity(e.id); }} className="text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Selected entity detail */}
        <div>
          {selected ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[selected.type] ?? 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>{selected.type}</span>
                <h3 className="text-white font-semibold mt-2">{selected.name}</h3>
              </div>
              {neighbors.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1"><Link className="w-3 h-3" /> {neighbors.length} connections</p>
                  <div className="space-y-1.5">
                    {neighbors.map(({ entity: n, relation: r }) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">{r.type}</span>
                        <span className="text-white">{n.name}</span>
                        <span className={`px-1.5 rounded ${TYPE_COLORS[n.type] ?? ''}`}>{n.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(selected.properties).length > 0 && (
                <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">{JSON.stringify(selected.properties, null, 2)}</pre>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-8 text-center text-sm">
              Select an entity to see its connections
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
