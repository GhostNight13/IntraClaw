/**
 * INTRACLAW — Unified Calendar Types
 */
export interface UniversalEvent {
  id:          string;
  title:       string;
  description?: string;
  startAt:     Date;
  endAt:       Date;
  location?:   string;
  attendees?:  { email: string; name?: string; status?: 'accepted' | 'declined' | 'tentative' }[];
  isAllDay?:   boolean;
  recurrence?: string;
  source:      'google' | 'outlook';
  rawData?:    unknown;
}

export interface CalendarProvider {
  readonly providerName: 'google' | 'outlook';
  isConfigured(): boolean;
  listEvents(from: Date, to: Date): Promise<UniversalEvent[]>;
  createEvent(event: Omit<UniversalEvent, 'id' | 'source'>): Promise<UniversalEvent>;
  updateEvent(id: string, updates: Partial<Omit<UniversalEvent, 'id' | 'source'>>): Promise<UniversalEvent>;
  deleteEvent(id: string): Promise<void>;
  findFreeSlots(durationMinutes: number, from: Date, to: Date): Promise<{ start: Date; end: Date }[]>;
}
