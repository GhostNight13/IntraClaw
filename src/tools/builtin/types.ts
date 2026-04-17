// src/tools/builtin/types.ts
// Shared types for the self-registering tool system

/**
 * Definition interface that every drop-in tool must export as `default` or `toolDefinition`.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
