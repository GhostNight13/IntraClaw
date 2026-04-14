'use client';
import { useState, useEffect, useCallback } from 'react';
import { Video, Plus, Trash2, FileText, CheckSquare, Loader2, RefreshCw } from 'lucide-react';

type MeetingPlatform = 'zoom' | 'google_meet' | 'teams' | 'other';
type MeetingStatus = 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed';

interface Meeting {
  id: string;
  url: string;
  platform: MeetingPlatform;
  title: string;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  transcript: string | null;
  summary: string | null;
  actionItems: string[];
  createdAt: string;
}

interface Stats {
  total: number;
  completed: number;
  totalActionItems: number;
}

const BASE = 'http://localhost:3001';

const STATUS_BADGE: Record<MeetingStatus, string> = {
  scheduled:  'bg-blue-950 border-blue-700 text-blue-300',
  recording:  'bg-red-950 border-red-700 text-red-300',
  processing: 'bg-yellow-950 border-yellow-700 text-yellow-300',
  completed:  'bg-green-950 border-green-700 text-green-300',
  failed:     'bg-red-950 border-red-700 text-red-400',
};

const PLATFORM_LABEL: Record<MeetingPlatform, string> = {
  zoom:        'Zoom',
  google_meet: 'Google Meet',
  teams:       'Teams',
  other:       'Other',
};

const PLATFORM_COLOR: Record<MeetingPlatform, string> = {
  zoom:        'text-blue-400',
  google_meet: 'text-green-400',
  teams:       'text-purple-400',
  other:       'text-zinc-400',
};

function detectPlatform(url: string): MeetingPlatform {
  if (url.includes('zoom.us'))             return 'zoom';
  if (url.includes('meet.google.com'))     return 'google_meet';
  if (url.includes('teams.microsoft.com')) return 'teams';
  return 'other';
}

export default function MeetingsPage() {
  const [meetings, setMeetings]           = useState<Meeting[]>([]);
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [selected, setSelected]           = useState<Meeting | null>(null);
  const [newUrl, setNewUrl]               = useState('');
  const [newTitle, setNewTitle]           = useState('');
  const [transcriptInput, setTranscriptInput] = useState('');
  const [processing, setProcessing]       = useState(false);
  const [creating, setCreating]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/meetings`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json() as Meeting[];
      setMeetings(data);
      // Refresh selected meeting to pick up latest state
      setSelected(prev => prev ? (data.find(m => m.id === prev.id) ?? prev) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/meetings/stats`);
      if (r.ok) setStats(await r.json() as Stats);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    void loadMeetings();
    void loadStats();
  }, [loadMeetings, loadStats]);

  async function createMeeting() {
    if (!newUrl.trim() || !newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), title: newTitle.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      setNewUrl('');
      setNewTitle('');
      await Promise.all([loadMeetings(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function deleteMeeting(id: string) {
    try {
      await fetch(`${BASE}/api/meetings/${id}`, { method: 'DELETE' });
      if (selected?.id === id) setSelected(null);
      await Promise.all([loadMeetings(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitTranscript() {
    if (!selected || !transcriptInput.trim()) return;
    setProcessing(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/meetings/${selected.id}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptInput.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json() as Meeting;
      setSelected(updated);
      setTranscriptInput('');
      await Promise.all([loadMeetings(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }

  const detectedPlatform = newUrl ? detectPlatform(newUrl) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Video className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Meeting Bot</h1>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex gap-4 text-sm text-zinc-400">
              <span>{stats.total} meetings</span>
              <span>{stats.completed} completed</span>
              <span>{stats.totalActionItems} action items</span>
            </div>
          )}
          <button
            onClick={() => { void loadMeetings(); void loadStats(); }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: list + add form */}
        <div className="lg:col-span-1 space-y-4">
          {/* Add Meeting form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Meeting
            </h2>
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="Meeting URL (Zoom, Google Meet, Teams…)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            {detectedPlatform && (
              <p className={`text-xs ${PLATFORM_COLOR[detectedPlatform]}`}>
                Detected: {PLATFORM_LABEL[detectedPlatform]}
              </p>
            )}
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void createMeeting()}
              placeholder="Meeting title"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => void createMeeting()}
              disabled={creating || !newUrl.trim() || !newTitle.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Add Meeting'}
            </button>
          </div>

          {/* Meeting list */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {meetings.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-8">No meetings yet</p>
            )}
            {meetings.map(m => (
              <div
                key={m.id}
                onClick={() => { setSelected(m); setTranscriptInput(''); }}
                className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selected?.id === m.id ? 'border-indigo-500 bg-indigo-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs ${PLATFORM_COLOR[m.platform]}`}>
                      {PLATFORM_LABEL[m.platform]}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[m.status]}`}>
                      {m.status}
                    </span>
                    {m.actionItems.length > 0 && (
                      <span className="text-xs text-zinc-500">{m.actionItems.length} actions</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={ev => { ev.stopPropagation(); void deleteMeeting(m.id); }}
                  className="text-zinc-600 hover:text-red-400 transition-colors ml-2 mt-0.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: meeting detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              {/* Meeting header */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-white font-semibold text-lg">{selected.title}</h2>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`text-sm ${PLATFORM_COLOR[selected.platform]}`}>
                        {PLATFORM_LABEL[selected.platform]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[selected.status]}`}>
                        {selected.status}
                      </span>
                    </div>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-zinc-300 mt-1 block truncate"
                    >
                      {selected.url}
                    </a>
                  </div>
                </div>
              </div>

              {/* Transcript input */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Transcript
                </h3>
                {selected.transcript && (
                  <div className="bg-zinc-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{selected.transcript}</pre>
                  </div>
                )}
                <textarea
                  value={transcriptInput}
                  onChange={e => setTranscriptInput(e.target.value)}
                  placeholder={selected.transcript ? 'Paste new/updated transcript to re-process…' : 'Paste meeting transcript here…'}
                  rows={6}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
                />
                <button
                  onClick={() => void submitTranscript()}
                  disabled={processing || !transcriptInput.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing with AI…
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4" />
                      Process Transcript
                    </>
                  )}
                </button>
              </div>

              {/* Summary */}
              {selected.summary && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Summary
                  </h3>
                  <p className="text-sm text-zinc-300 whitespace-pre-line">{selected.summary}</p>
                </div>
              )}

              {/* Action items */}
              {selected.actionItems.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-green-400" /> Action Items ({selected.actionItems.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {selected.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="mt-0.5 w-4 h-4 rounded border border-zinc-600 shrink-0 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-sm bg-zinc-600" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-12 text-center text-sm min-h-[300px]">
              Select a meeting to view details or process a transcript
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
