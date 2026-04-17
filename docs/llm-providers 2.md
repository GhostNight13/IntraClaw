# LLM Providers

IntraClaw does not hardcode a single model. `src/providers/multi-provider.ts`
discovers what is reachable on your machine at boot, sorts providers by
priority, and calls them in order — the first one that answers wins.

## The eight providers

| # | Provider          | Type  | Priority | Tiers                      | Detection                                  |
|---|-------------------|-------|----------|----------------------------|--------------------------------------------|
| 1 | Claude CLI        | cli   | 10       | fast · balanced · powerful | `claude` on `PATH`                         |
| 2 | Codex CLI         | cli   | 20       | fast · balanced · powerful | `codex` on `PATH`                          |
| 3 | Gemini CLI        | cli   | 30       | fast · balanced · powerful | `gemini` on `PATH` AND authed              |
| 4 | Ollama — Gemma    | local | 40       | fast · balanced            | Ollama daemon reachable                    |
| 5 | Ollama — Llama    | local | 45       | fast                       | Ollama daemon reachable                    |
| 6 | Anthropic API     | api   | 50       | fast · balanced · powerful | `ANTHROPIC_API_KEY` set                    |
| 7 | OpenAI API        | api   | 60       | fast · balanced · powerful | `OPENAI_API_KEY` set                       |
| 8 | Google Gemini API | api   | 70       | fast · balanced · powerful | `GEMINI_API_KEY` set                       |

Lower priority number = tried first. The intent is simple: paid-flat CLIs
before metered APIs, local models before the internet.

## Tiers

The executor asks for a tier, not a model name. Each provider maps the tier to
its own model catalog.

- `fast` — haiku-class, flash-class, small local models. Cheap, low latency,
  used for classification and short replies.
- `balanced` — sonnet-class, gpt-4o-mini, mid-size local. The default.
- `powerful` — opus-class, gpt-4o/5, gemini pro. Reserved for planning,
  self-evolution proposals, and reviewer roles.

A request with `modelTier: 'fast'` will skip any provider whose `tiers` array
does not include `fast` (e.g. Ollama-Llama covers only `fast`).

## Configuration

CLIs only need to be installed and logged in — the provider module runs
`which <cli>` once every 5 minutes to detect them. Gemini CLI has an extra
auth probe: it reads `$GEMINI_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`,
`GOOGLE_GENAI_USE_GCA`, or `~/.gemini/settings.json`. Without one of those,
it is marked "found but not authed" and skipped rather than failing every call.

APIs are configured by env vars in `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

Copy `.env.example` to `.env`, fill only the blocks you care about.

## Fallback chain

`callWithFallback(request)` iterates eligible providers in priority order. For
each one it catches the failure and moves on:

1. CLI tier (Claude → Codex → Gemini) — usually free if you already have a
   subscription plugged in.
2. Local tier (Ollama Gemma → Ollama Llama) — free, private, slower.
3. API tier (Anthropic → OpenAI → Google) — reliable paid fallback.

Rate-limit errors (HTTP 429 or `ClaudeRateLimitError`) are treated like any
other failure: log, skip, try the next provider. If every eligible provider
fails, the caller gets an aggregated error listing each failure.

## Limitations

- Discovery is cached for 5 minutes. Installing a new CLI mid-session requires
  a restart or a `refreshProviders()` call.
- Ollama is registered optimistically — its `available` flag says `true` but
  the daemon is only probed at call time, which adds one round-trip of latency
  on first use after boot.
- There is no per-user routing yet: the cascade is process-wide.
