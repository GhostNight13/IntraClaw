import { IntraclawPlugin } from './plugin-types';

interface PluginRecord {
  plugin:   IntraclawPlugin;
  loadedAt: string;
  status:   'active' | 'error';
  error?:   string;
}

const pluginRegistry = new Map<string, PluginRecord>();

export function registerPlugin(plugin: IntraclawPlugin): void {
  pluginRegistry.set(plugin.id, {
    plugin,
    loadedAt: new Date().toISOString(),
    status:   'active',
  });
}

export function getPlugin(id: string): IntraclawPlugin | null {
  return pluginRegistry.get(id)?.plugin ?? null;
}

export function getAllPlugins(): PluginRecord[] {
  return Array.from(pluginRegistry.values());
}

export function getActivePlugins(): IntraclawPlugin[] {
  return Array.from(pluginRegistry.values())
    .filter(r => r.status === 'active')
    .map(r => r.plugin);
}

export function markPluginError(id: string, error: string): void {
  const rec = pluginRegistry.get(id);
  if (rec) {
    rec.status = 'error';
    rec.error  = error;
  }
}
