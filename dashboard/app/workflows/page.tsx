'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  RefreshCw,
  GitBranch,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from 'lucide-react';
import {
  WorkflowDefinition,
  listWorkflows,
  deleteWorkflow,
  runWorkflow,
  updateWorkflow,
} from '@/lib/workflows-api';
import { WorkflowBuilder } from '@/components/workflow-builder';

/* ─── Status badge ─────────────────────────────────────────────── */
function RunStatusBadge({ status }: { status: WorkflowDefinition['lastRunStatus'] }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;

  const map: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    success: { icon: <CheckCircle2 size={12} />, color: 'var(--accent-green)', label: 'Success' },
    error:   { icon: <XCircle size={12} />,      color: 'var(--accent-red)',   label: 'Error'   },
    running: { icon: <Loader2 size={12} className="animate-spin" />, color: 'var(--accent-blue)', label: 'Running' },
  };

  const { icon, color, label } = map[status] ?? { icon: <Circle size={12} />, color: 'var(--text-muted)', label: status };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color,
        background: color + '18',
        borderRadius: 6,
        padding: '2px 8px',
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

/* ─── Toggle switch ────────────────────────────────────────────── */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--accent-green)' : 'var(--bg-hover)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 17 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          display: 'block',
        }}
      />
    </button>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listWorkflows();
      setWorkflows(data);
    } catch {
      setError('Could not load workflows. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleNewWorkflow = () => {
    setEditId(undefined);
    setBuilderOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setBuilderOpen(true);
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await runWorkflow(id);
      await load();
    } catch {
      // silent — user sees last run status refresh
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    setDeletingId(id);
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleEnabled = async (wf: WorkflowDefinition) => {
    try {
      const updated = await updateWorkflow(wf.id, { enabled: !wf.enabled });
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch {
      // silent
    }
  };

  const handleBuilderClose = () => {
    setBuilderOpen(false);
    setEditId(undefined);
  };

  const handleBuilderSaved = (wf: WorkflowDefinition) => {
    setWorkflows((prev) => {
      const idx = prev.findIndex((w) => w.id === wf.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = wf;
        return next;
      }
      return [wf, ...prev];
    });
    setBuilderOpen(false);
    setEditId(undefined);
  };

  return (
    <>
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch size={22} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Workflows
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Visual automation workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleNewWorkflow}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                background: 'var(--accent-blue)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              New Workflow
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--accent-red)15',
              border: '1px solid var(--accent-red)40',
              borderRadius: 10,
              color: 'var(--accent-red)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && workflows.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 gap-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          >
            <GitBranch size={40} style={{ color: 'var(--text-muted)' }} />
            <div className="text-center">
              <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                No workflows yet
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Create your first workflow to automate tasks.
              </p>
            </div>
            <button
              onClick={handleNewWorkflow}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                background: 'var(--accent-blue)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              <Plus size={14} />
              Create Workflow
            </button>
          </div>
        )}

        {/* Workflow list */}
        {!loading && workflows.length > 0 && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 140px 80px 90px 130px',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <span>Name</span>
              <span>Status</span>
              <span>Last Run</span>
              <span style={{ textAlign: 'right' }}>Runs</span>
              <span style={{ textAlign: 'center' }}>Enabled</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {/* Rows */}
            {workflows.map((wf, i) => (
              <div
                key={wf.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 140px 80px 90px 130px',
                  padding: '14px 20px',
                  borderBottom:
                    i < workflows.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                }}
              >
                {/* Name + description */}
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {wf.name}
                  </div>
                  {wf.description && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {wf.description}
                    </div>
                  )}
                  <div className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                    {wf.nodes?.length ?? 0} node{wf.nodes?.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Last run status */}
                <div>
                  <RunStatusBadge status={wf.lastRunStatus} />
                </div>

                {/* Last run at */}
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {wf.lastRunAt
                    ? new Date(wf.lastRunAt).toLocaleString('fr-BE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </div>

                {/* Run count */}
                <div
                  className="text-sm font-mono"
                  style={{ color: 'var(--text-primary)', textAlign: 'right' }}
                >
                  {wf.runCount ?? 0}
                </div>

                {/* Toggle */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ToggleSwitch
                    checked={wf.enabled}
                    onChange={() => handleToggleEnabled(wf)}
                  />
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    justifyContent: 'flex-end',
                  }}
                >
                  {/* Run */}
                  <button
                    onClick={() => handleRun(wf.id)}
                    disabled={runningId === wf.id}
                    title="Run now"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      background: 'var(--accent-green)18',
                      border: '1px solid var(--accent-green)30',
                      borderRadius: 7,
                      color: 'var(--accent-green)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: runningId === wf.id ? 'not-allowed' : 'pointer',
                      opacity: runningId === wf.id ? 0.7 : 1,
                    }}
                  >
                    {runningId === wf.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    Run
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(wf.id)}
                    title="Edit workflow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      background: 'var(--accent-blue)18',
                      border: '1px solid var(--accent-blue)30',
                      borderRadius: 7,
                      color: 'var(--accent-blue)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(wf.id)}
                    disabled={deletingId === wf.id}
                    title="Delete workflow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '5px 8px',
                      background: 'var(--accent-red)15',
                      border: '1px solid var(--accent-red)30',
                      borderRadius: 7,
                      color: 'var(--accent-red)',
                      cursor: deletingId === wf.id ? 'not-allowed' : 'pointer',
                      opacity: deletingId === wf.id ? 0.7 : 1,
                    }}
                  >
                    {deletingId === wf.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Builder overlay */}
      {builderOpen && (
        <WorkflowBuilder
          workflowId={editId}
          onClose={handleBuilderClose}
          onSaved={handleBuilderSaved}
        />
      )}
    </>
  );
}
