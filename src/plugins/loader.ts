import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { loadPluginSandboxed } from './sandbox';
import { registerPlugin, markPluginError } from './registry';
import { IntraclawPlugin, PluginContext } from './plugin-types';
import { AgentTask } from '../types';

// ── Plugin-contributed registries ────────────────────────────────────────────

const pluginTools  = new Map<string, (args: unknown) => Promise<unknown>>();
const pluginSkills: string[] = [];
const pluginMemory = new Map<string, string>();

const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

// ── Context factory ──────────────────────────────────────────────────────────

function createContext(pluginName: string): PluginContext {
  return {
    registerTool(name: string, fn: (args: unknown) => Promise<unknown>): void {
      pluginTools.set(name, fn);
      logger.info('Plugin', `[${pluginName}] Registered tool: ${name}`);
    },

    registerSkill(yamlContent: string): void {
      pluginSkills.push(yamlContent);
      logger.info('Plugin', `[${pluginName}] Registered skill`);
    },

    async getMemory(key: string): Promise<string | null> {
      return pluginMemory.get(`${pluginName}:${key}`) ?? null;
    },

    async setMemory(key: string, value: string): Promise<void> {
      pluginMemory.set(`${pluginName}:${key}`, value);
    },

    async notify(message: string): Promise<void> {
      try {
        // Use indirect require to avoid TypeScript resolving a potentially absent path.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const mod = (new Function('r', 'return r("../tools/telegram-helper")'))(require) as Record<string, unknown>;
        if (typeof mod.sendTelegramMessage === 'function') {
          await (mod.sendTelegramMessage as (m: string) => Promise<void>)(message);
        }
      } catch {
        // best-effort — module may not exist in all environments
      }
    },

    async ask(prompt: string, options?: { maxTokens?: number }): Promise<string> {
      const { ask } = await import('../ai');
      const result = await ask({
        messages:   [{ role: 'user', content: prompt }],
        maxTokens:  options?.maxTokens ?? 500,
        task:       AgentTask.MAINTENANCE,
        modelTier:  'fast',
      });
      return result.content;
    },

    logger: {
      info:  (msg: string, ...args: unknown[]) => logger.info(`Plugin:${pluginName}`, msg, args.length ? args : undefined),
      warn:  (msg: string, ...args: unknown[]) => logger.warn(`Plugin:${pluginName}`, msg, args.length ? args : undefined),
      error: (msg: string, ...args: unknown[]) => logger.error(`Plugin:${pluginName}`, msg, args.length ? args : undefined),
    },
  };
}

// ── Single plugin loader ─────────────────────────────────────────────────────

async function loadPlugin(pluginDir: string): Promise<void> {
  const manifestPath = path.join(pluginDir, 'manifest.json');
  const indexJsPath  = path.join(pluginDir, 'index.js');
  const indexTsPath  = path.join(pluginDir, 'index.ts');

  if (!fs.existsSync(manifestPath)) {
    logger.warn('Plugins', `Missing manifest.json in ${pluginDir} — skipping`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
    id?: string;
    name?: string;
  };

  const entryPoint = fs.existsSync(indexJsPath) ? indexJsPath : indexTsPath;

  if (!fs.existsSync(entryPoint)) {
    logger.warn('Plugins', `Missing index.js/ts in ${pluginDir} — skipping`);
    return;
  }

  try {
    const { exports, error } = loadPluginSandboxed(entryPoint);

    if (error) {
      markPluginError(manifest.id ?? 'unknown', error);
      logger.error('Plugins', `Sandbox error for ${manifest.name ?? pluginDir}: ${error}`);
      return;
    }

    const PluginClass = exports.default as new () => IntraclawPlugin;

    if (typeof PluginClass !== 'function') {
      const msg = 'Plugin does not export a default class';
      markPluginError(manifest.id ?? 'unknown', msg);
      logger.error('Plugins', `${manifest.name ?? pluginDir}: ${msg}`);
      return;
    }

    const plugin = new PluginClass();
    const ctx    = createContext(plugin.name ?? manifest.name ?? 'unknown');

    await plugin.onLoad(ctx);
    registerPlugin(plugin);

    logger.info('Plugins', `Loaded plugin: ${plugin.name} v${plugin.version}`);
  } catch (err) {
    const msg = (err as Error).message;
    markPluginError(manifest.id ?? 'unknown', msg);
    logger.error('Plugins', `Failed to load plugin ${manifest.name ?? pluginDir}: ${msg}`);
  }
}

// ── Public: load all plugins from plugins/ ───────────────────────────────────

export async function loadAllPlugins(): Promise<void> {
  if (!fs.existsSync(PLUGINS_DIR)) {
    logger.info('Plugins', 'No plugins/ directory — skipping');
    return;
  }

  const entries    = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory());

  if (pluginDirs.length === 0) {
    logger.info('Plugins', 'No plugins found in plugins/');
    return;
  }

  logger.info('Plugins', `Loading ${pluginDirs.length} plugin(s)...`);

  for (const dir of pluginDirs) {
    await loadPlugin(path.join(PLUGINS_DIR, dir.name));
  }
}

// ── Public: accessors for contributed tools/skills ───────────────────────────

export function getPluginTools(): Map<string, (args: unknown) => Promise<unknown>> {
  return pluginTools;
}

export function getPluginSkills(): string[] {
  return pluginSkills;
}
