import * as WebSocket from 'ws';
import { logger } from '../../utils/logger';

let ws: WebSocket.WebSocket | null = null;
let connected = false;
let messageId = 1;
const pendingMessages = new Map<number, { resolve: Function; reject: Function }>();

export async function initHomeAssistant(): Promise<void> {
  if (!process.env.HA_URL || !process.env.HA_TOKEN) {
    logger.info('SmartHome', 'Home Assistant not configured — skipping');
    return;
  }

  const wsUrl = process.env.HA_URL.replace(/^http/, 'ws') + '/api/websocket';

  return new Promise((resolve, reject) => {
    ws = new WebSocket.WebSocket(wsUrl);

    ws.on('message', (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'auth_required') {
        ws!.send(JSON.stringify({ type: 'auth', access_token: process.env.HA_TOKEN }));
      } else if (msg.type === 'auth_ok') {
        connected = true;
        logger.info('SmartHome', 'Connected to Home Assistant');
        resolve();
      } else if (msg.type === 'auth_invalid') {
        reject(new Error('HA auth invalid'));
      } else if (msg.type === 'result' && msg.id) {
        const pending = pendingMessages.get(msg.id);
        if (pending) {
          pendingMessages.delete(msg.id);
          if (msg.success) pending.resolve(msg.result);
          else pending.reject(new Error(msg.error?.message ?? 'HA error'));
        }
      }
    });

    ws.on('error', (err) => { logger.error('SmartHome', 'WS error', err); reject(err); });
    ws.on('close', () => { connected = false; logger.warn('SmartHome', 'HA connection closed'); });
  });
}

function send<T>(message: object): Promise<T> {
  if (!ws || !connected) throw new Error('Home Assistant not connected');
  const id = messageId++;
  return new Promise((resolve, reject) => {
    pendingMessages.set(id, { resolve, reject });
    ws!.send(JSON.stringify({ ...message, id }));
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error('HA request timeout'));
      }
    }, 10000);
  });
}

export function isConnected(): boolean { return connected; }

export async function getStates(): Promise<{ entity_id: string; state: string; attributes: Record<string, unknown> }[]> {
  if (!connected) return [];
  return send<{ entity_id: string; state: string; attributes: Record<string, unknown> }[]>({ type: 'get_states' });
}

export async function callHAService(domain: string, service: string, entityId: string, data?: object): Promise<void> {
  if (!connected) throw new Error('Home Assistant not connected');
  await send({ type: 'call_service', domain, service, service_data: { entity_id: entityId, ...data } });
}

export const lights = {
  on:  (id: string) => callHAService('light', 'turn_on', id),
  off: (id: string) => callHAService('light', 'turn_off', id),
  dim: (id: string, brightness: number) => callHAService('light', 'turn_on', id, { brightness: Math.round(brightness * 2.55) }),
};

export const climate = {
  setTemp: (id: string, temp: number) => callHAService('climate', 'set_temperature', id, { temperature: temp }),
};

export const covers = {
  open:  (id: string) => callHAService('cover', 'open_cover', id),
  close: (id: string) => callHAService('cover', 'close_cover', id),
};

export const scenes = {
  activate: (id: string) => callHAService('scene', 'turn_on', id),
};
