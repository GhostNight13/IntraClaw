'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RefreshCw, GripVertical, Globe, Mail, MapPin, Calendar } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────── */
type ColumnId = 'new' | 'contacted' | 'replied' | 'demo_booked' | 'converted' | 'rejected';

interface Prospect {
  id: string;
  company: string;
  city?: string;
  email?: string;
  pagespeed?: number;
  contactedAt?: string;
  status: ColumnId;
}

/* ─── Config ─────────────────────────────────────────────────── */
const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'new',         label: 'Nouveau',   color: 'var(--accent-blue)'   },
  { id: 'contacted',   label: 'Contacté',  color: 'var(--accent-yellow)' },
  { id: 'replied',     label: 'Intéressé', color: '#8B5CF6'              },
  { id: 'demo_booked', label: 'Devis',     color: '#F97316'              },
  { id: 'converted',   label: 'Signé',     color: 'var(--accent-green)'  },
  { id: 'rejected',    label: 'Livré',     color: 'var(--text-muted)'    },
];

/* ─── API fetch ───────────────────────────────────────────────── */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProspect(p: any, status: ColumnId): Prospect {
  return {
    id:          p.id ?? String(Math.random()),
    company:     p.businessName ?? p.company ?? 'Inconnu',
    city:        p.location ?? p.city,
    email:       p.email,
    pagespeed:   p.pageSpeedScore ?? p.pagespeed,
    contactedAt: p.lastContactedAt ?? p.contactedAt,
    status,
  };
}

async function fetchProspects(): Promise<Prospect[]> {
  const res = await fetch(`${BASE}/api/prospects`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as { prospects?: Record<string, any[]> };
  const pMap = data.prospects ?? {};
  return [
    ...(pMap['new']       ?? []).map((p: any) => mapProspect(p, 'new')),
    ...(pMap['contacted'] ?? []).map((p: any) => mapProspect(p, 'contacted')),
    ...(pMap['replied']   ?? []).map((p: any) => mapProspect(p, 'replied')),
    ...(pMap['converted'] ?? []).map((p: any) => mapProspect(p, 'converted')),
  ];
}

/* ─── Sortable Card ──────────────────────────────────────────── */
function ProspectCard({ prospect, isDragging = false }: { prospect: Prospect; isDragging?: boolean }) {
  const speedColor = prospect.pagespeed == null ? 'var(--text-muted)'
    : prospect.pagespeed >= 70 ? 'var(--accent-green)'
    : prospect.pagespeed >= 50 ? 'var(--accent-yellow)'
    : 'var(--accent-red)';

  return (
    <div className="rounded-lg p-3 border flex flex-col gap-2 cursor-grab active:cursor-grabbing"
      style={{
        background: isDragging ? 'var(--bg-hover)' : 'var(--bg-base)',
        borderColor: 'var(--border)',
        opacity: isDragging ? 0.9 : 1,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : undefined,
      }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
          {prospect.company}
        </span>
        {prospect.pagespeed != null && (
          <span className="text-xs font-mono shrink-0 px-1.5 py-0.5 rounded"
            style={{ background: speedColor + '20', color: speedColor }}>
            {prospect.pagespeed}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {prospect.city && (
          <div className="flex items-center gap-1.5">
            <MapPin size={10} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{prospect.city}</span>
          </div>
        )}
        {prospect.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={10} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{prospect.email}</span>
          </div>
        )}
        {prospect.contactedAt && (
          <div className="flex items-center gap-1.5">
            <Calendar size={10} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(prospect.contactedAt).toLocaleDateString('fr-BE')}
            </span>
          </div>
        )}
        {prospect.pagespeed != null && (
          <div className="flex items-center gap-1.5">
            <Globe size={10} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PageSpeed: </span>
            <span className="text-xs font-mono" style={{ color: speedColor }}>{prospect.pagespeed}/100</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCard({ prospect }: { prospect: Prospect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prospect.id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }}
      {...attributes} {...listeners}>
      <ProspectCard prospect={prospect} isDragging={isDragging} />
    </div>
  );
}

/* ─── Column ─────────────────────────────────────────────────── */
function KanbanColumn({
  colId, label, color, prospects,
}: { colId: ColumnId; label: string; color: string; prospects: Prospect[] }) {
  return (
    <div className="flex flex-col rounded-xl border min-h-[400px]"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 200, flex: '1 1 0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl"
        style={{ borderColor: 'var(--border)', background: color + '12' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
            {label}
          </span>
        </div>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: color + '20', color }}>
          {prospects.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={prospects.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1">
          {prospects.map(p => <SortableCard key={p.id} prospect={p} />)}
          {prospects.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Vide
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProspects();
      setProspects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const byColumn = useCallback((colId: ColumnId) =>
    prospects.filter(p => p.status === colId), [prospects]);

  const activeProspect = activeId ? prospects.find(p => p.id === activeId) : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const overId = String(over.id);
    const colMatch = COLUMNS.find(c => c.id === overId);

    if (colMatch) {
      // Dropped on column header/empty area
      setProspects(prev => prev.map(p =>
        p.id === String(active.id) ? { ...p, status: colMatch.id } : p
      ));
      return;
    }

    // Dropped on another card — move to same column
    const target = prospects.find(p => p.id === overId);
    if (target && target.status !== prospects.find(p => p.id === String(active.id))?.status) {
      setProspects(prev => prev.map(p =>
        p.id === String(active.id) ? { ...p, status: target.status } : p
      ));
    }
  }

  const total = prospects.length;
  const converted = prospects.filter(p => p.status === 'converted').length;

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Pipeline</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} prospects · {converted} convertis
            {total > 0 && ` · ${((converted / total) * 100).toFixed(0)}% taux conversion`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</span>}
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ alignItems: 'flex-start' }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              colId={col.id}
              label={col.label}
              color={col.color}
              prospects={byColumn(col.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeProspect && <ProspectCard prospect={activeProspect} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
