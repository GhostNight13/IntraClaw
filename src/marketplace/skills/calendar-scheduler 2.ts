/**
 * Generic Skill: Calendar Scheduler
 * Suggests meeting slots from Google Calendar free/busy.
 * Falls back to a deterministic placeholder when no Calendar provider is configured.
 */
import { GenericSkill, SkillContext, SkillResult } from '../types';
import { findFreeSlots, isCalendarAvailable, initCalendar } from '../../tools/calendar';
import { logger } from '../../utils/logger';

interface CalendarSchedulerConfig {
  workdayStart?:    number;   // hour 0-23, default 9
  workdayEnd?:      number;   // hour 0-23, default 18
  timezone?:        string;
  excludeWeekends?: boolean;
}

interface CalendarSchedulerInput {
  durationMinutes?: number;   // default 30
  fromIso?:         string;   // default now
  toIso?:           string;   // default now + 7 days
  maxSuggestions?:  number;   // default 5
}

interface SlotDto { startIso: string; endIso: string; humanLabel: string; }

function placeholderSlots(opts: {
  cfg: CalendarSchedulerConfig;
  duration: number;
  from: Date;
  to: Date;
  max: number;
}): SlotDto[] {
  const { cfg, duration, from, to, max } = opts;
  const start = cfg.workdayStart ?? 9;
  const end   = cfg.workdayEnd   ?? 18;
  const skipWeekend = cfg.excludeWeekends ?? true;

  const slots: SlotDto[] = [];
  const cur = new Date(from);
  cur.setMinutes(0, 0, 0);

  while (cur < to && slots.length < max) {
    const day = cur.getDay();
    const hour = cur.getHours();
    const isWeekend = day === 0 || day === 6;
    const inHours = hour >= start && hour + duration / 60 <= end;

    if ((!skipWeekend || !isWeekend) && inHours) {
      const slotEnd = new Date(cur.getTime() + duration * 60_000);
      slots.push({
        startIso: cur.toISOString(),
        endIso:   slotEnd.toISOString(),
        humanLabel: `${cur.toDateString()} ${cur.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
    }
    cur.setHours(cur.getHours() + 1);
  }
  return slots;
}

export const calendarScheduler: GenericSkill = {
  id:          'calendar-scheduler',
  name:        'Calendar Scheduler',
  description: 'Suggests open meeting slots from your Google Calendar (placeholder slots if no calendar connected).',
  icon:        'Calendar',
  tier:        'free',
  requires:    [],   // optional: 'calendar' for live data

  async execute(ctx: SkillContext, input: Record<string, unknown>): Promise<SkillResult> {
    const cfg = ctx.config as CalendarSchedulerConfig;
    const data = input as unknown as CalendarSchedulerInput;

    const duration = Math.max(15, data.durationMinutes ?? 30);
    const from = data.fromIso ? new Date(data.fromIso) : new Date();
    const to   = data.toIso   ? new Date(data.toIso)   : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const max  = data.maxSuggestions ?? 5;

    try {
      // Lazy init — safe to call multiple times
      try { initCalendar(); } catch { /* noop */ }

      if (!isCalendarAvailable()) {
        const slots = placeholderSlots({ cfg, duration, from, to, max });
        return {
          ok: true,
          message: `No calendar connected — returning ${slots.length} placeholder slots based on workday config.`,
          data: { slots, source: 'placeholder' as const },
        };
      }

      const free = await findFreeSlots(duration, from, to);
      const slots: SlotDto[] = free.slice(0, max).map((s) => ({
        startIso: s.start.toISOString(),
        endIso:   s.end.toISOString(),
        humanLabel: `${s.start.toDateString()} ${s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      }));

      return {
        ok: true,
        message: `Found ${slots.length} open slot(s).`,
        data: { slots, source: 'calendar' as const },
      };
    } catch (err) {
      logger.error('Skill:calendar-scheduler', err instanceof Error ? err.message : String(err));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
