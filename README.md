# IntraClaw

> **Your personal AI agent platform** — autonomous, self-improving, and built for real business workflows.

IntraClaw is a full-stack AI agent system that runs on your own infrastructure. It connects to your tools, learns your context, and executes complex tasks end-to-end — without sending your data to third-party cloud services.

---

## What it does

IntraClaw is an autonomous AI agent with a full dashboard, long-term memory, and integrations across every channel your business uses. It can:

- **Think and act** — multi-step reasoning with visible Chain-of-Thought, tool selection, and autonomous execution
- **Write and run code** — generate, edit, diff-preview, and sandbox-execute code with full rollback
- **Manage your calendar & email** — Google Calendar, Outlook, Gmail, full CRUD
- **Message anywhere** — Slack, Discord, Telegram, WhatsApp, Matrix
- **Remember everything** — vector memory (ChromaDB), knowledge graph (entity/relationship), REM-cycle nightly synthesis
- **Generate media** — images (FAL.ai), videos (Replicate/LTX), documents (PDF, DOCX, PPTX)
- **Run workflows** — visual drag-and-drop workflow builder with cron scheduling
- **Monitor meetings** — transcript ingestion, AI summaries, action item extraction
- **Secure teams** — 2FA/TOTP, OAuth (Google/GitHub/Microsoft), SAML enterprise SSO, Stripe billing

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Dashboard                   │
│              localhost:3000  (20 pages)              │
└───────────────────┬─────────────────────────────────┘
                    │  REST + SSE
┌───────────────────▼─────────────────────────────────┐
│              Express API Server                      │
│           localhost:3001  (~90 endpoints)            │
├──────────┬──────────┬──────────┬────────────────────┤
│  Agents  │  Memory  │  Tools   │  Auth / Billing    │
│Coordinator│ Vector  │ Calendar │  JWT + 2FA + OAuth │
│ Reasoner │  Graph   │  Email   │  SAML + Stripe     │
│  REM     │  REM DB  │  Code    │  GDPR + Audit      │
└──────────┴──────────┴──────────┴────────────────────┘
                    │
        ┌───────────▼───────────┐
        │     SQLite (WAL)      │
        │  data/intraclaw.db    │
        │   25+ tables          │
        └───────────────────────┘
