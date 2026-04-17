// src/tools/auto-registry.ts
// Self-Registering Tool System — auto-discovers .ts files in builtin/ at startup
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { ToolDefinition, ToolResult } from './builtin/types';

// Re-export types so consumers can import from one place
export type { ToolDefinition, ToolParameter, ToolResult } from './builtin/types';

// ─── Registry state ──────────────────────────────────────────────────────────

const _tools = new Map<string, ToolDefinition>();
let _initialized = false;

// ─── Auto-discovery ──────────────────────────────────────────────────────────

const BUILTIN_DIR = path.resolve(__dirname, 'builtin');

/**
 * Scan `src/tools/builtin/` for tool files and register them automatically.
 * Each file must export a `toolDefinition` conforming to ToolDefinition.
 * Called once at startup; subsequent calls are no-ops.
 */
export function initToolRegistry(): void {
  if (_initialized) return;
  _initialized = true;

  if (!fs.existsSync(BUILTIN_DIR)) {
    logger.warn('ToolRegistry', `Builtin directory not found: ${BUILTIN_DIR}`);
    return;
  }

  const files = fs.readdirSync(BUILTIN_DIR).filter(f => {
    // Accept .ts source files and .js compiled files, skip types/index/test
    const base = path.basename(f, path.extname(f));
    return (f.endsWith('.ts') || f.endsWith('.js'))
      && base !== 'types'
      && base !== 'index'
      && !base.endsWith('.test')
      && !base.endsWith('.spec')
      && !f.endsWith('.d.ts')
      && !f.endsWith('.map');
  });

  let loaded = 0;
  for (const file of files) {
    try {
      const filePath = path.join(BUILTIN_DIR, file);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(filePath);
      const def: ToolDefinition | undefined = mod.toolDefinition ?? mod.default;
      if (!def || !def.name || !def.execute) {
        logger.warn('ToolRegistry', `Skipping ${file}: no valid toolDefinition export`);
        continue;
      }
      _tools.set(def.name, def);
      loaded++;
    } catch (err) {
      logger.error('ToolRegistry', `Failed to load tool from ${file}`, err instanceof Error ? err.message : err);
    }
  }

  logger.info('ToolRegistry', `Auto-discovery complete: ${loaded} tools loaded from ${files.length} files`);
  if (loaded > 0) {
    logger.info('ToolRegistry', `Registered tools: ${[..._tools.keys()].join(', ')}`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all registered tools.
 */
export function getTools(): ToolDefinition[] {
  return [..._tools.values()];
}

/**
 * Get a specific tool by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return _tools.get(name);
}

/**
 * Execute a tool by name with given parameters.
 * Returns a ToolResult — never throws.
 */
export async function executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const tool = _tools.get(name);
  if (!tool) {
    return { success: false, error: `Tool not found: ${name}` };
  }

  // Validate required params
  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    const def = paramDef as { required?: boolean };
    if (def.required && (params[paramName] === undefined || params[paramName] === null)) {
      return { success: false, error: `Missing required parameter: ${paramName}` };
    }
  }

  try {
    const startMs = Date.now();
    const result = await tool.execute(params);
    const durationMs = Date.now() - startMs;
    logger.info('ToolRegistry', `Tool "${name}" executed in ${durationMs}ms — ${result.success ? 'OK' : 'FAIL'}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('ToolRegistry', `Tool "${name}" threw: ${msg}`);
    return { success: false, error: `Tool execution error: ${msg}` };
  }
}

/**
 * Register a tool at runtime (e.g., from a plugin or marketplace skill).
 * Overwrites any existing tool with the same name.
 */
export function registerTool(def: ToolDefinition): void {
  if (!def.name || !def.execute) {
    throw new Error('registerTool: definition must have name and execute');
  }
  const isOverwrite = _tools.has(def.name);
  _tools.set(def.name, def);
  logger.info('ToolRegistry', `${isOverwrite ? 'Overwrote' : 'Registered'} tool: ${def.name}`);
}

/**
 * Unregister a tool by name.
 */
export function unregisterTool(name: string): boolean {
  const removed = _tools.delete(name);
  if (removed) logger.info('ToolRegistry', `Unregistered tool: ${name}`);
  return removed;
}

/**
 * Get tool count (useful for health checks).
 */
export function getToolCount(): number {
  return _tools.size;
}

/**
 * Check if registry has been initialized.
 */
export function isInitialized(): boolean {
  return _initialized;
}

/**
 * Find tools whose name or description matches a keyword (simple semantic match).
 */
export function findToolsByKeyword(keyword: string): ToolDefinition[] {
  const lower = keyword.toLowerCase();
  return [..._tools.values()].filter(t =>
    t.name.toLowerCase().includes(lower)
    || t.description.toLowerCase().includes(lower),
  );
}
