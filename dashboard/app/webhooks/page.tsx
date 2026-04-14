'use client';
import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react';

interface WebhookEntry {
  id: string;
  name: string;
  urlPath: string;
  eventType: string;
  enabled: boolean;
  fireCount: number;
  lastFiredAt: string | null;
  createdAt: string;
}

interface CreateResult {
  webhook: WebhookEntry;
  secret: string;
  note: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('agent.task');
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const BASE = 'http://localhost:3001';

  async function load() {
    const r = await fetch(`${BASE}/api/webhooks`);
    setWebhooks(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${BASE}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, eventType }),
      });
      const data: CreateResult = await r.json();
      setNewSecret({ id: data.webhook.id, secret: data.secret });
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    await fetch(`${BASE}/api/webhooks/${id}`, { method: 'DELETE' });
    await load();
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Webhook className="w-6 h-6 text-orange-400" />
        <h1 className="text-2xl font-bold text-white">Webhooks</h1>
      </div>

      {/* Create form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Create Webhook</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Webhook name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          >
            <option value="agent.task">Agent Task</option>
            <option value="notification.send">Notification</option>
            <option value="workflow.trigger">Workflow</option>
            <option value="custom">Custom</option>
          </select>
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {/* New secret reveal */}
      {newSecret && (
        <div className="bg-yellow-950/50 border border-yellow-800 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 font-medium text-sm mb-2">Save this secret — shown only once</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-900 rounded px-3 py-2 text-xs font-mono text-yellow-300 break-all">{newSecret.secret}</code>
            <button onClick={() => copy(newSecret.secret, 'secret')} className="text-zinc-400 hover:text-white">
              {copiedId === 'secret' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-zinc-500 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Webhook list */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">No webhooks yet</div>
        ) : webhooks.map(wh => (
          <div key={wh.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">{wh.name}</span>
                  <span className="text-xs bg-orange-950/50 border border-orange-900 text-orange-400 rounded-full px-2 py-0.5">{wh.eventType}</span>
                  {!wh.enabled && <span className="text-xs text-zinc-600">(disabled)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-zinc-500 font-mono truncate">{BASE}{wh.urlPath}</code>
                  <button onClick={() => copy(`${BASE}${wh.urlPath}`, wh.id)} className="text-zinc-600 hover:text-white flex-shrink-0">
                    {copiedId === wh.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-zinc-600">
                  <span>Fires: {wh.fireCount}</span>
                  {wh.lastFiredAt && <span>Last: {new Date(wh.lastFiredAt).toLocaleString()}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <a href={`${BASE}/api/webhooks/${wh.id}/logs`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white p-1">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button onClick={() => remove(wh.id)} className="text-zinc-500 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
