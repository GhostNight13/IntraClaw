<div align="center">

![IntraClaw Banner](assets/banners/github-banner.png)

# IntraClaw

**Open-source autonomous AI agent you actually own.**

*Self-hosted. Multi-provider. Multi-channel. Self-improving.*

[![License: MIT](https://img.shields.io/badge/License-MIT-3DDC84?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-2B7FFF?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-3DDC84?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Beta-orange?style=flat-square)](https://github.com/GhostNight13/IntraClaw)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-3DDC84?style=flat-square)](CONTRIBUTING.md)

</div>

---

## Why IntraClaw

Most "AI agent" products are someone else's SaaS with your data in it. IntraClaw
runs on **your** machine, plugs into **any** LLM you have access to, and speaks
through **any** messaging channel you use. No vendor lock-in, no data leaves
your server, no monthly floor under the pricing.

**Open-source first. Self-host today. Freemium hosted tier maybe later.**

---

## What it does

IntraClaw is a general-purpose autonomous agent. Out of the box it can:

- **Think and act** — multi-step tasks end-to-end with live reasoning traces
- **Remember** — long-term SQLite + vector memory, nightly consolidation
- **Talk through your channels** — Telegram, Discord, Slack, WhatsApp, Matrix, Email
- **Write and run code** — with diff previews and 1-click rollback
- **Self-improve** — benchmarks its own responses, proposes patches to its own code (you approve before apply)
- **Grow new skills** — Voyager-style skill library: successful tactics become reusable skills
- **Run workflows** — visual builder, cron scheduling, webhook triggers
- **Work on mobile** — PWA-installable dashboard

---

## Key features

### Multi-provider LLM routing

IntraClaw auto-discovers what's available on your machine and routes requests
to the best provider for the task:

| Provider       | Cost         | Detection                            |
| -------------- | ------------ | ------------------------------------ |
| Claude CLI     | Max sub flat | `claude` binary on `PATH`            |
| Codex CLI      | Plus sub     | `codex` binary on `PATH`             |
| Gemini CLI     | Free tier    | `gemini` binary on `PATH`            |
| Ollama (local) | Free         | `OLLAMA_HOST` reachable              |
| Anthropic API  | Pay per tok  | `ANTHROPIC_API_KEY` set              |
| OpenAI API     | Pay per tok  | `OPENAI_API_KEY` set                 |
| Google API     | Pay per tok  | `GOOGLE_AI_API_KEY` set              |

Point it at your Claude Max CLI and pay nothing extra. Point it at Ollama and
pay nothing at all.

### Multi-channel

One agent, every surface you actually use:

| Channel   | Module                       |
| --------- | ---------------------------- |
| Telegram  | `src/channels/telegram.ts`   |
| Discord   | `src/channels/discord.ts`    |
| Slack     | `src/channels/slack.ts`      |
| WhatsApp  | `src/channels/whatsapp.ts`   |
| Matrix    | `src/channels/matrix.ts`     |
| Email     | `src/tools/gmail.ts`         |
| Web chat  | `dashboard/`                 |

Enable any channel by filling its env block. Skip the rest.

### Self-improvement (Ouroboros)

A background thread periodically reviews the agent's own logs, benchmarks its
outputs, and drafts patches to its own source files. Patches land as proposals
in the dashboard. You review, approve, apply. The agent restarts cleanly into
its new self. Nothing ships without your click.

### Voyager-style skills

When the agent solves a novel problem, it can distil the solution into a
reusable skill. Skills accumulate in `skills/` and get recalled on similar
future tasks. The more you use it, the better it gets at your specific work.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Channels                           │
│ Telegram · Discord · Slack · Matrix · Email · Web       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  IntraClaw core (src/)                  │
│                                                         │
│   ┌──────────┐   ┌────────────┐   ┌────────────────┐    │
│   │ Executor │◄─►│  Memory    │◄─►│ Self-improve   │    │
│   │ (graph)  │   │ (SQLite +  │   │ (Ouroboros)    │    │
│   │          │   │  Chroma)   │   │                │    │
│   └────┬─────┘   └────────────┘   └────────────────┘    │
│        │                                                │
│   ┌────▼────────────────────────────────────────────┐   │
│   │  LLM router → Claude CLI / Ollama / API / ...   │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   ┌──────────┐   ┌────────────┐   ┌────────────────┐    │
│   │ Skills   │   │ Workflows  │   │ Scheduler      │    │
│   │ library  │   │ engine     │   │ (cron)         │    │
│   └──────────┘   └────────────┘   └────────────────┘    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Dashboard (Next.js 15)                 │
│      Chat · Memory · Graph · Workflows · Admin          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick start

### Try in 30 seconds — no setup

If you have the `claude` CLI logged in, you can talk to IntraClaw from your
terminal right now:

```bash
git clone https://github.com/aymanidamre/intraclaw.git
cd IntraClaw
npm install
npm run chat
```

```
╭──────────────────╮
│  IntraClaw REPL  │
╰──────────────────╯
Providers: Claude CLI, Ollama (Llama)
Tools (5): calculator, datetime, file-ops, shell-exec, web-search

› calculate sqrt(256) + 3*pi
✓ (0.3s)
sqrt(256) = 16, 3π ≈ 9.42 → total ≈ 25.42

› cherche les news sur OpenAI et résume en 3 points
✓ (3.1s)
1. GPT-5 officially launched with ...
2. New reasoning model o4 announced at ...
3. Partnership expansion with Microsoft ...
```

### Full deployment (Telegram / Discord / Slack + dashboard)

```bash
# 1. Configure — every block is optional, fill what you need
cp .env.example .env
$EDITOR .env

# 2. Run the full server
npm run dev                          # API :3001

# 3. Or docker
docker compose up -d
```

**Zero API key required** if you have the Claude CLI logged in. Ollama works
fully offline. API keys are optional fallback.

See [`EXAMPLES.md`](EXAMPLES.md) for 8 concrete prompts + expected responses.

---

## Supported LLM providers

See `.env.example` for the full list. The router tries them in priority order
(cheapest / fastest first) and falls back gracefully if a provider errors out.

## Supported channels

See the table above and `docs/channels.md` for how to add a new channel.

---

## Development

```bash
npm run build          # tsc
npm run lint           # eslint
npm test               # vitest (full suite)
npm run test:smoke     # vitest tests/smoke (security, executor, evolution)
npm run chat           # REPL terminal
npm run setup          # guided wizard (first-time config)
```

### Security

IntraClaw ships with security-first defaults:

- **Shell exec** is allow-list only (`ls`, `cat`, `grep`, `git` read-only, `npm`, `node`, `python`, etc.). `bash -c`, `$()`, pipes to `sh`, `sudo`, destructive `git` subcommands all blocked.
- **File ops** confined to `REPO_ROOT` with 19 protected patterns (`.env*`, `~/.ssh`, `~/.aws`, `*.pem`, `id_rsa`, …).
- **Channel auth**: default-deny on empty whitelist.
- **Human-in-the-loop**: confirmation required before every `terminal` / `file_write` step via `/yes <code>` or `/no <code>`.
- **Logger** redacts Anthropic, OpenAI, GitHub, AWS, Slack, Google, Telegram tokens before write.

Override via env: `CONFIRMATION_ENABLED`, `CONFIRMATION_SKIP`, `SHELL_EXEC_ALLOW_EXTRA`, `FILE_OPS_EXTRA_BLOCKED`. See [`.env.example`](.env.example).

### Tests

29 smoke tests in [`tests/smoke/`](tests/smoke) cover security boundaries, executor routing, tool registry, and evolution gates. CI runs typecheck + smoke tests on every PR ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

Dashboard lives in `dashboard/` and has its own `npm install` + `npm run dev`.

See [`docs/`](docs/) for:
- [`architecture.md`](docs/architecture.md)
- [`llm-providers.md`](docs/llm-providers.md)
- [`self-improvement.md`](docs/self-improvement.md)
- [`channels.md`](docs/channels.md)
- [`skills.md`](docs/skills.md)

---

## Contributing

PRs welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) first and agree
to our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Good first issues are tagged `good-first-issue` on the
[issue tracker](https://github.com/GhostNight13/IntraClaw/issues).

---

## Security

Found something? See [`SECURITY.md`](SECURITY.md) for responsible disclosure.

---

## License

[MIT](LICENSE) — do whatever you want, just keep the notice.

---

<div align="center">

**Own your agent.**

</div>
