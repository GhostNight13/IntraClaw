/**
 * INTRACLAW — Google Calendar Provider
 * Utilise googleapis (deja installe dans le projet)
 */
import { google, calendar_v3 } from 'googleapis';
import type { CalendarProvider, UniversalEvent } from './calendar-types';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [GoogleCal] ${msg}`);
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = 'google' as const;
  private calendar: calendar_v3.Calendar | null = null;

  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    );
  }

  private getCalendar(): calendar_v3.Calendar {
    if (this.calendar) return this.calendar;

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    this.calendar = google.calendar({ version: 'v3', auth });
    return this.calendar;
  }

  async listEvents(from: Date, to: Date): Promise<UniversalEvent[]> {
    const cal = this.getCalendar();
    const res = await cal.events.list({
      calendarId:   'primary',
      timeMin:      from.toISOString(),
      timeMax:      to.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   100,
    });

    return (res.data.items ?? []).map(e => this.toUniversalEvent(e));
  }

  async createEvent(event: Omit<UniversalEvent, 'id' | 'source'>): Promise<UniversalEvent> {
    const cal = this.getCalendar();

    const body: calendar_v3.Schema$Event = {
      summary:     event.title,
      description: event.description,
      location:    event.location,
      attendees:   event.attendees?.map(a => ({ email: a.email, displayName: a.name })),
    };

    if (event.isAllDay) {
      body.start = { date: event.startAt.toISOString().split('T')[0] };
      body.end   = { date: event.endAt.toISOString().split('T')[0] };
    } else {
      body.start = { dateTime: event.startAt.toISOString() };
      body.end   = { dateTime: event.endAt.toISOString() };
    }

    const res = await cal.events.insert({ calendarId: 'primary', requestBody: body });
    log('info', `Evenement cree : ${event.title}`);
    return this.toUniversalEvent(res.data);
  }

  async updateEvent(id: string, updates: Partial<Omit<UniversalEvent, 'id' | 'source'>>): Promise<UniversalEvent> {
    const cal = this.getCalendar();

    const body: calendar_v3.Schema$Event = {};
    if (updates.title)       body.summary     = updates.title;
    if (updates.description) body.description = updates.description;
    if (updates.location)    body.location    = updates.location;
    if (updates.startAt)     body.start       = { dateTime: updates.startAt.toISOString() };
    if (updates.endAt)       body.end         = { dateTime: updates.endAt.toISOString() };

    const res = await cal.events.patch({ calendarId: 'primary', eventId: id, requestBody: body });
    log('info', `Evenement modifie : ${id}`);
    return this.toUniversalEvent(res.data);
  }

  async deleteEvent(id: string): Promise<void> {
    const cal = this.getCalendar();
    await cal.events.delete({ calendarId: 'primary', eventId: id });
    log('info', `Evenement supprime : ${id}`);
  }

  async findFreeSlots(durationMinutes: number, from: Date, to: Date): Promise<{ start: Date; end: Date }[]> {
    const events = await this.listEvents(from, to);
    const slots: { start: Date; end: Date }[] = [];
    const durationMs = durationMinutes * 60_000;

    // Itere jour par jour
    const current = new Date(from);
    while (current < to) {
      // Heures de travail : 9h-18h
      const dayStart = new Date(current);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(18, 0, 0, 0);

      // Skip weekends
      const dow = current.getDay();
      if (dow !== 0 && dow !== 6) {
        let cursor = new Date(Math.max(dayStart.getTime(), from.getTime()));

        while (cursor.getTime() + durationMs <= dayEnd.getTime()) {
          const slotEnd = new Date(cursor.getTime() + durationMs);

          const conflict = events.some(e =>
            e.startAt.getTime() < slotEnd.getTime() &&
            e.endAt.getTime() > cursor.getTime()
          );

          if (!conflict) {
            slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
            if (slots.length >= 5) return slots; // Top 5
          }

          // Avance par paliers de 30 minutes
          cursor = new Date(cursor.getTime() + 30 * 60_000);
        }
      }

      // Jour suivant
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return slots;
  }

  private toUniversalEvent(e: calendar_v3.Schema$Event): UniversalEvent {
    const isAllDay = !!(e.start?.date && !e.start?.dateTime);
    return {
      id:          e.id || '',
      title:       e.summary || '(Sans titre)',
      description: e.description ?? undefined,
      startAt:     new Date(e.start?.dateTime ?? e.start?.date ?? ''),
      endAt:       new Date(e.end?.dateTime ?? e.end?.date ?? ''),
      location:    e.location ?? undefined,
      isAllDay,
      attendees:   e.attendees?.map(a => ({
        email:  a.email || '',
        name:   a.displayName ?? undefined,
        status: (a.responseStatus as 'accepted' | 'declined' | 'tentative' | undefined) ?? undefined,
      })),
      source: 'google',
    };
  }
}
