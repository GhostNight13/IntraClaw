'use client';
import { useState, useEffect, useRef } from 'react';
import { Brain, Zap, Wrench, CheckCircle, AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface ThoughtStep {
  id?: string;
  taskId: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'step' | 'done' | 'error';
  content: string;
  stepIndex: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  timestamp?: string;
}

const TYPE_CONFIG = {
  thinking: { icon: Brain, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-900', label: 'Thinking' },
  tool_call: { icon: Wrench, color: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-900', label: 'Tool Call' },
  tool_result: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-950/30 border-green-900', label: 'Result' },
  step: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-900', label: 'Step' },
  done: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-900', label: 'Done' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/30 border-red-900', label: 'Error' },
};

function ThoughtCard({ step, collapsed, onToggle }: { step: ThoughtStep; collapsed: boolean; onToggle: () => void }) {
  const config = TYPE_CONFIG[step.type] ?? TYPE_CONFIG.step;
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg overflow-hidden ${config.bg}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
        <span className={`text-xs font-medium ${config.color} w-20 flex-shrink-0`}>{config.label}</span>
        <span className="text-sm text-zinc-300 flex-1 truncate">{step.content}</span>
        <span className="text-xs text-zinc-600 flex-shrink-0">#{step.stepIndex}</span>
        {collapsed ? <ChevronRight className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 border-t border-white/5 pt-3">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{step.content}</p>
          {step.metadata && Object.keys(step.metadata).length > 0 && (
            <pre className="mt-2 text-xs text-zinc-500 overflow-x-auto">
              {JSON.stringify(step.metadata, null, 2)}
            </pre>
          )}
          {(step.createdAt ?? step.timestamp) && (
            <p className="mt-2 text-xs text-zinc-600">
              {new Date(step.createdAt ?? step.timestamp ?? '').toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReasoningPage() {
  const [steps, setSteps] = useState<ThoughtStep[]>([]);
  const [taskId, setTaskId] = useState('');
  const [connected, setConnected] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  function connect(id: string) {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`http://localhost:3001/api/stream/thoughts?taskId=${encodeURIComponent(id)}`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      const step: ThoughtStep = JSON.parse(e.data);
      setSteps(prev => [...prev, step]);
    };
    es.onerror = () => setConnected(false);
  }

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, autoScroll]);

  useEffect(() => () => esRef.current?.close(), []);

  function loadRecent() {
    fetch('http://localhost:3001/api/reasoning/recent')
      .then(r => r.json())
      .then(data => setSteps(data))
      .catch(() => {});
  }

  function toggleCollapse(index: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(steps.map((_, i) => i)));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Chain of Thought</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-xs text-zinc-400">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Task ID to watch..."
          value={taskId}
          onChange={e => setTaskId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && taskId && connect(taskId)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => taskId && connect(taskId)}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Watch
        </button>
        <button
          onClick={loadRecent}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-3 py-2 transition-colors"
          title="Load recent thoughts"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-500">{steps.length} steps</span>
        <div className="flex gap-2">
          <button onClick={collapseAll} className="text-xs text-zinc-500 hover:text-white transition-colors">
            Collapse all
          </button>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
            <Brain className="w-12 h-12" />
            <div className="text-center">
              <p className="text-sm font-medium">No thoughts yet</p>
              <p className="text-xs mt-1">Enter a task ID to stream live reasoning, or load recent</p>
            </div>
          </div>
        ) : (
          steps.map((step, i) => (
            <ThoughtCard
              key={`${step.taskId}-${step.stepIndex}-${i}`}
              step={step}
              collapsed={collapsed.has(i)}
              onToggle={() => toggleCollapse(i)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