```

---

## Feature Overview

### AI Core
| Feature | Description |
|---------|-------------|
| **Multi-model routing** | Fast (Haiku) / Smart (Sonnet) / Pro (Opus) tiers |
| **Prompt caching** | Anthropic cache_control breakpoints — 60-80% cost reduction |
| **Chain-of-Thought** | Real-time SSE streaming of agent reasoning steps |
| **Vision / Multimodal** | Analyze images, screenshots, documents via Claude vision |
| **Tool retrieval** | Semantic search over 18-tool catalog via ChromaDB embeddings |
| **A/B prompt testing** | Compare prompt variants, track scores, promote winner |
| **Eval harness** | 5-case default suite with pass/fail scoring and stats |
| **Red team testing** | Adversarial prompts: jailbreak, injection, hallucination checks |

### Memory
| Feature | Description |
|---------|-------------|
| **Vector memory** | ChromaDB semantic search over past tasks and documents |
| **Knowledge graph** | Entity/relationship store with BFS path-finding |
| **REM cycle** | Nightly memory synthesis at 03:00 — consolidates daily context |
| **File snapshots** | Auto-snapshot before every file write, 1-click rollback |

### Integrations
| Channel | Capabilities |
|---------|-------------|
| **Gmail** | Read, search, draft, send |
| **Google Calendar** | List, create, update, delete, free-slot finder |
| **Outlook Calendar** | Full event CRUD via Microsoft Graph API |
| **Slack** | Send messages, listen to events via Bolt |
| **Discord** | Bot with command routing |
| **Telegram** | Bot via grammY |
| **WhatsApp** | Via whatsapp-web.js |
| **Matrix** | Via matrix-js-sdk |
| **Notion** | Read/write pages and databases |

### Agentic Coder
| Feature | Description |
|---------|-------------|
| **File read/write** | Safe file operations with blocklist for system paths |
| **Code sandbox** | Node.js + shell execution with 10s timeout, SIGKILL |
| **Diff preview** | Show unified diff before any write — user confirms |
| **Rollback** | SQLite snapshot history, restore any previous version |

### Automation
| Feature | Description |
|---------|-------------|
| **Visual workflows** | ReactFlow drag-and-drop builder with cron scheduling |
| **Webhooks ingress** | HMAC-SHA256 validated, trigger tasks from external services |
| **OTA updater** | git pull + npm install, version check, self-update |
| **Meeting bot** | Transcript ingestion, AI summary, action items extraction |

### Auth & Security
| Feature | Description |
|---------|-------------|
| **JWT auth** | Stateless, refresh token support |
| **2FA / TOTP** | otplib, QR code setup, backup codes |
| **OAuth** | Google, GitHub, Microsoft — passwordless login |
| **SAML SSO** | Okta, Azure AD, Google Workspace — enterprise tenants |
| **Webhooks** | HMAC-SHA256 signature validation, timing-safe compare |
| **Audit log** | Immutable event trail for all sensitive actions |
| **GDPR** | Data export (ZIP), right-to-erasure, consent tracking |

### Billing
| Plan | Price | Limits |
|------|-------|--------|
| **Free** | €0 | 50 tasks/month, 1 channel |
| **Pro** | €19/mo | Unlimited tasks, all channels, graph memory |
| **Team** | €79/mo | Multi-user, SAML SSO, priority support |

### PWA / Mobile
- Installable as native app (iOS / Android / Desktop)
- Service worker with offline support
- Bottom navigation bar on mobile
- Mobile quick-actions dashboard
- Safe-area inset support for notch devices

---

## Tech Stack

**Backend**
- Runtime: Node.js + TypeScript (strict)
- Framework: Express 5
- DB: SQLite via better-sqlite3 (WAL mode, foreign keys)
- Vector DB: ChromaDB
- AI: Anthropic SDK (`claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4`)
- Auth: JWT + otplib (TOTP) + samlify (SAML) + simple-oauth2
- Payments: Stripe SDK
- Scheduling: node-cron
- Media: Replicate (video), FAL.ai (image)

**Dashboard**
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS v4
- Workflow builder: ReactFlow
- Charts: Recharts
- 3D: Three.js

**Infrastructure**
- Docker + Docker Compose
- Nginx reverse proxy
- PM2 process manager

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (optional but recommended)

### 1. Clone & install
```bash
git clone https://github.com/GhostNight13/IntraClaw.git
cd IntraClaw
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY at minimum
```

### 3. Run setup wizard
```bash
npm run setup
```

### 4. Start
```bash
# Development
npm run dev                      # API on :3001
cd dashboard && npm run dev      # Dashboard on :3000

# Production (Docker)
npm run docker:start
```

---

## Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Google (Calendar + OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=

# Microsoft (Outlook + OAuth)
OUTLOOK_CLIENT_ID=
OUTLOOK_ACCESS_TOKEN=
MICROSOFT_OAUTH_CLIENT_ID=
MICROSOFT_OAUTH_CLIENT_SECRET=

# Messaging
SLACK_BOT_TOKEN=
DISCORD_BOT_TOKEN=
TELEGRAM_BOT_TOKEN=

# Media generation
REPLICATE_API_TOKEN=
FAL_API_KEY=

# Stripe billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_TEAM=

# SAML SSO
SAML_SP_ENTITY_ID=
SAML_SP_ACS_URL=

# App
JWT_SECRET=
DASHBOARD_URL=http://localhost:3000
OAUTH_REDIRECT_BASE=http://localhost:3001
```

---

## API Reference

The API runs on `http://localhost:3001`. All endpoints return JSON.

### Core
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ask` | Send task to AI agent |
| `GET` | `/api/agents` | List configured agents |
| `GET` | `/api/stream/thoughts?taskId=` | SSE — live Chain-of-Thought |
| `GET` | `/api/reasoning/recent` | Recent thought logs |

### Memory
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/memory` | Store a memory |
| `GET` | `/api/memory/search?q=` | Semantic search |
| `GET` | `/api/graph/entities` | List knowledge graph entities |
| `POST` | `/api/graph/entities` | Create entity |
| `GET` | `/api/graph/entities/:id/neighbors` | Get related nodes |
| `POST` | `/api/graph/relationships` | Create relationship |

