# Architecture

IntraClaw is a self-hosted autonomous agent. This document maps the modules that
matter, how a request flows through them, and where the current design still
has rough edges.

## High-level flow

```
┌─────────┐     ┌──────────┐     ┌────────────┐     ┌───────┐     ┌──────────┐
│  User   │ ──▶ │ Channel  │ ──▶ │  Executor  │ ──▶ │ Tool  │ ──▶ │ Response │
└─────────┘     └──────────┘     └─────┬──────┘     └───────┘     └──────────┘
                                       │                                ▲
                                       ▼                                │
                                 ┌───────────┐                          │
                                 │  Memory   │ ─────────────────────────┘
                                 │ (SQLite + │
                                 │  vectors) │
                                 └───────────┘
                                       ▲
                                       │
                                 ┌───────────┐     ┌──────────────┐
                                 │ Evolution │ ◀── │ LLM provider │
                                 │ (engine)  │     │ (cascade)    │
                                 └───────────┘     └──────────────┘
```

A message lands on a channel adapter, the gateway normalizes it, the executor
picks a tool or drafts a reply via an LLM provider, memory is read and written
along the way, and the evolution loop runs asynchronously — it reads the same
source tree and opens self-commits on a dedicated branch.

## Critical modules

- `src/channels/gateway.ts` — fan-in for all channel adapters. Normalizes
  inbound messages to a single shape and routes outbound replies.
- `src/channels/{telegram,discord,slack,whatsapp,matrix,email-channel}.ts` —
  channel adapters. Each one is optional and enabled by its env block.
- `src/executor/universal-executor.ts` — the current default executor. A
  single-pass loop: pick tool, run tool, reply. Simple, works today.
- `src/executor/graph-executor.ts` — a newer StateGraph executor (LangGraph-style)
  intended to supersede the universal one. Not yet wired as default.
- `src/executor/ambiguity-gate.ts` / `evaluation-gate.ts` — pre- and post-flight
  gates that can ask a clarifying question or re-score a draft before sending.
- `src/providers/multi-provider.ts` — provider cascade. Discovers CLIs
  (`claude`, `codex`, `gemini`), Ollama, and API keys, then calls them in
  priority order with graceful fallback on rate-limit or error.
- `src/db.ts` + `memory/` — SQLite for structured state, Markdown files
  (`SOUL.md`, `HEARTBEAT.md`, `USER.md`) for identity, vectors for recall.
- `src/evolution/` — Ouroboros self-improvement (see `self-improvement.md`).
- `dashboard/` — Next.js 15 UI, separate `npm install`, talks to the API over
  HTTP plus a small server-side helper (`dashboard/lib/server-api.ts`).

## StateGraph vs universal-executor (v0.1 → v0.2)

Two executors live side-by-side today. `universal-executor.ts` is the one
actually answering users right now: linear, easy to debug, but it struggles on
multi-step tasks that need backtracking or parallel branches.
`graph-executor.ts` is the target — a StateGraph with explicit nodes for plan,
act, critique, memory-write, and a router that can re-enter earlier nodes. It
compiles and has partial tests, but it is not the default runtime path and
some channels still assume the universal executor's simpler contract.

The v0.2 plan is to flip the default to the graph executor once every channel
adapter has been migrated and the ambiguity/evaluation gates are wired as
graph nodes instead of pre/post hooks. Until then, expect both files to exist
and `universal-executor.ts` to win at startup.

## Known limitations

- No distributed mode — single Node process, SQLite on local disk.
- Vector store is pluggable but defaults to a local SQLite-backed index, not
  Chroma, despite what older diagrams imply.
- Skill retrieval is keyword-first; embedding-based recall is gated behind a
  flag and not enabled by default.
