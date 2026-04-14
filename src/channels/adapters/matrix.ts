/**
 * INTRACLAW — Matrix Adapter
 * Utilise matrix-js-sdk pour se connecter à un homeserver Matrix.
 * Compatible avec Element, Beeper, et n'importe quel client Matrix.
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from '../types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown) {
  const prefix = { info: '✅', warn: '⚠️ ', error: '❌' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [Matrix] ${msg}`, err ?? '');
}

export class MatrixAdapter implements ChannelAdapter {
  readonly channelId = 'matrix' as const;
  private client: any = null;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private startupTs: number = Date.now();

  constructor(
    private readonly homeserverUrl: string,
    private readonly userId: string,
    private readonly accessToken: string,
  ) {}

  async init(): Promise<void> {
    if (!this.homeserverUrl || !this.userId || !this.accessToken) {
      log('warn', 'Variables Matrix manquantes (MATRIX_HOMESERVER, MATRIX_USER_ID, MATRIX_ACCESS_TOKEN) — désactivé');
      return;
    }

    let sdk: any;
    try {
      sdk = require('matrix-js-sdk');
    } catch (err: any) {
      log('warn', `Package matrix-js-sdk non installé : ${err.message}`);
      return;
    }

    this.startupTs = Date.now();

    this.client = sdk.createClient({
      baseUrl:     this.homeserverUrl,
      userId:      this.userId,
      accessToken: this.accessToken,
    });

    // Écoute les événements de salle
    this.client.on('Room.timeline', async (event: any, room: any, toStartOfTimeline: boolean) => {
      // Ignore les vieux messages (chargés à l'init)
      if (toStartOfTimeline) return;
      if (event.getTs() < this.startupTs) return;

      // Seulement les messages texte
      if (event.getType() !== 'm.room.message') return;
      if (event.getSender() === this.userId) return;  // Ignore soi-même

      const content = event.getContent();
      if (!content.body || content.msgtype !== 'm.text') return;

      const universal: UniversalMessage = {
        id:        event.getId(),
        channelId: 'matrix',
        senderId:  event.getSender(),         // ex: @alice:matrix.org
        senderName: event.getSender().split(':')[0].replace('@', ''),
        content:   content.body,
        timestamp: new Date(event.getTs()),
        metadata: {
          roomId:    room.roomId,
          roomName:  room.name,
        },
      };

      await this.messageHandler?.(universal);
    });

    this.client.on('sync', (state: string) => {
      if (state === 'PREPARED') {
        this.ready = true;
        log('info', `✅ Connecté à Matrix (${this.userId})`);
      }
    });

    this.client.on('error', (err: Error) => {
      log('error', 'Erreur client Matrix', err);
    });

    log('info', 'Démarrage sync Matrix...');
    await this.client.startClient({ initialSyncLimit: 0 });
  }

  async send(roomId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.client || !this.ready) {
      log('warn', 'Impossible d\'envoyer : client Matrix non prêt');
      return;
    }

    try {
      await this.client.sendTextMessage(roomId, text);
    } catch (err: any) {
      log('error', `Erreur envoi Matrix dans ${roomId}: ${err.message}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    const roomId = process.env.MATRIX_NOTIFICATION_ROOM;
    if (roomId) await this.send(roomId, text);
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  async destroy(): Promise<void> {
    await this.client?.stopClient();
    this.ready = false;
  }
}
