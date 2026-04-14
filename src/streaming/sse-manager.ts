/**
 * INTRACLAW — Server-Sent Events Manager
 * Real-time streaming of agent thoughts and tool calls to dashboard
 */
import type { Response } from 'express';

export type ThoughtEventType = 'thinking' | 'tool_call' | 'tool_result' | 'step' | 'done' | 'error';

export interface ThoughtEvent {
  type: ThoughtEventType;
  content: string;
  timestamp: string;
  taskId: string;
  stepIndex: number;
  metadata?: Record<string, unknown>;
}

class SSEManager {
  private clients = new Map<string, Response>();
  private taskClients = new Map<string, Set<string>>(); // taskId -> clientIds

  addClient(clientId: string, res: Response, taskId?: string): void {
    this.clients.set(clientId, res);
    if (taskId) {
      if (!this.taskClients.has(taskId)) {
        this.taskClients.set(taskId, new Set());
      }
      this.taskClients.get(taskId)!.add(clientId);
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      if (this.clients.has(clientId)) {
        res.write(':heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Cleanup on disconnect
    res.on('close', () => {
      this.removeClient(clientId, taskId);
      clearInterval(heartbeat);
    });
  }

  removeClient(clientId: string, taskId?: string): void {
    this.clients.delete(clientId);
    if (taskId && this.taskClients.has(taskId)) {
      this.taskClients.get(taskId)!.delete(clientId);
      if (this.taskClients.get(taskId)!.size === 0) {
        this.taskClients.delete(taskId);
      }
    }
  }

  emit(clientId: string, event: ThoughtEvent): void {
    const res = this.clients.get(clientId);
    if (res) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  broadcast(event: ThoughtEvent): void {
    // Broadcast to all clients subscribed to this taskId
    const taskClients = this.taskClients.get(event.taskId);
    if (taskClients) {
      for (const clientId of taskClients) {
        this.emit(clientId, event);
      }
    }
  }

  broadcastAll(event: ThoughtEvent): void {
    for (const [clientId] of this.clients) {
      this.emit(clientId, event);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton
export const sseManager = new SSEManager();