### Agentic Coder
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/code/execute` | Run code in sandbox |
| `POST` | `/api/code/write` | Write file (with snapshot) |
| `GET` | `/api/code/diff` | Preview diff before write |
| `POST` | `/api/code/rollback` | Restore snapshot |
| `GET` | `/api/code/snapshots` | List file snapshots |

### Calendar & Email
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calendar/events` | List upcoming events |
| `POST` | `/api/calendar/events` | Create event |
| `GET` | `/api/email/inbox` | List inbox messages |
| `POST` | `/api/email/send` | Send email |

### Meetings
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/meetings` | Register meeting URL |
| `GET` | `/api/meetings` | List meetings |
| `POST` | `/api/meetings/:id/transcript` | Upload + summarize |
| `GET` | `/api/meetings/:id/summary` | Get summary + action items |

### Workflows
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workflows` | List workflows |
| `POST` | `/api/workflows` | Create workflow |
| `POST` | `/api/workflows/:id/run` | Trigger workflow |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Login → JWT |
| `POST` | `/auth/register` | Register |
| `POST` | `/auth/2fa/setup` | Generate TOTP QR |
| `POST` | `/auth/2fa/verify` | Enable 2FA |
| `GET` | `/auth/oauth/google` | Google OAuth redirect |
| `GET` | `/auth/saml/login?tenant=` | SAML SSO initiation |
| `GET` | `/auth/saml/metadata` | SP metadata XML |

### Eval & Testing
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/eval/run` | Run eval suite |
| `GET` | `/api/eval/stats` | Pass rates, latency stats |
| `POST` | `/api/experiments` | Create A/B experiment |
| `POST` | `/api/eval/redteam/run` | Run adversarial tests |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/billing/status` | Current plan + usage |
| `POST` | `/api/billing/checkout` | Stripe checkout session |
| `POST` | `/api/billing/portal` | Billing portal |

### Compliance
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/compliance/audit-log` | Export audit trail |
| `POST` | `/api/compliance/export-data/:userId` | GDPR data export |
| `DELETE` | `/api/compliance/delete-data/:userId` | Right to erasure |

---

## Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Overview — agent stats, recent activity |
| Chat | `/chat` | Real-time AI chat with CoT sidebar |
| Agents | `/agents` | Agent management and task dispatch |
| Pipeline | `/pipeline` | Task queue and execution history |
| Workflows | `/workflows` | Visual workflow builder (ReactFlow) |
| Calendar | `/calendar` | Unified calendar view |
| Memory | `/memory` | Vector memory browser and search |
| Graph | `/graph` | Knowledge graph explorer |
| Vision | `/vision` | Image/screenshot analysis |
| Reasoning | `/reasoning` | Live CoT stream viewer |
| Coder | `/coder` | Code editor + sandbox + diff/rollback |
| Meetings | `/meetings` | Meeting tracker + AI summaries |
| Webhooks | `/webhooks` | Webhook management |
| Eval | `/eval` | Eval suite runner and results |
| Experiments | `/experiments` | A/B prompt testing |
| Billing | `/billing` | Subscription and usage |
| Settings | `/settings` | Profile, 2FA, OAuth, updates |
| Mobile | `/mobile` | Mobile quick-actions dashboard |
| REM | `/rem` | Memory synthesis history |
| Marketplace | `/marketplace` | Plugin marketplace |

---

## Project Stats

| Metric | Value |
|--------|-------|
| Backend source files | 164 TypeScript files |
| Dashboard pages | 20 pages |
| API endpoints | ~90 endpoints |
| DB tables | 25+ SQLite tables |
| Integrations | 10+ channels |
| TypeScript errors | 0 |
| Lines of code | ~20,000+ |

---

## Logo & Branding

Drop your logo files into `dashboard/public/` to complete the PWA install experience:
- `icon-192.png` — 192×192px (home screen icon)
- `icon-512.png` — 512×512px (splash screen / install)

---

## License

Private — All rights reserved.  
Built by [Ayman Idamre](https://github.com/GhostNight13).
