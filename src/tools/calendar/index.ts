/**
 * INTRACLAW — Unified Calendar Manager
 * Expose une API unique qui agrege Google + Outlook
 */
import { GoogleCalendarProvider } from './google-calendar';
import { OutlookCalendarProvider } from './outlook-calendar';
import type { CalendarProvider, UniversalEvent } from './calendar-types';

export type { UniversalEvent, CalendarProvider } from './calendar-types';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [Calendar] ${msg}`);
}

const providers: CalendarProvider[] = [];

export function initCalendar(): void {
  const googleProvider = new GoogleCalendarProvider();
  if (googleProvider.isConfigured()) {
    providers.push(googleProvider);
    log('info', 'Google Calendar active');
  }

  const outlookProvider = new OutlookCalendarProvider();
  if (outlookProvider.isConfigured()) {
    providers.push(outlookProvider);
    log('info', 'Outlook Calendar active');
  }

  if (providers.length === 0) {
    log('warn', 'Aucun calendrier configure');
  }
}

export function isCalendarAvailable(): boolean {
  return providers.length > 0;
}

export async function listAllEvents(from: Date, to: Date): Promise<UniversalEvent[]> {
  const allEvents: UniversalEvent[] = [];
  for (const p of providers) {
    try {
      const events = await p.listEvents(from, to);
      allEvents.push(...events);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log('warn', `Erreur listEvents ${p.providerName}: ${message}`);
    }
  }
  return allEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export async function createCalendarEvent(
  event: Omit<UniversalEvent, 'id' | 'source'>,
  preferredProvider?: 'google' | 'outlook'
): Promise<UniversalEvent> {
  const provider = preferredProvider
    ? providers.find(p => p.providerName === preferredProvider)
    : providers[0];

  if (!provider) throw new Error('Aucun calendrier disponible');
  return provider.createEvent(event);
}

export async function updateCalendarEvent(
  id: string,
  updates: Partial<Omit<UniversalEvent, 'id' | 'source'>>,
  source: 'google' | 'outlook' = 'google'
): Promise<UniversalEvent> {
  const provider = providers.find(p => p.providerName === source);
  if (!provider) throw new Error(`Provider ${source} non disponible`);
  return provider.updateEvent(id, updates);
}

export async function deleteCalendarEvent(id: string, source: 'google' | 'outlook' = 'google'): Promise<void> {
  const provider = providers.find(p => p.providerName === source);
  if (!provider) throw new Error(`Provider ${source} non disponible`);
  await provider.deleteEvent(id);
}

export async function findFreeSlots(
  durationMinutes: number,
  from: Date,
  to: Date
): Promise<{ start: Date; end: Date }[]> {
  const provider = providers[0];
  if (!provider) throw new Error('Aucun calendrier configure');
  return provider.findFreeSlots(durationMinutes, from, to);
}

export async function getTodaysAgenda(): Promise<string> {
  const now   = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);

  const events = await listAllEvents(start, end);
  if (events.length === 0) return 'Aucun evenement aujourd\'hui.';

  const lines = events.map(e => {
    const startTime = e.isAllDay ? 'Toute la journee' : e.startAt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
    const endTime   = e.isAllDay ? '' : ` - ${e.endAt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`;
    const loc       = e.location ? ` | ${e.location}` : '';
    return `  ${startTime}${endTime} | ${e.title}${loc}`;
  });

  return `Agenda du ${now.toLocaleDateString('fr-BE')} (${events.length} evenements)\n\n${lines.join('\n')}`;
}
