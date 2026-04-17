/**
 * INTRACLAW — Universal Message Gateway
 * Centralise tous les canaux de communication en une interface unifiée.
 * Chaque adapter s'enregistre ici et les messages sont normalisés.
 */
import type { ChannelAdapter, ChannelId, UniversalMessage, SendOptions } from './types';
import {
  isAuthorized,
  loadAuthorizedUsers,
  appendToHistory,
} from './session-store';

// Logger simplifié (compatible avec le logger existant du projet)
function log(level: 'info' | 'warn' | 'error', ctx: string, msg: string, err?: unknown): void {
  const prefix = { info: '✅', warn: '⚠️ ', error: '❌' }[level];
  const timestamp = new Date().toISOString().slice(11, 19);
  if (level === 'error') {
    console.error(`[${timestamp}] ${prefix} [Gateway:${ctx}] ${msg}`, err ?? '');
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] ${prefix} [Gateway:${ctx}] ${msg}`, err ?? '');
  } else {
    console.log(`[${timestamp}] ${prefix} [Gateway:${ctx}] ${msg}`, err ?? '');
  }
}

// ── Registre des adapters ────────────────────────────────────────

const adapters = new Map<ChannelId, ChannelAdapter>();

/** Handler global appelé par tous les adapters pour chaque message entrant */
type MessageHandler = (
  msg: UniversalMessage,
  respond: (text: string, opts?: SendOptions) => Promise<void>,
) => Promise<void>;

let globalMessageHandler: MessageHandler | null = null;

// ── Registration ─────────────────────────────────────────────────

/**
 * Enregistre un adapter de canal et démarre son init
 */
export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channelId, adapter);

  // Injecte le handler entrant
  adapter.onMessage(async (msg: UniversalMessage) => {
    await handleIncoming(msg);
  });

  // Init asynchrone (non-bloquant)
  adapter.init().then(() => {
    log('info', adapter.channelId, 'Canal prêt');
  }).catch((err: Error) => {
    log('warn', adapter.channelId, `Échec init (ignoré) : ${err.message}`);
  });

  log('info', adapter.channelId, 'Adapter enregistré');
}

/**
 * Définit le handler global pour traiter les messages
 */
export function setMessageHandler(handler: MessageHandler): void {
  globalMessageHandler = handler;
}

// ── Incoming ────────────────────────────────────────────────────

async function handleIncoming(msg: UniversalMessage): Promise<void> {
  // 1. Vérification autorisation
  if (!isAuthorized(msg.channelId, msg.senderId)) {
    log('warn', msg.channelId, `Message non autorisé de ${msg.senderId}`);
    await replyTo(msg, '❌ Accès non autorisé. Contacte l\'administrateur.');
    return;
  }

  // 2. Sauvegarde dans l'historique
  appendToHistory(msg.channelId, msg.senderId, {
    role: 'user',
    content: msg.content,
  });

  log('info', msg.channelId, `Message de ${msg.senderName}: ${msg.content.slice(0, 80)}`);

  // 3. Crée la fonction respond bound à ce message
  const respond = async (text: string, opts?: SendOptions): Promise<void> => {
    await replyTo(msg, text, opts);
  };

  // 4. Dispatch vers le handler global
  if (globalMessageHandler) {
    try {
      await globalMessageHandler(msg, respond);
    } catch (err) {
      log('error', msg.channelId, 'Erreur handler', err);
      await replyTo(msg, '❌ Une erreur s\'est produite. Réessaie dans quelques secondes.');
    }
  } else {
    log('warn', msg.channelId, 'Aucun handler global défini — message ignoré');
  }
}

// ── Outgoing ────────────────────────────────────────────────────

/**
 * Envoie un message via un canal spécifique
 */
export async function sendToChannel(
  channelId: ChannelId,
  recipientId: string,
  text: string,
  options?: SendOptions,
): Promise<void> {
  const adapter = adapters.get(channelId);
  if (!adapter) {
    log('warn', channelId, 'Canal non disponible');
    return;
  }
  if (!adapter.isReady()) {
    log('warn', channelId, 'Canal non prêt');
    return;
  }

  // Découpe les messages trop longs (limite selon le canal)
  const MAX_LENGTH: Record<string, number> = {
    discord: 2000, slack: 4000, telegram: 4096,
    whatsapp: 1500, sms: 1600, email: 100_000,
    default: 4096,
  };
  const maxLen = MAX_LENGTH[channelId] ?? MAX_LENGTH['default'] ?? 4096;

  const chunks = splitText(text, maxLen);
  for (const chunk of chunks) {
    await adapter.send(recipientId, chunk, options);
    // Sauvegarde dans l'historique
    appendToHistory(channelId, recipientId, {
      role: 'assistant',
      content: chunk,
    });
  }
}

async function replyTo(
  msg: UniversalMessage,
  text: string,
  options?: SendOptions,
): Promise<void> {
  await sendToChannel(msg.channelId, msg.senderId, text, options);
}

// ── Broadcast ───────────────────────────────────────────────────

/**
 * Envoie une notification à tous les canaux actifs (pour le morning brief, etc.)
 */
export async function broadcastToAll(text: string): Promise<void> {
  for (const [id, adapter] of adapters) {
    if (adapter.isReady()) {
      log('info', id, `Broadcast: ${text.slice(0, 50)}`);
      // Note: pour le broadcast, on n'a pas de recipientId spécifique
      // Les adapters qui supportent ça doivent avoir une méthode broadcast
      const adapterAny = adapter as ChannelAdapter & { broadcast?: (t: string) => Promise<void> };
      if (typeof adapterAny.broadcast === 'function') {
        await adapterAny.broadcast(text).catch((e: Error) =>
          log('warn', id, `Broadcast échoué: ${e.message}`),
        );
      }
    }
  }
}

// ── Utilities ───────────────────────────────────────────────────

export function getActiveChannels(): ChannelId[] {
  return Array.from(adapters.entries())
    .filter(([, a]) => a.isReady())
    .map(([id]) => id);
}

export function isChannelReady(channelId: ChannelId): boolean {
  return adapters.get(channelId)?.isReady() ?? false;
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxLen, text.length);
    // Coupe sur un saut de ligne si possible
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > i) end = lastNewline + 1;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

// ── Init ────────────────────────────────────────────────────────

/**
 * À appeler au démarrage du serveur
 */
export function initGateway(): void {
  loadAuthorizedUsers();
  log('info', 'init', 'Gateway démarré');
}
