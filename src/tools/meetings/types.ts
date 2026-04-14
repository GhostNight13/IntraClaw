export type MeetingPlatform = 'zoom' | 'google_meet' | 'teams' | 'other';
export type MeetingStatus = 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed';

export interface Meeting {
  id: string;
  url: string;
  platform: MeetingPlatform;
  title: string;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  transcript: string | null;
  summary: string | null;
  actionItems: string[]; // stored as JSON TEXT in DB
  createdAt: string;
}
