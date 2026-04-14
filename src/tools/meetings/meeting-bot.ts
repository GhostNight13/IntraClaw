import { getMeeting, updateMeeting, listMeetings } from './meeting-store';
import { summarizeMeeting } from './summarizer';
import type { Meeting } from './types';

/**
 * Ingests a transcript for a meeting, runs AI summarisation, and persists results.
 */
export async function processTranscript(meetingId: string, transcript: string): Promise<Meeting> {
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);

  // Mark as processing and store transcript
  updateMeeting(meetingId, {
    status: 'processing',
    transcript,
    startedAt: meeting.startedAt ?? new Date().toISOString(),
  });

  try {
    const { summary, actionItems } = await summarizeMeeting(transcript, meeting.title);

    return updateMeeting(meetingId, {
      status: 'completed',
      summary,
      actionItems,
      endedAt: new Date().toISOString(),
    });
  } catch (err) {
    updateMeeting(meetingId, { status: 'failed' });
    throw err;
  }
}

/**
 * Returns aggregate stats across all meetings.
 */
export function getMeetingStats(): { total: number; completed: number; totalActionItems: number } {
  const meetings = listMeetings(1000);
  const completed = meetings.filter(m => m.status === 'completed');
  const totalActionItems = completed.reduce((sum, m) => sum + m.actionItems.length, 0);

  return {
    total: meetings.length,
    completed: completed.length,
    totalActionItems,
  };
}
