'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { X, Save, Play, Loader2 } from 'lucide-react';
import { nodeTypes } from './NodeTypes';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  runWorkflow,
} from '@/lib/workflows-api';

/* ─── Types ────────────────────────────────────────────────────── */
interface NodeData {
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
}

interface WorkflowBuilderProps {
  workflowId?: string;
  onClose: () => void;
  onSaved?: (wf: WorkflowDefinition) => void;
}

/* ─── Helpers ──────────────────────────────────────────────────── */
function workflowNodesToReactFlow(nodes: WorkflowNode[]): Node<NodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: 'workflow_node',
    position: n.position ?? { x: Math.random() * 400, y: Math.random() * 400 },
    data: { type: n.type, label: n.label, config: n.config ?? {} },
  }));
}

function workflowEdgesToReactFlow(edges: WorkflowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6B7A8D' },
    style: { stroke: '#6B7A8D', strokeWidth: 1.5 },
  }));
}

function reactFlowToWorkflowNodes(nodes: Node<NodeData>[]): WorkflowNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.data.type,
    label: n.data.label,
    config: n.data.config as WorkflowNode['config'],
    position: n.position,
  }));
}

function reactFlowToWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: typeof e.label === 'string' ? e.label : undefined,
  }));
}

let nodeIdCounter = 1;
function newNodeId(type: string) {
  return `${type}_${Date.now()}_${nodeIdCounter++}`;
}

/* ─── Builder ──────────────────────────────────────────────────── */
export function WorkflowBuilder({ workflowId, onClose, onSaved }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* Load existing workflow */
  useEffect(() => {
    if (!workflowId) return;
    getWorkflow(workflowId)
      .then((wf) => {
        setWorkflowName(wf.name);
        setNodes(workflowNodesToReactFlow(wf.nodes ?? []));
        setEdges(workflowEdgesToReactFlow(wf.edges ?? []));
      })
      .catch(() => setLoadError('Failed to load workflow.'));
  }, [workflowId, setNodes, setEdges]);

  /* Connect edges */
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6B7A8D' },
            style: { stroke: '#6B7A8D', strokeWidth: 1.5 },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  /* Drag from palette */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/workflow-node-type') as NodeType;
      if (!type || !rfInstance || !wrapperRef.current) return;

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const id = newNodeId(type);
      const newNode: Node<NodeData> = {
        id,
        type: 'workflow_node',
        position,
        data: {
          type,
          label: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          config: {},
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes],
  );

  /* Select node */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNode(node);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* Update node data from config panel */
  const onNodeDataUpdate = useCallback(
    (nodeId: string, patch: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...patch } } : prev,
      );
    },
    [setNodes],
  );

  /* Save */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload: Partial<WorkflowDefinition> = {
        name: workflowName,
        nodes: reactFlowToWorkflowNodes(nodes),
        edges: reactFlowToWorkflowEdges(edges),
        enabled: true,
      };
      const saved = workflowId
        ? await updateWorkflow(workflowId, payload)
        : await createWorkflow(payload);
      setSaveMsg('Saved!');
      onSaved?.(saved);
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Save failed.');
    } finally {
      setSaving(false);
    }
  }, [workflowName, nodes, edges, workflowId, onSaved]);

  /* Run */
  const handleRun = useCallback(async () => {
    if (!workflowId) {
      setSaveMsg('Save first to run.');
      return;
    }
    setRunning(true);
    try {
      await runWorkflow(workflowId);
      setSaveMsg('Workflow started!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch {
      setSaveMsg('Run failed.');
    } finally {
      setRunning(false);
    }
  }, [workflowId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 56,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}
      >
        {/* Workflow name */}
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 12px',
            color: 'var(--text-primary)',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none',
            minWidth: 200,
          }}
          placeholder="Workflow name…"
        />

        <div style={{ flex: 1 }} />

        {/* Save msg */}
        {saveMsg && (
          <span
            style={{
              fontSize: 12,
              color: saveMsg.includes('fail') ? 'var(--accent-red)' : 'var(--accent-green)',
            }}
          >
            {saveMsg}
          </span>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'var(--accent-blue)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={running || !workflowId}
          title={!workflowId ? 'Save workflow first' : 'Run workflow now'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: workflowId ? 'var(--accent-green)' : 'var(--bg-hover)',
            border: 'none',
            borderRadius: 8,
            color: workflowId ? '#fff' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: workflowId && !running ? 'pointer' : 'not-allowed',
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left palette */}
        <NodePalette />

        {/* Canvas */}
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
          {loadError && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                background: 'var(--accent-red)20',
                border: '1px solid var(--accent-red)',
                borderRadius: 8,
                padding: '8px 16px',
                color: 'var(--accent-red)',
                fontSize: 13,
              }}
            >
              {loadError}
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: 'var(--bg-base)' }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6B7A8D' },
              style: { stroke: '#6B7A8D', strokeWidth: 1.5 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#2A313A"
            />
            <Controls
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
              nodeColor={() => '#2A313A'}
            />
          </ReactFlow>
        </div>

        {/* Right config panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={onNodeDataUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
