# Skills

IntraClaw has two complementary skill systems. Static skills are what *you*
write. Learned skills are what the agent writes *for itself* after a
successful run.

## Static skills — user-defined

Live under `skills/*.yaml`, loaded at startup by
`src/skills/skill-loader.ts`. Triggered by keyword match against the
incoming message.

### YAML schema

```yaml
id:          summarize-pdf            # unique identifier
name:        Summarize PDF            # human label
description: Extracts and summarizes a PDF into 5 bullets
version:     1.0.0
triggers:                             # case-insensitive substring match
  - summarize pdf
  - résume le pdf
requiredTools:                        # tool ids needed at runtime
  - file-ops
  - web-search
prompt: |                             # system prompt injected into the LLM call
  You are a PDF summarizer. Extract the top 5 takeaways...
enabled: true
createdAt: 2026-01-15T10:00:00Z
updatedAt: 2026-01-15T10:00:00Z
```

Execution goes through `src/skills/skill-executor.ts`, which prepends
`buildSystemPrompt()` (the agent's core memory context) to the skill's
prompt before dispatching to `ask()`.

## Learned skills — Voyager-style

Live in SQLite (`learned_skills` table), managed by
`src/evolution/skill-library.ts`. When the autonomous loop solves a novel
task successfully, it distills the winning trajectory into a reusable
skill and stores three things side-by-side:

1. **Code** — the TypeScript/JS snippet or plan that worked
2. **Description** — a 3–4 sentence natural-language summary, written by a
   cheap `fast`-tier LLM call (`generateDescription`)
3. **Embedding** — a vector computed by `embed()` (Ollama → OpenAI → hash
   fallback), stored as JSON for cosine similarity lookup

### Retrieval

Next time a task comes in, the loop calls `findRelevant(query, k)`. It
embeds the query, cosine-compares against every stored skill, and returns
the top-k matches sorted by similarity. The agent then decides whether to
reuse, adapt, or ignore — usage and success are tracked per skill in
`usage_count` / `success_count`, which surface in the dashboard.

Versions bump automatically: re-learning a skill with the same `name`
updates the row and increments `version`.

## Built-in tools

Available under `src/tools/builtin/` and wired into the universal
executor:

| Tool          | Purpose                                                 |
| ------------- | ------------------------------------------------------- |
| `calculator`  | Safe math evaluator — no `eval()`, Pratt parser         |
| `datetime`    | Current time, time zones, formatting, arithmetic        |
| `file-ops`    | Read/write/list files within the workspace              |
| `shell-exec` | Execute a shell command with a timeout                   |
| `web-search`  | Zero-key search: DDG Instant Answer + Google News RSS + Wikipedia + SearXNG |

### Writing a new builtin tool

Every tool exports a `ToolDefinition` (`src/tools/builtin/types.ts`):

```ts
import type { ToolDefinition, ToolResult } from './types';

const tool: ToolDefinition = {
  name: 'currency-convert',
  description: 'Convert between currencies at current mid-market rate',
  parameters: {
    amount: { type: 'number', description: 'Amount to convert', required: true },
    from:   { type: 'string', description: 'Source currency (ISO 4217)', required: true },
    to:     { type: 'string', description: 'Target currency (ISO 4217)', required: true },
  },
  async execute(params): Promise<ToolResult> {
    const { amount, from, to } = params as { amount: number; from: string; to: string };
    try {
      const rate = await fetchRate(from, to);
      return { success: true, data: { converted: amount * rate, rate } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  },
};

export default tool;
```

Drop the file into `src/tools/builtin/`. The executor picks it up by its
`name` when the LLM selects it during tool routing. Parameter validation,
timeouts, and retries are handled upstream — your `execute()` only needs
to return a `ToolResult`.
