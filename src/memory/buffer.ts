import { logger } from '../utils/logger';
import type { ConversationBuffer, ConversationMessage, AgentTask } from '../types';

const MAX_MESSAGES  = 100;
const COMPACT_TO    = 60; // keep last 60 messages after compaction

let _buffer: ConversationBuffer = {
  messages: [],
  totalMessages: 0,
};

/**
 * Add a message to the conversation buffer.
 * Triggers compaction if MAX_MESSAGES is reached.
 */
export function addMessage(role: 'user' | 'assistant', content: string, task?: AgentTask): void {
  const message: ConversationMessage = {
    role,
    content,
    timestamp: new Date().toISOString(),
    task,
  };

  _buffer.messages.push(message);
  _buffer.totalMessages++;

  if (_buffer.messages.length > MAX_MESSAGES) {
    compact();
  }
}

/**
 * Compact the buffer: keep only the most recent COMPACT_TO messages.
 * Adds a summary placeholder at the start to signal the truncation.
 */
function compact(): void {
  const kept = _buffer.messages.slice(-COMPACT_TO);
  const dropped = _buffer.messages.length - COMPACT_TO;

  const summary: ConversationMessage = {
    role: 'assistant',
    content: `[Résumé de compaction : ${dropped} messages précédents omis pour économiser le contexte. ` +
             `Total historique : ${_buffer.totalMessages} messages.]`,
    timestamp: new Date().toISOString(),
  };

  _buffer.messages = [summary, ...kept];
  _buffer.compactedAt = new Date().toISOString();

  logger.info('Buffer', `Compacted: dropped ${dropped} messages, kept ${kept.length}`);
}

/**
 * Get all current messages (for injection into AI request).
 */
export function getMessages(): ConversationMessage[] {
  return _buffer.messages;
}

/**
 * Get a slice of recent messages.
 */
export function getRecentMessages(n = 20): ConversationMessage[] {
  return _buffer.messages.slice(-n);
}

/**
 * Clear the buffer entirely (e.g. for maintenance task).
 */
export function clearBuffer(): void {
  const prev = _buffer.messages.length;
  _buffer = {
    messages: [],
    totalMessages: _buffer.totalMessages,
    compactedAt: new Date().toISOString(),
  };
  logger.info('Buffer', `Cleared ${prev} messages`);
}

/**
 * Get buffer stats.
 */
export function getStats(): { inMemory: number; total: number; compactedAt?: string } {
  return {
    inMemory:    _buffer.messages.length,
    total:       _buffer.totalMessages,
    compactedAt: _buffer.compactedAt,
  };
}
