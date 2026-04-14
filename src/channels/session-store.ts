/**
 * INTRACLAW — Session Store
 * Stocke l'historique de conversation et les utilisateurs autorisés par canal
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorizedUser, ConversationMessage, ChannelId } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');
const AUTH_FILE = path.join(DATA_DIR, 'authorized-users.json');

interface SessionData {
  history:      ConversationMessage[];
  lastActivity: string;
}

// S'assure que le dossier existe
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── Authorized Users ────────────────────────────────────────────

let authorizedUsers: AuthorizedUser[] = [];

export function loadAuthorizedUsers(): void {
  ensureDataDir();
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      authorizedUsers = (JSON.parse(raw) as Array<Record<string, unknown>>).map(u => ({
        ...(u as Omit<AuthorizedUser, 'addedAt'>),
        addedAt: new Date(u['addedAt'] as string),
      }));
    } catch {
      authorizedUsers = [];
    }
  }
}

function saveAuthorizedUsers(): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authorizedUsers, null, 2));
}

export function isAuthorized(channelId: ChannelId, senderId: string): boolean {
  // Si aucun user n'est configuré, on autorise tout (mode personnel)
  if (authorizedUsers.length === 0) return true;
  return authorizedUsers.some(u => u.channelId === channelId && u.senderId === senderId);
}

export function addAuthorizedUser(user: Omit<AuthorizedUser, 'addedAt'>): void {
  const existing = authorizedUsers.find(
    u => u.channelId === user.channelId && u.senderId === user.senderId,
  );
  if (!existing) {
    authorizedUsers.push({ ...user, addedAt: new Date() });
    saveAuthorizedUsers();
  }
}

export function removeAuthorizedUser(channelId: ChannelId, senderId: string): void {
  authorizedUsers = authorizedUsers.filter(
    u => !(u.channelId === channelId && u.senderId === senderId),
  );
  saveAuthorizedUsers();
}

// ── Conversation History ─────────────────────────────────────────

function getSessionPath(channelId: ChannelId, senderId: string): string {
  // Sanitize senderId pour le nom de fichier
  const safeId = senderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  return path.join(DATA_DIR, `${channelId}-${safeId}.json`);
}

export function getConversationHistory(
  channelId: ChannelId,
  senderId: string,
  limit = 10,
): ConversationMessage[] {
  ensureDataDir();
  const sessionPath = getSessionPath(channelId, senderId);

  if (!fs.existsSync(sessionPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as SessionData;
    return data.history.slice(-limit).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

export function appendToHistory(
  channelId: ChannelId,
  senderId: string,
  message: Omit<ConversationMessage, 'timestamp'>,
): void {
  ensureDataDir();
  const sessionPath = getSessionPath(channelId, senderId);

  let data: SessionData = { history: [], lastActivity: new Date().toISOString() };

  if (fs.existsSync(sessionPath)) {
    try {
      data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as SessionData;
    } catch { /* reset */ }
  }

  data.history.push({ ...message, timestamp: new Date() });
  data.lastActivity = new Date().toISOString();

  // Garde seulement les 100 derniers messages
  if (data.history.length > 100) {
    data.history = data.history.slice(-100);
  }

  fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2));
}

export function clearHistory(channelId: ChannelId, senderId: string): void {
  const sessionPath = getSessionPath(channelId, senderId);
  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
}
