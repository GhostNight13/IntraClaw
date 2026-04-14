'use client';

import { NodeType } from '@/lib/workflows-api';
import { NODE_META } from './NodeTypes';

const PALETTE_ITEMS: NodeType[] = [
  'trigger_cron',
  'ai_agent',
  'http_request',
  'condition',
  'wait',
  'set_variable',
  'send_message',
  'end',
];

export function NodePalette() {
  const onDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/workflow-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      style={{
        width: 180,
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 12px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          Nodes
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {PALETTE_ITEMS.map((type) => {
          const { label, color, bg, Icon } = NODE_META[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              title={`Drag to add ${label}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'grab',
                border: `1px solid ${color}30`,
                background: bg,
                userSelect: 'none',
                transition: 'border-color 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${color}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  background: color + '20',
                  borderRadius: 6,
                  padding: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color,
                }}
              >
                <Icon size={13} />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border)',
          fontSize: 10,
          color: 'var(--text-muted)',
          lineHeight: 1.4,
        }}
      >
        Drag nodes onto the canvas to build your workflow.
      </div>
    </aside>
  );
}
