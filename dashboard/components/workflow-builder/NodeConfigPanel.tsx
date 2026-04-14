'use client';

import { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { X } from 'lucide-react';
import { NodeType, WorkflowNodeConfig } from '@/lib/workflows-api';
import { NODE_META } from './NodeTypes';

interface NodeData {
  type: NodeType;
  label: string;
  config: WorkflowNodeConfig;
}

interface NodeConfigPanelProps {
  node: Node<NodeData>;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
  onClose: () => void;
}

function msToHuman(ms: number): string {
  if (!ms || ms < 1000) return `${ms ?? 0}ms`;
  if (ms < 60_000) return `${ms / 1000}s`;
  if (ms < 3_600_000) return `${ms / 60_000} min`;
  return `${ms / 3_600_000}h`;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 10px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 5,
  display: 'block',
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  marginTop: 4,
  fontFamily: 'var(--font-mono, monospace)',
};

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.data.label);
  const [config, setConfig] = useState<WorkflowNodeConfig>(node.data.config ?? {});

  useEffect(() => {
    setLabel(node.data.label);
    setConfig(node.data.config ?? {});
  }, [node.id, node.data.label, node.data.config]);

  const save = (newConfig: WorkflowNodeConfig, newLabel?: string) => {
    onUpdate(node.id, {
      label: newLabel ?? label,
      config: { ...config, ...newConfig },
    });
  };

  const updateConfig = (patch: WorkflowNodeConfig) => {
    const merged = { ...config, ...patch };
    setConfig(merged);
    save(patch, label);
  };

  const meta = NODE_META[node.data.type] ?? NODE_META['end'];
  const { color, Icon } = meta;
  const type = node.data.type;

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              background: color + '20',
              borderRadius: 6,
              padding: 5,
              display: 'flex',
              alignItems: 'center',
              color,
            }}
          >
            <Icon size={14} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Configure Node
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Label */}
        <div>
          <label style={labelStyle}>Label</label>
          <input
            style={inputStyle}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onUpdate(node.id, { label: e.target.value });
            }}
          />
        </div>

        {/* Type-specific config */}
        {type === 'trigger_cron' && (
          <div>
            <label style={labelStyle}>Cron Expression</label>
            <input
              style={inputStyle}
              value={config.cron ?? ''}
              placeholder="0 9 * * 1"
              onChange={(e) => updateConfig({ cron: e.target.value })}
            />
            <div style={hintStyle}>
              0 9 * * 1 → Every Monday at 9am<br />
              0 */2 * * * → Every 2 hours<br />
              0 8 * * 1-5 → Weekdays at 8am
            </div>
          </div>
        )}

        {type === 'ai_agent' && (
          <div>
            <label style={labelStyle}>Prompt</label>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              value={config.prompt ?? ''}
              placeholder="Analyse the following data: {{input}}"
              onChange={(e) => updateConfig({ prompt: e.target.value })}
            />
            <div style={hintStyle}>
              Use &#123;&#123;varname&#125;&#125; to reference variables from previous nodes.
            </div>
          </div>
        )}

        {type === 'http_request' && (
          <>
            <div>
              <label style={labelStyle}>Method</label>
              <select
                style={{ ...inputStyle }}
                value={config.method ?? 'GET'}
                onChange={(e) => updateConfig({ method: e.target.value as WorkflowNodeConfig['method'] })}
              >
                {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>URL</label>
              <input
                style={inputStyle}
                value={config.url ?? ''}
                placeholder="https://api.example.com/endpoint"
                onChange={(e) => updateConfig({ url: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Body (JSON, optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
                value={config.body ?? ''}
                placeholder='{"key": "{{value}}"}'
                onChange={(e) => updateConfig({ body: e.target.value })}
              />
            </div>
          </>
        )}

        {type === 'condition' && (
          <div>
            <label style={labelStyle}>Condition Expression</label>
            <input
              style={inputStyle}
              value={config.condition ?? ''}
              placeholder="{{score}} > 0.7"
              onChange={(e) => updateConfig({ condition: e.target.value })}
            />
            <div style={hintStyle}>
              Examples:<br />
              &#123;&#123;score&#125;&#125; &gt; 0.7<br />
              &#123;&#123;status&#125;&#125; === &quot;success&quot;<br />
              &#123;&#123;count&#125;&#125; &gt;= 10
            </div>
          </div>
        )}

        {type === 'wait' && (
          <div>
            <label style={labelStyle}>Delay (milliseconds)</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={config.delay ?? 0}
              placeholder="5000"
              onChange={(e) => updateConfig({ delay: Number(e.target.value) })}
            />
            <div style={hintStyle}>
              {msToHuman(config.delay ?? 0)} — 1000ms = 1s, 60000ms = 1min
            </div>
          </div>
        )}

        {type === 'set_variable' && (
          <>
            <div>
              <label style={labelStyle}>Variable Name</label>
              <input
                style={inputStyle}
                value={config.key ?? ''}
                placeholder="myVariable"
                onChange={(e) => updateConfig({ key: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Value</label>
              <input
                style={inputStyle}
                value={config.value ?? ''}
                placeholder="{{previous_output}} or literal"
                onChange={(e) => updateConfig({ value: e.target.value })}
              />
            </div>
          </>
        )}

        {type === 'send_message' && (
          <>
            <div>
              <label style={labelStyle}>Channel</label>
              <input
                style={inputStyle}
                value={config.channel ?? ''}
                placeholder="slack, email, webhook..."
                onChange={(e) => updateConfig({ channel: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Message</label>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                value={config.message ?? ''}
                placeholder="Hello {{name}}, your workflow ran successfully."
                onChange={(e) => updateConfig({ message: e.target.value })}
              />
            </div>
          </>
        )}

        {type === 'end' && (
          <div
            style={{
              padding: '12px 14px',
              background: '#EF444415',
              border: '1px solid #EF444430',
              borderRadius: 8,
              fontSize: 13,
              color: '#EF4444',
              textAlign: 'center',
            }}
          >
            Workflow ends here.<br />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              No further nodes will execute.
            </span>
          </div>
        )}
      </div>

      {/* Node ID footer */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        id: {node.id}
      </div>
    </aside>
  );
}
