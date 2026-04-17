/**
 * INTRACLAW — Universal Messaging Types
 * Interface commune pour tous les canaux (Telegram, WhatsApp, Discord, Slack, Matrix...)
 */

export type ChannelId =
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'slack'
  | 'signal'
  | 'imessage'
  | 'matrix'
  | 'email'
  | 'sms';

export interface UniversalMediaAttachment {
  type:      'image' | 'audio' | 'video' | 'file' | 'sticker';
  url:       string;
  filename?: string;
  mimeType?: string;
  size?:     number;
}

export interface UniversalMessage {
  id:         string;
  channelId:  ChannelId;
  senderId:   string;       // Identifiant unique de l'expéditeur sur ce canal
  senderName: string;       // Nom affiché
  content:    string;       // Texte du message
  timestamp:  Date;
  replyTo?:   string;       // ID du message original si c'est une réponse
  media?:     UniversalMediaAttachment[];
  metadata?:  Record<string, unknown>;  // Données spécifiques au canal
}

export interface SendOptions {
  parseMode?: 'markdown' | 'html' | 'plain';
  replyTo?:   string;
  media?:     UniversalMediaAttachment[];
}

export interface ChannelAdapter {
  readonly channelId: ChannelId;

  /** Initialise la connexion au service */
  init(): Promise<void>;

  /** Envoie un message à un destinataire */
  send(recipientId: string, text: string, options?: SendOptions): Promise<void>;

  /** Enregistre le handler pour les messages entrants */
  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void;

  /** Retourne true si le canal est connecté et opérationnel */
  isReady(): boolean;

  /** Arrêt propre du canal */
  destroy?(): Promise<void>;
}

export interface AuthorizedUser {
  channelId: ChannelId;
  senderId:  string;
  userId?:   string;        // Lien vers User en DB si auth JWT
  addedAt:   Date;
}

export interface ConversationMessage {
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
}
