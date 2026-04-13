// src/perception/email-watcher.ts
import { getUnreadEmails } from '../tools/gmail';
import { getProspectsByStatus } from '../tools/notion';
import { ProspectStatus } from '../types';
import { logger } from '../utils/logger';

export interface EmailSnapshot {
  unreadCount: number;
  prospectRepliesCount: number;
  checkedAt: string;
}

let _lastSnapshot: EmailSnapshot = {
  unreadCount: 0,
  prospectRepliesCount: 0,
  checkedAt: new Date().toISOString(),
};

export async function getEmailSnapshot(): Promise<EmailSnapshot> {
  try {
    const [unread, contactedProspects] = await Promise.all([
      getUnreadEmails(20),
      getProspectsByStatus(ProspectStatus.CONTACTED),
    ]);

    const prospectEmails = new Set(
      contactedProspects
        .map((p) => p.email?.toLowerCase())
        .filter(Boolean) as string[]
    );

    const prospectReplies = unread.filter((email) => {
      const raw = email.from.toLowerCase();
      const match = raw.match(/<([^>]+)>/);
      const addr = match ? match[1] : raw.trim();
      return prospectEmails.has(addr);
    });

    _lastSnapshot = {
      unreadCount: unread.length,
      prospectRepliesCount: prospectReplies.length,
      checkedAt: new Date().toISOString(),
    };

    logger.info('EmailWatcher', `Unread: ${unread.length}, prospect replies: ${prospectReplies.length}`);
    return _lastSnapshot;
  } catch (err) {
    logger.warn('EmailWatcher', 'Failed to fetch emails', err instanceof Error ? err.message : err);
    return _lastSnapshot;
  }
}

export function getLastEmailSnapshot(): EmailSnapshot {
  return _lastSnapshot;
}
