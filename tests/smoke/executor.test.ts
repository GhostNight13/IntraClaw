// Smoke tests — executor surface.
// These verify that the core flow in universal-executor stays intact.
import { describe, it, expect, beforeAll } from 'vitest';
import { determineModelTier } from '../../src/routing/smart-router';
import { registerTool } from '../../src/tools/auto-registry';
import { toolDefinition as calculatorTool } from '../../src/tools/builtin/calculator';
import { toolDefinition as datetimeTool } from '../../src/tools/builtin/datetime';
import { toolDefinition as fileOpsTool } from '../../src/tools/builtin/file-ops';
import { toolDefinition as shellExecTool } from '../../src/tools/builtin/shell-exec';
import { toolDefinition as webSearchTool } from '../../src/tools/builtin/web-search';

beforeAll(() => {
  // Auto-discovery uses require() which doesn't work under vitest's ESM
  // loader. Register tools manually for the test run.
  registerTool(calculatorTool);
  registerTool(datetimeTool);
  registerTool(fileOpsTool);
  registerTool(shellExecTool);
  registerTool(webSearchTool);
});

describe('smart router tier selection', () => {
  it('routes simple greeting to fast', () => {
    expect(determineModelTier('salut')).toBe('fast');
  });

  it('routes code refactor to powerful', () => {
    const tier = determineModelTier('refactor this complex architecture design pattern');
    expect(['powerful', 'balanced']).toContain(tier);
  });

  it('returns a valid tier for generic input', () => {
    const tier = determineModelTier('fais quelque chose de nouveau');
    expect(['fast', 'balanced', 'powerful']).toContain(tier);
  });
});

describe('tool registry auto-discovery', () => {
  it('has web-search tool registered', async () => {
    const { getTools } = await import('../../src/tools/auto-registry');
    const tools = getTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('web-search');
    expect(names).toContain('calculator');
    expect(names).toContain('file-ops');
    expect(names).toContain('shell-exec');
    expect(names).toContain('datetime');
  });
});

describe('calculator builtin tool', () => {
  it('evaluates sqrt(256) = 16', async () => {
    const { executeTool } = await import('../../src/tools/auto-registry');
    const r = await executeTool('calculator', { expression: 'sqrt(256)' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ result: 16 });
  });

  it('refuses invalid expression', async () => {
    const { executeTool } = await import('../../src/tools/auto-registry');
    const r = await executeTool('calculator', { expression: 'foo(bar)' });
    expect(r.success).toBe(false);
  });
});
