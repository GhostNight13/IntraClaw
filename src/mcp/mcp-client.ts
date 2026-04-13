// src/mcp/mcp-client.ts
// MCP Client — connects to external MCP servers, discovers and calls their tools.
// The @modelcontextprotocol/sdk is ESM-only, so we use dynamic import().

import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const MCP_CONFIG_PATH = path.resolve(process.cwd(), 'mcp-servers.json');

interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

interface ConnectedServer {
  name: string;
  client: unknown;     // Client from @modelcontextprotocol/sdk (loaded dynamically)
  transport: unknown;  // StdioClientTransport
  tools: MCPTool[];
}

let _servers: ConnectedServer[] = [];

// Lazy-loaded SDK modules
let _Client: any = null;
let _StdioClientTransport: any = null;

/**
 * Dynamically load the ESM-only MCP SDK.
 */
async function loadSDK(): Promise<boolean> {
  if (_Client && _StdioClientTransport) return true;
  try {
    const clientMod = await import('@modelcontextprotocol/sdk/client/index.js');
    const stdioMod = await import('@modelcontextprotocol/sdk/client/stdio.js');
    _Client = clientMod.Client;
    _StdioClientTransport = stdioMod.StdioClientTransport;
    return true;
  } catch (err) {
    logger.error('MCPClient', 'Failed to load MCP SDK', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Load MCP server configs from mcp-servers.json
 */
function loadConfig(): MCPServerConfig[] {
  try {
    if (!fs.existsSync(MCP_CONFIG_PATH)) {
      // Create default empty config
      fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf8')) as MCPServerConfig[];
  } catch (err) {
    logger.error('MCPClient', 'Failed to load config', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Connect to a single MCP server.
 */
async function connectServer(config: MCPServerConfig): Promise<ConnectedServer | null> {
  try {
    const transport = new _StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
    });

    const client = new _Client(
      { name: 'IntraClaw', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    // Discover tools
    const toolsResult = await client.listTools();
    const tools: MCPTool[] = (toolsResult.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema as Record<string, unknown>,
      serverName: config.name,
    }));

    logger.info('MCPClient', `Connected to ${config.name} (${tools.length} tools)`);
    return { name: config.name, client, transport, tools };
  } catch (err) {
    logger.warn('MCPClient', `Failed to connect to ${config.name}`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Initialize all configured MCP servers.
 * Never blocks startup — errors are logged and swallowed.
 */
export async function initMCPServers(): Promise<void> {
  const configs = loadConfig().filter(c => c.enabled);
  if (configs.length === 0) {
    logger.info('MCPClient', 'No MCP servers configured');
    return;
  }

  const sdkReady = await loadSDK();
  if (!sdkReady) {
    logger.warn('MCPClient', 'MCP SDK unavailable — skipping server connections');
    return;
  }

  logger.info('MCPClient', `Connecting to ${configs.length} MCP servers...`);

  const results = await Promise.allSettled(configs.map(connectServer));

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      _servers.push(result.value);
    }
  }

  logger.info('MCPClient', `${_servers.length}/${configs.length} MCP servers connected`);
}

/**
 * Get all available MCP tools across all connected servers.
 */
export function getMCPTools(): MCPTool[] {
  return _servers.flatMap(s => s.tools);
}

/**
 * Get a human-readable index of available MCP tools (for action planner prompt).
 */
export function getMCPToolIndex(): string {
  const tools = getMCPTools();
  if (tools.length === 0) return 'Aucun outil MCP externe connecte.';

  const byServer = new Map<string, MCPTool[]>();
  for (const tool of tools) {
    const list = byServer.get(tool.serverName) ?? [];
    list.push(tool);
    byServer.set(tool.serverName, list);
  }

  const lines: string[] = [];
  for (const [server, serverTools] of byServer) {
    lines.push(`**${server}** (${serverTools.length} outils) :`);
    for (const t of serverTools) {
      lines.push(`  - \`${t.name}\`: ${t.description}`);
    }
  }
  return lines.join('\n');
}

/**
 * Call an MCP tool by name.
 */
export async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<{
  success: boolean;
  content: string;
  error?: string;
}> {
  const tool = getMCPTools().find(t => t.name === toolName);
  if (!tool) {
    return { success: false, content: '', error: `MCP tool not found: ${toolName}` };
  }

  const server = _servers.find(s => s.name === tool.serverName);
  if (!server) {
    return { success: false, content: '', error: `MCP server not connected: ${tool.serverName}` };
  }

  try {
    const result = await (server.client as any).callTool({ name: toolName, arguments: args });
    const content = (result.content as Array<{ type: string; text?: string }>)
      ?.map((c: any) => c.text ?? '')
      .join('\n') ?? '';

    return { success: true, content };
  } catch (err) {
    return {
      success: false,
      content: '',
      error: err instanceof Error ? err.message : 'MCP tool call failed',
    };
  }
}

/**
 * Disconnect all MCP servers gracefully.
 */
export async function closeMCPServers(): Promise<void> {
  for (const server of _servers) {
    try {
      await (server.client as any).close();
    } catch {
      // silent — shutdown must not crash
    }
  }
  _servers = [];
  logger.info('MCPClient', 'All MCP servers disconnected');
}
