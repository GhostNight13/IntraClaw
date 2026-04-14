/**
 * INTRACLAW — OAuth Social Login
 * Supports Google, GitHub, Microsoft
 */
import { getDb } from '../db';
import { logger } from '../utils/logger';
import { signToken } from './jwt';
import { findUserByEmail, createOAuthUser } from '../users/user-store';

export type OAuthProvider = 'google' | 'github' | 'microsoft';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
  provider: OAuthProvider;
}

function generateId(): string {
  return `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function handleOAuthCallback(
  profile: OAuthProfile,
): Promise<{ token: string; userId: string; isNew: boolean }> {
  const db = getDb();

  // Check if this OAuth account is already linked
  const existing = db
    .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_id = ?')
    .get(profile.provider, profile.providerId) as { user_id: string } | undefined;

  if (existing) {
    // Load full user to build proper token payload
    const { findUserById } = await import('../users/user-store');
    const user = findUserById(existing.user_id);
    if (!user) throw new Error(`OAuth user ${existing.user_id} not found in store`);
    const token = signToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan });
    logger.info('OAuth', `Login via ${profile.provider}: user ${existing.user_id}`);
    return { token, userId: existing.user_id, isNew: false };
  }

  // Check if a user with the same email already exists
  let user = findUserByEmail(profile.email);
  let isNew = false;

  if (!user) {
    user = await createOAuthUser({ name: profile.name, email: profile.email });
    isNew = true;
    logger.info('OAuth', `New user created via ${profile.provider}: ${profile.email}`);
  }

  // Link OAuth account to user
  db.prepare(`
    INSERT INTO oauth_accounts (id, user_id, provider, provider_id, email)
    VALUES (?, ?, ?, ?, ?)
  `).run(generateId(), user.id, profile.provider, profile.providerId, profile.email);

  const token = signToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan });
  return { token, userId: user.id, isNew };
}

export function getLinkedAccounts(
  userId: string,
): { provider: string; email: string; created_at: string }[] {
  const db = getDb();
  return db
    .prepare('SELECT provider, email, created_at FROM oauth_accounts WHERE user_id = ?')
    .all(userId) as { provider: string; email: string; created_at: string }[];
}

export function unlinkOAuthAccount(userId: string, provider: OAuthProvider): void {
  const db = getDb();
  db.prepare('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?').run(userId, provider);
  logger.info('OAuth', `Unlinked ${provider} from user ${userId}`);
}
