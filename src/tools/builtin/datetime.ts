// src/tools/builtin/datetime.ts
// Date/time utility tool — current time, timezone conversion, date math
import type { ToolDefinition, ToolResult } from './types';

function getCurrentTime(timezone?: string): ToolResult {
  try {
    const tz = timezone ?? 'Europe/Brussels';
    const now = new Date();
    const formatted = now.toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
    const iso = now.toISOString();
    return {
      success: true,
      data: {
        iso,
        formatted,
        timezone: tz,
        timestamp: now.getTime(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: parseInt(now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10),
        dayOfWeek: now.toLocaleString('en-US', { timeZone: tz, weekday: 'long' }),
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get time: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function convertTimezone(dateStr: string, fromTz: string, toTz: string): ToolResult {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { success: false, error: `Invalid date: ${dateStr}` };
    }
    const fromFormatted = date.toLocaleString('en-GB', { timeZone: fromTz, dateStyle: 'full', timeStyle: 'long' });
    const toFormatted = date.toLocaleString('en-GB', { timeZone: toTz, dateStyle: 'full', timeStyle: 'long' });
    return {
      success: true,
      data: {
        input: dateStr,
        from: { timezone: fromTz, formatted: fromFormatted },
        to: { timezone: toTz, formatted: toFormatted },
        iso: date.toISOString(),
      },
    };
  } catch (err) {
    return { success: false, error: `Conversion failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function dateMath(baseDate: string | undefined, amount: number, unit: string): ToolResult {
  try {
    const date = baseDate ? new Date(baseDate) : new Date();
    if (isNaN(date.getTime())) {
      return { success: false, error: `Invalid date: ${baseDate}` };
    }

    switch (unit) {
      case 'minutes': date.setMinutes(date.getMinutes() + amount); break;
      case 'hours':   date.setHours(date.getHours() + amount); break;
      case 'days':    date.setDate(date.getDate() + amount); break;
      case 'weeks':   date.setDate(date.getDate() + amount * 7); break;
      case 'months':  date.setMonth(date.getMonth() + amount); break;
      case 'years':   date.setFullYear(date.getFullYear() + amount); break;
      default:
        return { success: false, error: `Unknown unit: ${unit}. Use minutes, hours, days, weeks, months, or years.` };
    }

    return {
      success: true,
      data: {
        original: baseDate ?? 'now',
        operation: `${amount >= 0 ? '+' : ''}${amount} ${unit}`,
        result: date.toISOString(),
        formatted: date.toLocaleString('en-GB', { timeZone: 'Europe/Brussels', dateStyle: 'full', timeStyle: 'long' }),
      },
    };
  } catch (err) {
    return { success: false, error: `Date math failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function diffDates(date1Str: string, date2Str: string): ToolResult {
  try {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return { success: false, error: 'Invalid date(s) provided' };
    }
    const diffMs = d2.getTime() - d1.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return {
      success: true,
      data: {
        date1: d1.toISOString(),
        date2: d2.toISOString(),
        diffMs,
        diffMinutes: Math.round(diffMs / 60_000),
        diffHours: Math.round(diffMs / 3_600_000),
        diffDays: Math.round(diffDays),
        diffWeeks: Math.round(diffDays / 7),
      },
    };
  } catch (err) {
    return { success: false, error: `Diff failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

export const toolDefinition: ToolDefinition = {
  name: 'datetime',
  description: 'Get current date/time, convert timezones, perform date arithmetic, or calculate date differences.',
  parameters: {
    action: { type: 'string', description: 'One of: now, convert, add, diff', required: true },
    timezone: { type: 'string', description: 'Timezone (IANA format, e.g. "Europe/Brussels"). Default: Europe/Brussels' },
    date: { type: 'string', description: 'ISO 8601 date string (for convert/add/diff)' },
    date2: { type: 'string', description: 'Second date (for diff action)' },
    fromTimezone: { type: 'string', description: 'Source timezone (for convert)' },
    toTimezone: { type: 'string', description: 'Target timezone (for convert)' },
    amount: { type: 'number', description: 'Amount to add/subtract (for add action)' },
    unit: { type: 'string', description: 'Unit: minutes, hours, days, weeks, months, years (for add action)' },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = params.action as string | undefined;
    if (!action) {
      return { success: false, error: 'Missing required parameter: action' };
    }

    switch (action) {
      case 'now':
        return getCurrentTime(params.timezone as string | undefined);

      case 'convert': {
        const date = params.date as string | undefined;
        const from = params.fromTimezone as string | undefined;
        const to = params.toTimezone as string | undefined;
        if (!date || !from || !to) {
          return { success: false, error: 'convert requires: date, fromTimezone, toTimezone' };
        }
        return convertTimezone(date, from, to);
      }

      case 'add': {
        const amount = params.amount as number | undefined;
        const unit = params.unit as string | undefined;
        if (amount === undefined || !unit) {
          return { success: false, error: 'add requires: amount, unit' };
        }
        return dateMath(params.date as string | undefined, amount, unit);
      }

      case 'diff': {
        const date1 = params.date as string | undefined;
        const date2 = params.date2 as string | undefined;
        if (!date1 || !date2) {
          return { success: false, error: 'diff requires: date, date2' };
        }
        return diffDates(date1, date2);
      }

      default:
        return { success: false, error: `Unknown action: ${action}. Use now, convert, add, or diff.` };
    }
  },
};
