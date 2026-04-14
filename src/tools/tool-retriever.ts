/**
 * INTRACLAW — Tool Retriever
 * Semantic search for tools using ChromaDB embeddings
 * Falls back to keyword search if ChromaDB unavailable
 */
import { getAllTools, getToolByName } from './tool-registry';
import type { ToolDoc } from './tool-registry';
import { logger } from '../utils/logger';

let initialized = false;

export async function indexAllTools(): Promise<void> {
  if (initialized) return;
  try {
    const vm = await import('../memory/vector-memory');

    if (!vm.isVectorMemoryAvailable()) {
      logger.warn('ToolRetriever', 'Vector memory unavailable — tool retrieval will use keyword fallback');
      initialized = true;
      return;
    }

    const tools = getAllTools();

    for (const tool of tools) {
      const text = `Tool: ${tool.name}. ${tool.description} Examples: ${tool.examples.join('; ')}`;
      await vm.storeMemory({
        content: text,
        category: 'tool',
        source: 'tool-registry',
        metadata: { toolName: tool.name, toolCategory: tool.category },
      });
    }

    initialized = true;
    logger.info('ToolRetriever', `Indexed ${tools.length} tools in vector memory`);
  } catch (err) {
    logger.warn('ToolRetriever', `Tool indexing failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    initialized = true;
  }
}

export async function getRelevantTools(taskDescription: string, topK = 5): Promise<ToolDoc[]> {
  try {
    const vm = await import('../memory/vector-memory');

    if (vm.isVectorMemoryAvailable()) {
      const results = await vm.searchMemory(taskDescription, { maxResults: topK, category: 'tool' });
      const tools = results
        .map(r => {
          // toolName is stored in metadata — access via the returned object
          // searchMemory returns { id, content, category, source, timestamp, distance }
          // toolName was stored in metadata but isn't surfaced directly; parse from content
          const match = r.content.match(/^Tool: ([^.]+)\./);
          return match ? getToolByName(match[1].trim()) : undefined;
        })
        .filter((t): t is ToolDoc => t !== undefined);

      if (tools.length > 0) return tools;
    }
  } catch {
    // Fall through to keyword search
  }

  // Keyword fallback
  return keywordSearchTools(taskDescription, topK);
}

function keywordSearchTools(query: string, topK: number): ToolDoc[] {
  const words = query.toLowerCase().split(/\s+/);
  const tools = getAllTools();

  const scored = tools.map(tool => {
    const searchText = `${tool.name} ${tool.description} ${tool.examples.join(' ')} ${tool.category}`.toLowerCase();
    const score = words.reduce((sum, word) => sum + (searchText.includes(word) ? 1 : 0), 0);
    return { tool, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ tool }) => tool);
}
