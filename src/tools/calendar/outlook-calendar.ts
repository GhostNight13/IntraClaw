/**
 * INTRACLAW — Outlook Calendar Provider (Microsoft Graph API)
 * Optionnel : ne s'active que si OUTLOOK_* vars sont definies
 */
import type { CalendarProvider, UniversalEvent } from './calendar-types';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [OutlookCal] ${msg}`);
}

interface GraphClient {
  api(path: string): {
    query(params: Record<string, string>): GraphClient['api'] extends (p: string) => infer R ? R : never;
    select(fields: string): GraphClient['api'] extends (p: string) => infer R ? R : never;
    orderby(field: string): GraphClient['api'] extends (p: string) => infer R ? R : never;
    top(n: number): GraphClient['api'] extends (p: string) => infer R ? R : never;
    get(): Promise<{ value: unknown[] }>;
    post(body: unknown): Promise<unknown>;
    patch(body: unknown): Promise<unknown>;
    delete(): Promise<void>;
  };
}

export class OutlookCalendarProvider implements CalendarProvider {
  readonly providerName = 'outlook' as const;
  private client: GraphClient | null = null;

  isConfigured(): boolean {
    return !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_ACCESS_TOKEN);
  }

  private async getClient(): Promise<GraphClient> {
    if (this.client) return this.client;

    try {
      const { Client } = await import('@microsoft/microsoft-graph-client');
      await import('isomorphic-fetch');

      this.client = Client.init({
        authProvider: (done: (err: Error | null, token: string | null) => void) => {
          done(null, process.env.OUTLOOK_ACCESS_TOKEN ?? null);
        },
      }) as unknown as GraphClient;
      return this.client;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log('warn', `Microsoft Graph SDK non disponible: ${message}`);
      throw new Error('Outlook non configure');
    }
  }

  async listEvents(from: Date, to: Date): Promise<UniversalEvent[]> {
    const client = await this.getClient();

    const res = await client
      .api('/me/calendarView')
      .query({
        startDateTime: from.toISOString(),
        endDateTime:   to.toISOString(),
      })
      .select('id,subject,bodyPreview,start,end,location,attendees,isAllDay')
      .orderby('start/dateTime')
      .top(100)
      .get();

    return (res.value || []).map((e: unknown) => this.toUniversalEvent(e as Record<string, unknown>));
  }

  async createEvent(event: Omit<UniversalEvent, 'id' | 'source'>): Promise<UniversalEvent> {
    const client = await this.getClient();

    const body: Record<string, unknown> = {
      subject: event.title,
      body:    { contentType: 'text', content: event.description || '' },
      start:   { dateTime: event.startAt.toISOString(), timeZone: 'UTC' },
      end:     { dateTime: event.endAt.toISOString(), timeZone: 'UTC' },
      isAllDay: event.isAllDay || false,
    };
    if (event.location) body.location = { displayName: event.location };
    if (event.attendees) {
      body.attendees = event.attendees.map(a => ({
        emailAddress: { address: a.email, name: a.name },
        type: 'required',
      }));
    }

    const res = await client.api('/me/events').post(body);
    log('info', `Evenement Outlook cree : ${event.title}`);
    return this.toUniversalEvent(res as Record<string, unknown>);
  }

  async updateEvent(id: string, updates: Partial<Omit<UniversalEvent, 'id' | 'source'>>): Promise<UniversalEvent> {
    const client = await this.getClient();
    const body: Record<string, unknown> = {};
    if (updates.title)       body.subject = updates.title;
    if (updates.description) body.body    = { contentType: 'text', content: updates.description };
    if (updates.startAt)     body.start   = { dateTime: updates.startAt.toISOString(), timeZone: 'UTC' };
    if (updates.endAt)       body.end     = { dateTime: updates.endAt.toISOString(), timeZone: 'UTC' };
    if (updates.location)    body.location = { displayName: updates.location };

    const res = await client.api(`/me/events/${id}`).patch(body);
    log('info', `Evenement Outlook modifie : ${id}`);
    return this.toUniversalEvent(res as Record<string, unknown>);
  }

  async deleteEvent(id: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/events/${id}`).delete();
    log('info', `Evenement Outlook supprime : ${id}`);
  }

  async findFreeSlots(durationMinutes: number, from: Date, to: Date): Promise<{ start: Date; end: Date }[]> {
    const events = await this.listEvents(from, to);
    const slots: { start: Date; end: Date }[] = [];
    const durationMs = durationMinutes * 60_000;

    const current = new Date(from);
    while (current < to && slots.length < 5) {
      const dayStart = new Date(current); dayStart.setHours(9, 0, 0, 0);
      const dayEnd   = new Date(current); dayEnd.setHours(18, 0, 0, 0);
      const dow = current.getDay();

      if (dow !== 0 && dow !== 6) {
        let cursor = new Date(Math.max(dayStart.getTime(), from.getTime()));
        while (cursor.getTime() + durationMs <= dayEnd.getTime() && slots.length < 5) {
          const slotEnd = new Date(cursor.getTime() + durationMs);
          const conflict = events.some(e => e.startAt < slotEnd && e.endAt > cursor);
          if (!conflict) slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
          cursor = new Date(cursor.getTime() + 30 * 60_000);
        }
      }
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
    return slots;
  }

  private toUniversalEvent(e: Record<string, unknown>): UniversalEvent {
    const start = e.start as Record<string, string> | undefined;
    const end = e.end as Record<string, string> | undefined;
    const location = e.location as Record<string, string> | undefined;
    const attendees = e.attendees as Array<Record<string, unknown>> | undefined;

    return {
      id:          e.id as string,
      title:       (e.subject as string) || '(Sans titre)',
      description: (e.bodyPreview as string) ?? undefined,
      startAt:     new Date(start?.dateTime || ''),
      endAt:       new Date(end?.dateTime || ''),
      location:    location?.displayName ?? undefined,
      isAllDay:    (e.isAllDay as boolean) || false,
      attendees:   attendees?.map((a: Record<string, unknown>) => {
        const emailAddr = a.emailAddress as Record<string, string> | undefined;
        const status = a.status as Record<string, string> | undefined;
        return {
          email:  emailAddr?.address || '',
          name:   emailAddr?.name,
          status: status?.response as 'accepted' | 'declined' | 'tentative' | undefined,
        };
      }),
      source: 'outlook',
    };
  }
}
