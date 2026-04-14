import { getStates, callHAService, isConnected } from './ha-client';

export interface DeviceInfo {
  entity_id: string;
  friendly_name: string;
  state: string;
  domain: string;
}

export async function listDevices(domainFilter?: string): Promise<DeviceInfo[]> {
  if (!isConnected()) return [];
  const states = await getStates();
  return states
    .filter(s => !domainFilter || s.entity_id.startsWith(domainFilter + '.'))
    .map(s => ({
      entity_id: s.entity_id,
      friendly_name: (s.attributes['friendly_name'] as string) ?? s.entity_id,
      state: s.state,
      domain: s.entity_id.split('.')[0],
    }));
}

export async function controlDevice(intent: string): Promise<string> {
  if (!isConnected()) return 'Home Assistant not configured';

  const lower = intent.toLowerCase();

  // Parse NL intent
  if (/éteins? tout|turn off all|alles uit/.test(lower)) {
    await callHAService('homeassistant', 'turn_off', 'all');
    return 'Tous les appareils éteints';
  }

  if (/lumière|light|licht/.test(lower) && /allume|turn on|aan/.test(lower)) {
    if (/salon|living|woonkamer/.test(lower)) {
      await callHAService('light', 'turn_on', 'light.salon');
      return 'Lumière salon allumée';
    }
    await callHAService('light', 'turn_on', 'light.all_lights');
    return 'Lumières allumées';
  }

  if (/lumière|light/.test(lower) && /étein|turn off|uit/.test(lower)) {
    await callHAService('light', 'turn_off', 'light.all_lights');
    return 'Lumières éteintes';
  }

  if (/(\d+)\s*(?:°|degrés?|degrees?)/.test(lower)) {
    const match = lower.match(/(\d+)\s*(?:°|degrés?|degrees?)/);
    if (match) {
      const temp = parseInt(match[1], 10);
      await callHAService('climate', 'set_temperature', 'climate.thermostat', { temperature: temp });
      return `Température réglée à ${temp}°C`;
    }
  }

  if (/volets?|shutter|rolluik/.test(lower) && /ferme|close|dicht/.test(lower)) {
    await callHAService('cover', 'close_cover', 'cover.all_covers');
    return 'Volets fermés';
  }

  return 'Commande non reconnue. Essaie: "allume les lumières", "température à 21°", "ferme les volets"';
}
