import { logger } from '../utils/logger';

export interface SandboxResult {
  exports: Record<string, unknown>;
  error?:  string;
}

/**
 * Load a plugin module with an isolated require cache entry.
 * For production hardening consider replacing with vm2 or isolated-vm.
 */
export function loadPluginSandboxed(pluginPath: string): SandboxResult {
  try {
    // Clear cached module so reloads always get a fresh copy
    delete require.cache[require.resolve(pluginPath)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pluginModule = require(pluginPath) as Record<string, unknown>;
    return { exports: pluginModule };
  } catch (err) {
    logger.error('PluginSandbox', `Failed to load ${pluginPath}`, (err as Error).message);
    return { exports: {}, error: (err as Error).message };
  }
}
