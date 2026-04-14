'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Clock,
  Bot,
  Globe,
  GitBranch,
  Timer,
  Variable,
  MessageSquare,
  Square,
} from 'lucide-react';
import type { NodeType, WorkflowNodeConfig } from '@/lib/workflows-api';

/* ─── Node accent colours ──────────────────────────────────────── */
export const NODE_META: Record<
  NodeType,
  { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  trigger_cron:  { label: 'Cron Trigger',  color: '#3B82F6', bg: '#1E3A5F', Icon: Clock        },
  ai_agent:      { label: 'AI Agent',      color: '#8B5CF6', bg: '#2E1B4F', Icon: Bot          },
  http_request:  { label: 'HTTP Request',  color: '#10B981', bg: '#0D3B2A', Icon: Globe        },
  condition:     { label: 'Condition',     color: '#F59E0B', bg: '#3D2E04', Icon: GitBranch    },
  wait:          { label: 'Wait',          color: '#6B7A8D', bg: '#1E242B', Icon: Timer        },
  set_variable:  { label: 'Set Variable',  color: '#EC4899', bg: '#3D0D2B', Icon: Variable     },
  send_message:  { label: 'Send Message',  color: '#06B6D4', bg: '#0C2D35', Icon: MessageSquare },
  end:           { label: 'End',           color: '#EF4444', bg: '#3D0D0D', Icon: Square       },
};

/* ─── Generic workflow node ────────────────────────────────────── */
interface WorkflowNodeData {
  type: NodeType;
  label: string;
  config: WorkflowNodeConfig;
  selected?: boolean;
}

function WorkflowNodeBase({ data, selected }: NodeProps<WorkflowNodeData>) {
  const meta = NODE_META[data.type] ?? NODE_META['end'];
  const { Icon, color, bg, label: typeLabel } = meta;
  const isEnd       = data.type === 'end';
  const isTrigger   = data.type === 'trigger_cron';
  const isCondition = data.type === 'condition';

  return (
    <div
      style={{
        background: bg,
        border: `2px solid ${selected ? color : color + '60'}`,
        borderRadius: 12,
        minWidth: 160,
        boxShadow: selected ? `0 0 0 2px ${color}40` : '0 2px 8px #00000060',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Input handle — hidden for trigger nodes */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: color, border: 'none', width: 10, height: 10 }}
        />
      )}

      {/* Card body */}
      <div style={{ padding: '10px 14px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              background: color + '20',
              borderRadius: 8,
              padding: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={14} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                lineHeight: 1,
              }}
            >
              {typeLabel}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginTop: 2,
                lineHeight: 1.2,
              }}
            >
              {data.label}
            </div>
          </div>
        </div>

        {/* Config summary */}
        <ConfigSummary type={data.type} config={data.config} color={color} />
      </div>

      {/* Output handle(s) — condition gets two, end gets none */}
      {!isEnd && !isCondition && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: color, border: 'none', width: 10, height: 10 }}
        />
      )}
      {isCondition && (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ background: '#10B981', border: 'none', width: 10, height: 10, left: '30%' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ background: '#EF4444', border: 'none', width: 10, height: 10, left: '70%' }}
          />
        </>
      )}
    </div>
  );
}

function ConfigSummary({
  type,
  config,
  color,
}: {
  type: NodeType;
  config: WorkflowNodeConfig;
  color: string;
}) {
  const style: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono, monospace)',
    background: '#00000030',
    borderRadius: 4,
    padding: '3px 6px',
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 200,
  };

  if (type === 'trigger_cron' && config.cron) {
    return <div style={style}>{config.cron}</div>;
  }
  if (type === 'ai_agent' && config.prompt) {
    return (
      <div style={{ ...style, fontFamily: 'inherit' }}>
        {config.prompt.slice(0, 40)}{config.prompt.length > 40 ? '…' : ''}
      </div>
    );
  }
  if (type === 'http_request' && config.url) {
    return (
      <div style={style}>
        <span style={{ color }}>{config.method ?? 'GET'}</span> {config.url.slice(0, 30)}
        {config.url.length > 30 ? '…' : ''}
      </div>
    );
  }
  if (type === 'condition' && config.condition) {
    return <div style={style}>{config.condition.slice(0, 35)}</div>;
  }
  if (type === 'wait' && config.delay) {
    return <div style={style}>{msToHuman(config.delay)}</div>;
  }
  if (type === 'set_variable' && config.key) {
    return <div style={style}>{config.key} = {config.value}</div>;
  }
  if (type === 'end') {
    return <div style={{ ...style, color: '#EF4444' }}>workflow terminé</div>;
  }
  return null;
}

function msToHuman(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${ms / 1000}s`;
  if (ms < 3_600_000) return `${ms / 60_000}min`;
  return `${ms / 3_600_000}h`;
}

const WorkflowNode = memo(WorkflowNodeBase);
export default WorkflowNode;

/* ─── nodeTypes map consumed by ReactFlow ─────────────────────── */
export const nodeTypes = {
  workflow_node: WorkflowNode,
};
