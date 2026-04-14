# 🌐 IntraClaw — Plan de Domination Mondiale
### Version 2.0 · Transforme IntraClaw en produit commercial qui détrône OpenClaw, AutoGPT, CrewAI, Devin et tous les autres
### Date : 14 Avril 2026 · Auteur : Ayman Idamre

---

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║   INTRACLAW 2.0 — VISION                                                        ║
║                                                                                  ║
║   "Un agent IA qui tourne sur n'importe quel ordi dans le monde,                ║
║    se connecte à tout, comprend tout, fait tout — pour tout le monde."          ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 📊 MINDMAP GLOBAL — VUE D'ENSEMBLE

```
                              ┌─────────────────────┐
                              │   INTRACLAW 2.0      │
                              │   (Produit mondial)  │
                              └──────────┬──────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
   ┌──────▼──────┐               ┌──────▼──────┐               ┌──────▼──────┐
   │  CHANNELS   │               │    CORE     │               │  PLATFORM   │
   │  (Canaux)   │               │  (Cerveau)  │               │  (Produit)  │
   └──────┬──────┘               └──────┬──────┘               └──────┬──────┘
          │                             │                              │
   ┌──────┴──────────┐          ┌───────┴───────────┐        ┌────────┴────────┐
   │ A. Multi-msg    │          │ G. Workflows       │        │ E. Multi-user   │
   │   WhatsApp      │          │    Orchestrator    │        │   + Auth JWT    │
   │   Discord       │          │ K. Memory Dream    │        │ F. Marketplace  │
   │   Slack         │          │    (REM cycle)     │        │   des skills    │
   │   Signal        │          │ J. Génération      │        │ B. Docker       │
   │   iMessage      │          │    Médias          │        │   + Onboarding  │
   │   Matrix        │          └───────────────────┘        └─────────────────┘
   └─────────────────┘
          │                   ┌──────────────────────────────────────────┐
          │                   │  INTÉGRATIONS                            │
          │                   │  C. Google Calendar + Outlook            │
          │                   │  D. Email full inbox management          │
          │                   │  I. Smart Home (Home Assistant)          │
          │                   └──────────────────────────────────────────┘
          │
   ┌──────┴───────────────────────────────────────────────────┐
   │  DEVELOPER ECOSYSTEM                                      │
   │  H. Localization (10 langues)  L. Plugin SDK             │
   └──────────────────────────────────────────────────────────┘
```

---

## 🗓️ ROADMAP TEMPORELLE

```
SEMAINE  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16
         ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼
PHASE A  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Multi-messaging
PHASE B  ░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Docker + Setup
PHASE C  ░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Calendar
PHASE D  ░░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  Email Full
PHASE E  ░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░  Multi-user
PHASE F  ░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░  Marketplace
PHASE G  ░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░░░░  Workflows
PHASE H  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░  Localization
PHASE I  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░  Smart Home
PHASE J  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░  Médias
PHASE K  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░░  REM Dream
PHASE L  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  Plugin SDK

         ◄──── MVP testable S4 ────►◄──── Bêta publique S10 ────►◄── V2 S16 ►
```

---

## 📦 STACK TECHNIQUE AJOUTÉE

```
┌─────────────────────────────────────────────────────────────────┐
│                    STACK ACTUELLE (11K LOC)                     │
│  TypeScript · Claude API · SQLite · ChromaDB · Telegram         │
│  Gmail · Notion · Playwright · pptxgenjs · pdf-lib              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ + (nouvelles couches)
┌──────────────────────────▼──────────────────────────────────────┐
│                    NOUVELLES DÉPENDANCES                        │
│                                                                 │
│  Canaux      : whatsapp-web.js, discord.js, @slack/bolt         │
│                matrix-js-sdk, node-signald, imessage-bridge     │
│                                                                 │
│  Auth        : jsonwebtoken, bcryptjs, passport.js              │
│  Multi-user  : Prisma ORM → PostgreSQL (remplace SQLite)        │
│                                                                 │
│  Workflows   : reactflow (frontend), bull (queue), ioredis       │
│                                                                 │
│  Calendar    : googleapis, @microsoft/microsoft-graph-client    │
│                                                                 │
│  Médias      : fal-ai (images), replicate (vidéo)              │
│               @xenova/transformers (local audio)                │
│                                                                 │
│  i18n        : i18next, i18next-fs-backend                      │
│                                                                 │
│  Smart Home  : home-assistant-js-websocket                      │
│                                                                 │
│  Docker      : Docker SDK, dockerode                            │
│                                                                 │
│  Plugin SDK  : tsx, zod, semver                                 │
│                                                                 │
│  Dev tools   : vitest, supertest, @faker-js/faker               │
└─────────────────────────────────────────────────────────────────┘
```

---

# ═══════════════════════════════════════════════════════
# PHASE A — MULTI-MESSAGING GATEWAY
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Rendre IntraClaw accessible depuis WhatsApp, Discord, Slack, Signal, iMessage, Matrix — en plus de Telegram existant.

## 🧠 Mindmap Phase A

```
                    ┌─────────────────────┐
                    │  MESSAGING GATEWAY  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐     ┌──────▼──────┐
   │  ADAPTERS   │     │  NORMALIZER  │     │  DISPATCHER │
   │  (par app)  │     │  (format     │     │  (route vers │
   └──────┬──────┘     │  unifié)     │     │  le core)   │
          │            └─────────────┘     └─────────────┘
   ┌──────┴──────────────────────────────────────────┐
   │ WhatsApp   Discord   Slack   Signal   Matrix    │
   │ (QR scan)  (token)  (app)   (nr tel)  (matrix) │
   │            Telegram (déjà fait)                 │
   └─────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
src/channels/
├── telegram.ts          ✅ EXISTANT
├── gateway.ts           🆕 Router central (normalise toutes les sources)
├── adapters/
│   ├── whatsapp.ts      🆕 whatsapp-web.js + QR code + sessions
│   ├── discord.ts       🆕 discord.js bot
│   ├── slack.ts         🆕 @slack/bolt
│   ├── signal.ts        🆕 via signal-cli subprocess
│   ├── imessage.ts      🆕 AppleScript bridge (macOS only)
│   └── matrix.ts        🆕 matrix-js-sdk
├── types.ts             🆕 UniversalMessage, ChannelAdapter interface
└── session-store.ts     🆕 SQLite sessions par canal
```

## 🔧 Implémentation étape par étape

### Étape A.1 — Interface universelle (30 min)

```typescript
// src/channels/types.ts
export interface UniversalMessage {
  id:        string;
  channelId: string;          // 'whatsapp' | 'discord' | 'slack' | ...
  senderId:  string;          // identifiant unique de l'expéditeur
  senderName: string;
  content:   string;
  timestamp: Date;
  replyTo?:  string;          // message ID original si réponse
  media?:    { type: 'image'|'audio'|'video'|'file', url: string }[];
}

export interface ChannelAdapter {
  channelId: string;
  init():    Promise<void>;
  send(recipientId: string, text: string): Promise<void>;
  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void;
  isReady(): boolean;
}
```

### Étape A.2 — Gateway central (45 min)

```typescript
// src/channels/gateway.ts
import { UniversalMessage, ChannelAdapter } from './types';
import { runTask } from '../agents/coordinator';

const adapters = new Map<string, ChannelAdapter>();

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channelId, adapter);
  adapter.onMessage(handleIncoming);
  adapter.init().catch(err => logger.warn('Gateway', `${adapter.channelId} init failed`, err));
}

async function handleIncoming(msg: UniversalMessage): Promise<void> {
  // Authentification : vérifier si sender autorisé
  const authorized = await isAuthorized(msg.senderId, msg.channelId);
  if (!authorized) { await replyTo(msg, "❌ Non autorisé."); return; }

  // Enrichir avec historique conversationnel
  const history = await getConversationHistory(msg.senderId, 10);

  // Router vers Universal Executor
  const result = await executeUniversalTask(msg.content, history);
  await replyTo(msg, result.summary);
}

export async function replyTo(msg: UniversalMessage, text: string): Promise<void> {
  const adapter = adapters.get(msg.channelId);
  if (adapter) await adapter.send(msg.senderId, text);
}
```

### Étape A.3 — Adapter WhatsApp (1h)

```typescript
// src/channels/adapters/whatsapp.ts
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

export class WhatsAppAdapter implements ChannelAdapter {
  channelId = 'whatsapp';
  private client: Client;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private ready = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: 'data/whatsapp-session' }),
      puppeteer: { headless: true, args: ['--no-sandbox'] }
    });

    this.client.on('qr', qr => {
      console.log('\n📱 Scanne ce QR code avec WhatsApp :');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.ready = true;
      logger.info('WhatsApp', '✅ Connecté');
    });

    this.client.on('message', async (msg: Message) => {
      if (this.messageHandler) {
        const contact = await msg.getContact();
        await this.messageHandler({
          id:          msg.id._serialized,
          channelId:   'whatsapp',
          senderId:    msg.from,
          senderName:  contact.pushname || msg.from,
          content:     msg.body,
          timestamp:   new Date(msg.timestamp * 1000),
        });
      }
    });
  }

  async init() { await this.client.initialize(); }
  async send(recipientId: string, text: string) {
    await this.client.sendMessage(recipientId, text);
  }
  onMessage(handler: (msg: UniversalMessage) => Promise<void>) {
    this.messageHandler = handler;
  }
  isReady() { return this.ready; }
}
```

### Étape A.4 — Adapter Discord (45 min)

```typescript
// src/channels/adapters/discord.ts
import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';

export class DiscordAdapter implements ChannelAdapter {
  channelId = 'discord';
  private client = new DiscordClient({
    intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent]
  });

  async init() {
    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot) return;
      // Seulement les DMs ou mentions directes
      if (!msg.mentions.has(this.client.user!) && !msg.channel.isDMBased()) return;
      await this.messageHandler?.({
        id: msg.id, channelId: 'discord',
        senderId: msg.author.id, senderName: msg.author.username,
        content: msg.cleanContent, timestamp: msg.createdAt,
      });
    });
    await this.client.login(process.env.DISCORD_TOKEN);
  }

  async send(recipientId: string, text: string) {
    const user = await this.client.users.fetch(recipientId);
    await user.send(text.slice(0, 2000)); // Discord limit
  }
  // ... reste identique
}
```

### Étape A.5 — Adapter Slack (45 min)

```typescript
// src/channels/adapters/slack.ts
import { App as SlackApp } from '@slack/bolt';

export class SlackAdapter implements ChannelAdapter {
  channelId = 'slack';
  private app = new SlackApp({
    token:        process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode:   true,
    appToken:     process.env.SLACK_APP_TOKEN,
  });

  async init() {
    this.app.message(async ({ message, say }) => {
      if (message.subtype) return;
      await this.messageHandler?.({
        id: message.ts, channelId: 'slack',
        senderId: (message as any).user, senderName: (message as any).user,
        content: (message as any).text, timestamp: new Date(),
      });
    });
    await this.app.start(3001);
  }

  async send(recipientId: string, text: string) {
    await this.app.client.chat.postMessage({ channel: recipientId, text });
  }
}
```

## 📦 Dépendances à installer

```bash
npm install whatsapp-web.js qrcode-terminal
npm install discord.js
npm install @slack/bolt
npm install matrix-js-sdk
```

## ✅ Critères de succès Phase A

```
□ WhatsApp répond à "bonjour" dans les 3 secondes
□ Discord mentionne @IntraClaw et reçoit une réponse
□ Slack msg dans #intraclaw-bot → réponse IA
□ Tous les canaux logs dans SQLite (table: messages)
□ Test : envoyer "génère un PPT sur le SEO" depuis WhatsApp → fichier reçu
```

---

# ═══════════════════════════════════════════════════════
# PHASE B — DOCKER + ONBOARDING WIZARD
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Quelqu'un sans aucune connaissance technique installe et lance IntraClaw en 5 minutes max.

## 🧠 Mindmap Phase B

```
                    ┌─────────────────────────┐
                    │   ONBOARDING WIZARD     │
                    │   "Hello → Ready in 5"  │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐     ┌──────▼──────┐
   │   DOCKER    │     │  SETUP CLI   │     │  WEB WIZARD │
   │ Dockerfile  │     │  (terminal   │     │  (browser   │
   │ compose.yml │     │   guided)    │     │   guided)   │
   └─────────────┘     └─────────────┘     └─────────────┘
          │
   ┌──────┴──────────────────────────────────────────────┐
   │  Services Docker :                                   │
   │   - intraclaw-core (Node.js)                        │
   │   - intraclaw-db (PostgreSQL)                       │
   │   - intraclaw-cache (Redis)                         │
   │   - intraclaw-chroma (ChromaDB)                     │
   │   - intraclaw-dashboard (Next.js)                   │
   └─────────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
/                          (racine du projet)
├── Dockerfile             🆕 Image production Node.js 20-alpine
├── Dockerfile.dev         🆕 Image dev avec hot-reload
├── docker-compose.yml     🆕 Stack complète 5 services
├── docker-compose.dev.yml 🆕 Override dev
├── .dockerignore          🆕
├── setup/
│   ├── wizard.ts          🆕 CLI wizard interactif (inquirer)
│   ├── health-check.ts    🆕 Vérifie tous les services
│   ├── env-generator.ts   🆕 Génère .env depuis les réponses wizard
│   └── first-run.ts       🆕 Logique "first boot" détection
└── scripts/
    ├── install.sh         🆕 curl | bash → clone + docker compose up
    └── update.sh          🆕 git pull + docker compose pull + restart
```

## 🔧 Implémentation étape par étape

### Étape B.1 — Dockerfile production

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S intraclaw && adduser -S intraclaw -G intraclaw
COPY --from=builder --chown=intraclaw:intraclaw /app/dist ./dist
COPY --from=builder --chown=intraclaw:intraclaw /app/node_modules ./node_modules
COPY --from=builder --chown=intraclaw:intraclaw /app/skills ./skills
COPY --from=builder --chown=intraclaw:intraclaw /app/memory ./memory
USER intraclaw
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

### Étape B.2 — docker-compose.yml

```yaml
# docker-compose.yml
version: '3.9'

services:
  core:
    build: .
    container_name: intraclaw-core
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./memory:/app/memory
      - ./skills:/app/skills
      - ./logs:/app/logs
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks: [intraclaw]

  db:
    image: postgres:16-alpine
    container_name: intraclaw-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: intraclaw
      POSTGRES_USER: intraclaw
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U intraclaw"]
      interval: 10s
      retries: 5
    networks: [intraclaw]

  cache:
    image: redis:7-alpine
    container_name: intraclaw-cache
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
    networks: [intraclaw]

  chroma:
    image: chromadb/chroma:latest
    container_name: intraclaw-chroma
    restart: unless-stopped
    volumes:
      - chroma_data:/chroma/chroma
    networks: [intraclaw]

  dashboard:
    build: ./dashboard
    container_name: intraclaw-dashboard
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://core:3000
    depends_on: [core]
    networks: [intraclaw]

volumes:
  postgres_data:
  chroma_data:

networks:
  intraclaw:
    driver: bridge
```

### Étape B.3 — Setup Wizard CLI (45 min)

```typescript
// setup/wizard.ts
import inquirer from 'inquirer';
import { generateEnv } from './env-generator';
import { runHealthCheck } from './health-check';

const STEPS = [
  { type: 'password', name: 'ANTHROPIC_API_KEY',   message: '🔑 Clé API Anthropic :' },
  { type: 'input',   name: 'TELEGRAM_BOT_TOKEN',   message: '🤖 Token Telegram (optionnel) :' },
  { type: 'confirm', name: 'ENABLE_WHATSAPP',       message: '📱 Activer WhatsApp ?' },
  { type: 'confirm', name: 'ENABLE_DISCORD',        message: '💬 Activer Discord ?' },
  { type: 'input',   name: 'DISCORD_TOKEN',
    message: '🎮 Token Discord :',
    when: (a: any) => a.ENABLE_DISCORD },
  { type: 'confirm', name: 'ENABLE_GMAIL',          message: '📧 Connecter Gmail ?' },
  { type: 'confirm', name: 'ENABLE_NOTION',         message: '📓 Connecter Notion ?' },
  { type: 'confirm', name: 'ENABLE_CALENDAR',       message: '📅 Connecter Google Calendar ?' },
];

export async function runWizard(): Promise<void> {
  console.log('\n🐾 Bienvenue dans IntraClaw Setup Wizard\n');
  console.log('─'.repeat(50));

  const answers = await inquirer.prompt(STEPS as any);
  await generateEnv(answers);

  console.log('\n✅ Configuration générée !');
  console.log('🚀 Démarrage des services...\n');

  const healthy = await runHealthCheck();
  if (healthy) {
    console.log('\n🎉 IntraClaw est prêt ! Dashboard : http://localhost:3001\n');
  }
}
```

### Étape B.4 — Script d'installation universel (20 min)

```bash
#!/bin/bash
# scripts/install.sh — Installable via : curl -fsSL https://get.intraclaw.ai | bash

set -e
echo "🐾 IntraClaw Installer v2.0"

# Vérifications
command -v docker >/dev/null 2>&1 || { echo "❌ Docker requis. https://docker.com"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || { echo "❌ Docker Compose requis"; exit 1; }

# Clone
git clone https://github.com/ayman/intraclaw.git ~/.intraclaw 2>/dev/null || true
cd ~/.intraclaw

# Wizard
if [ ! -f .env ]; then
  node dist/setup/wizard.js
fi

# Démarrage
docker compose up -d
echo "✅ IntraClaw démarré sur http://localhost:3001"
```

## ✅ Critères de succès Phase B

```
□ docker compose up → tous les services healthy en < 60s
□ curl -fsSL https://get.intraclaw.ai | bash → wizard en 5 min
□ Premier démarrage → wizard automatique si pas de .env
□ Health endpoint GET /health → 200 OK avec status de chaque service
□ Test : machine vierge Windows + Docker Desktop → IntraClaw opérationnel
```

---

# ═══════════════════════════════════════════════════════
# PHASE C — GOOGLE CALENDAR + OUTLOOK INTEGRATION
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
IntraClaw connaît ton agenda, rappelle les RDV, propose des créneaux, crée des événements.

## 📁 Architecture fichiers

```
src/tools/
├── calendar/
│   ├── index.ts           🆕 Export unifié (Google + Outlook)
│   ├── google-calendar.ts 🆕 googleapis wrapper
│   ├── outlook-calendar.ts 🆕 @microsoft/microsoft-graph-client
│   └── calendar-types.ts  🆕 UniversalEvent interface
src/skills/
└── calendar-agent.yaml    🆕 Skill pour gérer l'agenda via NL
```

## 🔧 Implémentation

### Interface universelle

```typescript
// src/tools/calendar/calendar-types.ts
export interface UniversalEvent {
  id:          string;
  title:       string;
  description?: string;
  startAt:     Date;
  endAt:       Date;
  location?:   string;
  attendees?:  { email: string; name?: string }[];
  source:      'google' | 'outlook';
}

export interface CalendarProvider {
  listEvents(from: Date, to: Date): Promise<UniversalEvent[]>;
  createEvent(event: Omit<UniversalEvent, 'id' | 'source'>): Promise<UniversalEvent>;
  deleteEvent(id: string): Promise<void>;
  findFreeSlots(duration: number, from: Date, to: Date): Promise<Date[]>;
}
```

### Google Calendar

```typescript
// src/tools/calendar/google-calendar.ts
import { google } from 'googleapis';

export class GoogleCalendarProvider implements CalendarProvider {
  private calendar;

  constructor() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async listEvents(from: Date, to: Date): Promise<UniversalEvent[]> {
    const res = await this.calendar.events.list({
      calendarId:   'primary',
      timeMin:      from.toISOString(),
      timeMax:      to.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
    });

    return (res.data.items ?? []).map(e => ({
      id:          e.id!,
      title:       e.summary ?? '(Sans titre)',
      description: e.description ?? undefined,
      startAt:     new Date(e.start?.dateTime ?? e.start?.date!),
      endAt:       new Date(e.end?.dateTime ?? e.end?.date!),
      location:    e.location ?? undefined,
      attendees:   e.attendees?.map(a => ({ email: a.email!, name: a.displayName })),
      source:      'google',
    }));
  }

  async createEvent(event: Omit<UniversalEvent, 'id'|'source'>): Promise<UniversalEvent> {
    const res = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary:     event.title,
        description: event.description,
        start: { dateTime: event.startAt.toISOString() },
        end:   { dateTime: event.endAt.toISOString() },
        location: event.location,
        attendees: event.attendees?.map(a => ({ email: a.email, displayName: a.name })),
      },
    });
    return { ...event, id: res.data.id!, source: 'google' };
  }

  async findFreeSlots(durationMin: number, from: Date, to: Date): Promise<Date[]> {
    const events = await this.listEvents(from, to);
    const slots: Date[] = [];
    let cursor = new Date(from);
    cursor.setHours(9, 0, 0, 0); // Commence à 9h

    while (cursor < to) {
      const slotEnd = new Date(cursor.getTime() + durationMin * 60000);
      const conflict = events.find(e => e.startAt < slotEnd && e.endAt > cursor);
      if (!conflict && cursor.getHours() < 18) slots.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + 30 * 60000); // Avance par 30min
    }
    return slots.slice(0, 5); // Top 5 créneaux
  }

  async deleteEvent(id: string): Promise<void> {
    await this.calendar.events.delete({ calendarId: 'primary', eventId: id });
  }
}
```

### Skill YAML

```yaml
# skills/calendar-agent.yaml
id: calendar-agent
name: Gestionnaire de Calendrier
version: 1.0.0
description: Gère ton agenda Google Calendar et Outlook
triggers:
  - "réunion"
  - "rendez-vous"
  - "agenda"
  - "disponible"
  - "créneau"
  - "planifie"
  - "schedule"
  - "meeting"
steps:
  - action: "parse_intent"
    description: "Détermine si c'est une lecture, création ou recherche de créneau"
  - action: "call_calendar"
    description: "Appelle l'outil approprié"
  - action: "respond"
    description: "Réponse naturelle en français"
examples:
  - "Qu'est-ce que j'ai demain ?"
  - "Crée un RDV client vendredi à 14h"
  - "Trouve un créneau libre de 1h cette semaine"
  - "Annule le meeting de mercredi"
```

## ✅ Critères de succès Phase C

```
□ "Qu'est-ce que j'ai demain ?" → liste des événements
□ "Crée un RDV avec Marie vendredi 15h" → événement créé + confirmation
□ "Trouve-moi un créneau libre de 1h" → 3 options proposées
□ Synchro Outlook si token présent (graceful degradation sinon)
```

---

# ═══════════════════════════════════════════════════════
# PHASE D — FULL EMAIL INBOX MANAGEMENT
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
IntraClaw gère entièrement la boîte mail : trie, labélise, résume, répond, classe les priorités.

## 🧠 Mindmap Phase D

```
                    ┌─────────────────────────┐
                    │   EMAIL FULL MANAGER    │
                    └──────────┬──────────────┘
                               │
     ┌─────────────────────────┼─────────────────────────┐
     │                         │                         │
┌────▼────┐              ┌─────▼─────┐             ┌─────▼─────┐
│  TRIAGE │              │  ACTIONS  │             │  DIGEST   │
│ Scoring │              │ Auto-reply│             │ Résumé    │
│ Labels  │              │ Forward   │             │ quotidien │
│ Priority│              │ Archive   │             │ Telegram  │
└─────────┘              └───────────┘             └───────────┘
     │
┌────┴──────────────────────────────────────────────────┐
│  Catégories : URGENT · CLIENT · PROSPECT · SPAM       │
│              NEWSLETTER · FACTURE · INTERNE           │
└───────────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
src/tools/
├── gmail.ts               ✅ EXISTANT (getUnreadEmails, markAsRead)
└── email-manager/
    ├── index.ts           🆕 Export principal
    ├── triage.ts          🆕 Scoring + catégorisation IA
    ├── auto-responder.ts  🆕 Rédige des réponses automatiques
    ├── digest.ts          🆕 Résumé quotidien email
    ├── rules-engine.ts    🆕 Règles (si expéditeur X → label Y)
    └── unsubscribe.ts     🆕 Désabonnement newsletters
```

## 🔧 Implémentation

### Triage IA

```typescript
// src/tools/email-manager/triage.ts
export type EmailCategory =
  | 'URGENT' | 'CLIENT' | 'PROSPECT' | 'PARTNER'
  | 'NEWSLETTER' | 'INVOICE' | 'SPAM' | 'INTERNAL' | 'OTHER';

export interface TriageResult {
  category:    EmailCategory;
  priority:    1 | 2 | 3 | 4 | 5;  // 1 = critique, 5 = ignorable
  suggestedAction: 'reply_now' | 'reply_later' | 'archive' | 'delete' | 'unsubscribe';
  summary:     string;  // 1 phrase max
  draftReply?: string;  // si suggestedAction = reply_*
}

export async function triageEmail(email: {
  from: string; subject: string; body: string; date: string;
}): Promise<TriageResult> {
  const prompt = `
Tu es un assistant de gestion d'emails pour un développeur web indépendant (Ayman, agence web Bruxelles).

EMAIL :
De : ${email.from}
Sujet : ${email.subject}
Corps : ${email.body.slice(0, 1000)}

RÈGLES DE CATÉGORISATION :
- URGENT : délai court, action requise aujourd'hui
- CLIENT : client existant
- PROSPECT : potentiel nouveau client
- INVOICE : facture, paiement
- NEWSLETTER : email marketing (→ unsubscribe si jamais ouvert)
- SPAM : indésirable
- OTHER : reste

Réponds en JSON :
{
  "category": "URGENT|CLIENT|PROSPECT|NEWSLETTER|INVOICE|SPAM|OTHER",
  "priority": 1-5,
  "suggestedAction": "reply_now|reply_later|archive|delete|unsubscribe",
  "summary": "1 phrase",
  "draftReply": "null ou brouillon de réponse"
}
`.trim();

  const response = await ask({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 400, temperature: 0.3,
    task: AgentTask.MAINTENANCE, modelTier: 'fast',
  });

  return JSON.parse(response.content.match(/\{[\s\S]*\}/)![0]);
}
```

### Digest quotidien

```typescript
// src/tools/email-manager/digest.ts
export async function generateEmailDigest(): Promise<string> {
  const emails = await getUnreadEmails(50);

  const triaged = await Promise.all(
    emails.map(async e => ({
      email: e,
      triage: await triageEmail(e),
    }))
  );

  const urgent    = triaged.filter(t => t.triage.priority === 1);
  const clients   = triaged.filter(t => t.triage.category === 'CLIENT');
  const prospects = triaged.filter(t => t.triage.category === 'PROSPECT');

  return `
📧 **DIGEST EMAIL — ${new Date().toLocaleDateString('fr-BE')}**

🔴 **URGENT (${urgent.length})**
${urgent.map(t => `• ${t.email.from}: ${t.triage.summary}`).join('\n') || '  _(aucun)_'}

👤 **CLIENTS (${clients.length})**
${clients.map(t => `• ${t.email.from}: ${t.triage.summary}`).join('\n') || '  _(aucun)_'}

🎯 **PROSPECTS (${prospects.length})**
${prospects.map(t => `• ${t.email.from}: ${t.triage.summary}`).join('\n') || '  _(aucun)_'}

📊 **Total non lus : ${emails.length}**
  `.trim();
}
```

## ✅ Critères de succès Phase D

```
□ Email entrant → trié automatiquement en < 10 secondes
□ "Résume mes emails d'aujourd'hui" → digest Telegram
□ Newsletter détectée → lien de désabonnement proposé
□ Auto-reply pour emails hors bureau (configurable ON/OFF)
□ Règle custom : "Si sujet contient 'devis' → PROSPECT + reply avec template"
```

---

# ═══════════════════════════════════════════════════════
# PHASE E — MULTI-USER + AUTHENTIFICATION JWT
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
IntraClaw devient un produit SaaS : chaque utilisateur a ses propres données, configurations et historique. Prérequis pour toutes les phases commerciales.

## 🧠 Architecture Multi-tenant

```
┌─────────────────────────────────────────────────────────────┐
│                    USERS TABLE (PostgreSQL)                  │
│                                                             │
│  id │ email │ name │ role │ plan │ created_at │ api_key     │
│─────┼───────┼──────┼──────┼──────┼────────────┼────────────│
│  1  │ ayman │ ...  │admin │ pro  │ 2026-01    │ ic_...     │
│  2  │ bob   │ ...  │user  │ free │ 2026-02    │ ic_...     │
└─────────────────────────────────────────────────────────────┘
         │
         │ Chaque user a ses propres tables isolées (tenant_id)
         ▼
┌──────────────────────────────────────────────────────────────┐
│  goals           (tenant_id → user_id)                       │
│  actions         (tenant_id → user_id)                       │
│  skills          (tenant_id → user_id, ou global si shared)  │
│  messages        (tenant_id → user_id)                       │
│  business_memory (tenant_id → user_id)                       │
└──────────────────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
src/
├── auth/
│   ├── jwt.ts             🆕 sign, verify, refresh
│   ├── middleware.ts      🆕 Express middleware authenticate()
│   ├── strategies/
│   │   ├── email-pass.ts  🆕 Email + mot de passe
│   │   ├── google-oauth.ts 🆕 Google SSO
│   │   └── api-key.ts     🆕 ic_xxxx pour les API clients
│   └── routes.ts          🆕 POST /auth/register, /auth/login, /auth/refresh
├── users/
│   ├── user.model.ts      🆕 Prisma schema User
│   ├── user.service.ts    🆕 CRUD users
│   └── user.routes.ts     🆕 GET/PATCH /users/me
└── prisma/
    └── schema.prisma      🆕 Modèle complet
```

### Prisma Schema

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  password   String?
  googleId   String?  @unique
  apiKey     String   @unique @default(cuid())
  role       Role     @default(USER)
  plan       Plan     @default(FREE)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  goals    Goal[]
  messages Message[]
  skills   UserSkill[]

  @@map("users")
}

enum Role  { ADMIN USER }
enum Plan  { FREE PRO ENTERPRISE }

model Goal {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?
  priority    String
  status      String   @default("active")
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("goals")
}

model Message {
  id        String   @id @default(cuid())
  userId    String
  channel   String
  role      String   // 'user' | 'assistant'
  content   String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("messages")
}
```

### Auth Middleware

```typescript
// src/auth/middleware.ts
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { Request, Response, NextFunction } from 'express';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });

  try {
    // Support Bearer token ET ic_xxx API key
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      req.user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });
    } else if (header.startsWith('ic_')) {
      req.user = await prisma.user.findUniqueOrThrow({ where: { apiKey: header } });
    } else {
      return res.status(401).json({ error: 'Format invalide' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}
```

## ✅ Critères de succès Phase E

```
□ POST /auth/register → crée compte + JWT retourné
□ POST /auth/login → JWT valide 7 jours
□ GET /users/me → infos du compte
□ Chaque endpoint API nécessite authenticate() middleware
□ Plan FREE → limité à 50 actions/jour
□ Plan PRO → illimité + accès marketplace
□ Test isolation : user A ne voit pas les goals de user B
```

---

# ═══════════════════════════════════════════════════════
# PHASE F — SKILL MARKETPLACE
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Les utilisateurs peuvent publier, télécharger et noter des skills. Comme un npm mais pour les capacités d'IntraClaw.

## 🧠 Mindmap Marketplace

```
                    ┌─────────────────────────┐
                    │   SKILL MARKETPLACE     │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐     ┌──────▼──────┐
   │  REGISTRY   │     │   PUBLISH    │     │  INSTALL    │
   │  (catalogue │     │  (upload +   │     │  (download  │
   │  public)    │     │  validation) │     │  + activate)│
   └─────────────┘     └─────────────┘     └─────────────┘
          │
   ┌──────┴──────────────────────────────────────────────┐
   │  Pour chaque skill :                                 │
   │  - Nom, description, version, auteur               │
   │  - Tags (prospection, email, calendrier, etc.)      │
   │  - Note (1-5 étoiles) + nombre d'utilisateurs      │
   │  - Validation automatique (zod schema check)        │
   │  - Sandboxing (exec dans un contexte isolé)         │
   └─────────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
src/marketplace/
├── registry.ts         🆕 Liste + recherche skills publics
├── publisher.ts        🆕 Validation + upload
├── installer.ts        🆕 Download + activation locale
├── validator.ts        🆕 Zod schema validation d'un skill YAML
└── routes.ts           🆕 API endpoints marketplace

prisma/schema.prisma   🆕 + model MarketplaceSkill, SkillRating
```

### Modèle Prisma (ajout)

```prisma
model MarketplaceSkill {
  id          String   @id @default(cuid())
  authorId    String
  name        String
  slug        String   @unique  // ex: "prospection-b2b-fr"
  description String
  version     String
  content     String   // YAML complet
  tags        String[] // JSON array
  downloads   Int      @default(0)
  avgRating   Float    @default(0)
  published   Boolean  @default(false)
  createdAt   DateTime @default(now())

  ratings SkillRating[]
  author  User @relation(fields: [authorId], references: [id])

  @@map("marketplace_skills")
}

model SkillRating {
  id      String @id @default(cuid())
  skillId String
  userId  String
  score   Int    // 1-5
  comment String?
  skill   MarketplaceSkill @relation(fields: [skillId], references: [id])
  @@unique([skillId, userId])
  @@map("skill_ratings")
}
```

### Endpoints API

```
GET    /api/marketplace/skills              → liste (filtrable par tags, tri par rating)
GET    /api/marketplace/skills/:slug        → détail
POST   /api/marketplace/skills             → publish (auth + validation)
POST   /api/marketplace/skills/:slug/rate  → noter (1-5)
POST   /api/marketplace/skills/:slug/install → installer localement
GET    /api/marketplace/my-skills          → skills publiés par moi
```

## ✅ Critères de succès Phase F

```
□ POST /marketplace/skills avec un YAML valide → skill publié
□ YAML invalide → erreur descriptive (validation zod)
□ GET /marketplace/skills → liste triée par rating
□ POST /marketplace/skills/:slug/install → copié dans skills/ local + hot-reload
□ Test : publier "linkedin-scraper.yaml", l'installer sur une autre instance
```

---

# ═══════════════════════════════════════════════════════
# PHASE G — WORKFLOW ORCHESTRATOR (VISUAL)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Créer des workflows multi-étapes avec conditions, branchements et boucles — comme n8n ou Zapier mais pour IntraClaw.

## 🧠 Mindmap Workflow Engine

```
         ┌──────────────────────────────────────────────────────┐
         │                  WORKFLOW ENGINE                      │
         └──────────────────────┬───────────────────────────────┘
                                │
         ┌──────────────────────┼────────────────────────────────┐
         │                      │                                │
  ┌──────▼──────┐        ┌──────▼──────┐                ┌───────▼──────┐
  │   BUILDER   │        │   RUNNER    │                │   MONITOR    │
  │  (frontend) │        │  (backend)  │                │  (logs/status)│
  └──────┬──────┘        └──────┬──────┘                └──────────────┘
         │                      │
  ┌──────┴──────┐        ┌──────┴──────────────────────┐
  │  Node types │        │  Execution Engine            │
  │  - Trigger  │        │  - Step-by-step run          │
  │  - AI Agent │        │  - Conditions evaluation     │
  │  - HTTP     │        │  - Loops (forEach, while)    │
  │  - Email    │        │  - Error handling + retry    │
  │  - Condition│        │  - State persistence (Redis) │
  │  - Loop     │        └──────────────────────────────┘
  │  - Wait     │
  └─────────────┘

EXEMPLE DE WORKFLOW :
  ┌──────────┐    ┌─────────────────┐    ┌─────────────┐    ┌────────────┐
  │  TRIGGER │    │   AI: Cherche   │    │  Condition  │    │  Email:    │
  │ Lundi 9h ├───►│  5 prospects    ├───►│ Score > 0.7 ├───►│ Envoie    │
  └──────────┘    │  sur Internet   │    └──────┬──────┘    │ cold email │
                  └─────────────────┘           │           └────────────┘
                                                │ non
                                                ▼
                                         ┌─────────────┐
                                         │  Archive    │
                                         │  (skip)     │
                                         └─────────────┘
```

## 📁 Architecture fichiers

```
src/workflows/
├── types.ts              🆕 WorkflowDefinition, WorkflowNode, Edge, etc.
├── runner.ts             🆕 Exécution des workflows
├── executor/
│   ├── trigger-exec.ts   🆕 Cron, webhook, event triggers
│   ├── agent-exec.ts     🆕 Nœud AI agent (call AI + tools)
│   ├── http-exec.ts      🆕 Nœud HTTP (fetch externe)
│   ├── email-exec.ts     🆕 Nœud email
│   ├── condition-exec.ts 🆕 Nœud condition (if/else)
│   └── loop-exec.ts      🆕 Nœud boucle (forEach)
├── store.ts              🆕 Persistance workflows (PostgreSQL)
└── routes.ts             🆕 API CRUD workflows + run manual

dashboard/src/
└── components/
    └── workflow-builder/
        ├── index.tsx      🆕 Canvas ReactFlow
        ├── NodeTypes.tsx  🆕 Composants visuels pour chaque type
        └── Sidebar.tsx    🆕 Panel d'ajout de nœuds
```

### Types de base

```typescript
// src/workflows/types.ts
export type NodeType =
  | 'trigger_cron' | 'trigger_webhook' | 'trigger_event'
  | 'ai_agent' | 'http_request' | 'send_email' | 'send_message'
  | 'condition' | 'loop_foreach' | 'loop_while'
  | 'set_variable' | 'wait' | 'end';

export interface WorkflowNode {
  id:      string;
  type:    NodeType;
  label:   string;
  config:  Record<string, unknown>;  // spécifique à chaque type
  nextId?: string;          // nœud suivant (happy path)
  elseId?: string;          // nœud suivant (condition false)
}

export interface WorkflowDefinition {
  id:          string;
  userId:      string;
  name:        string;
  description?: string;
  nodes:       WorkflowNode[];
  enabled:     boolean;
  createdAt:   string;
  lastRunAt?:  string;
  runCount:    number;
}

export interface WorkflowRunState {
  workflowId: string;
  startedAt:  string;
  currentNodeId: string;
  variables:  Record<string, unknown>;
  logs:       { nodeId: string; ts: string; status: 'ok'|'error'; output?: unknown }[];
  status:     'running' | 'completed' | 'failed' | 'paused';
}
```

## ✅ Critères de succès Phase G

```
□ Créer un workflow via l'UI drag & drop
□ Workflow "Chaque lundi → cherche prospects → email" s'exécute automatiquement
□ Condition : si score prospect > 0.7 → envoie email / sinon → archive
□ GET /api/workflows → liste des workflows avec last_run_at
□ Dashboard shows workflow visual + dernière exécution
```

---

# ═══════════════════════════════════════════════════════
# PHASE H — LOCALISATION (10 LANGUES)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
IntraClaw parle la langue de l'utilisateur. Priorité : EN, FR, NL, ES, DE, AR, PT, IT, ZH, JA.

## 📁 Architecture fichiers

```
src/i18n/
├── index.ts              🆕 init i18next
├── detector.ts           🆕 Détecte la langue préférée (user profile > Accept-Language > 'en')
└── locales/
    ├── en/
    │   ├── common.json   🆕 Messages communs
    │   ├── errors.json   🆕 Erreurs
    │   └── agents.json   🆕 Prompts agents
    ├── fr/
    │   └── ...           🆕 (Français — déjà partiellement fait)
    ├── nl/
    │   └── ...           🆕 Néerlandais
    ├── ar/
    │   └── ...           🆕 Arabe (RTL)
    └── ...               🆕 + ES, DE, PT, IT, ZH, JA
```

### Implémentation i18n dans les prompts

```typescript
// src/i18n/index.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

export async function initI18n(): Promise<void> {
  await i18next.use(Backend).init({
    lng:       'fr',  // défaut
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(process.cwd(), 'src/i18n/locales/{{lng}}/{{ns}}.json'),
    },
    ns: ['common', 'errors', 'agents'],
    defaultNS: 'common',
  });
}

export function t(key: string, options?: object): string {
  return i18next.t(key, options);
}

export function setLanguage(lng: string): void {
  i18next.changeLanguage(lng);
}
```

### Exemple locales/fr/agents.json

```json
{
  "morning_brief": {
    "greeting": "🌅 Bonjour {{name}} !",
    "status_section": "📊 Statut du jour",
    "priorities_section": "🎯 Priorités aujourd'hui",
    "opportunities_section": "⚡ Opportunités immédiates",
    "budget_section": "💰 Budget",
    "be_positive": "Sois concis, positif, actionnable."
  },
  "prospecting": {
    "looking_for": "Je cherche des prospects dans le secteur {{sector}}...",
    "found": "J'ai trouvé {{count}} nouveaux prospects."
  }
}
```

### Détection automatique de langue

```typescript
// src/i18n/detector.ts
export function detectLanguage(text: string): string {
  // Heuristiques simples pour détecter AR (beaucoup de Unicode arabe)
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) return 'ar';

  // Sinon → laisse i18next/browser gérer, ou utiliser compromise/langdetect
  return 'fr';  // défaut utilisateur
}
```

## ✅ Critères de succès Phase H

```
□ User préférence langue sauvée dans User.locale
□ Briefing du matin dans la langue de l'user
□ Arabe : texte RTL correct dans les réponses
□ Fallback EN si traduction manquante
□ "Switch to English" → tout l'interface passe en EN
```

---

# ═══════════════════════════════════════════════════════
# PHASE I — SMART HOME (HOME ASSISTANT)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Contrôler les appareils connectés via Home Assistant depuis IntraClaw : lumières, volets, thermostat, etc.

## 📁 Architecture fichiers

```
src/tools/
└── smart-home/
    ├── ha-client.ts       🆕 WebSocket client Home Assistant
    ├── devices.ts         🆕 Liste + contrôle des entités
    ├── automations.ts     🆕 Déclencher des scènes HA
    └── skill.yaml         🆕 Skill pour contrôle NL
```

### Client Home Assistant

```typescript
// src/tools/smart-home/ha-client.ts
import { createConnection, createLongLivedTokenAuth, callService } from 'home-assistant-js-websocket';

let connection: any = null;

export async function initHomeAssistant(): Promise<void> {
  if (!process.env.HA_URL || !process.env.HA_TOKEN) {
    logger.info('SmartHome', 'Home Assistant non configuré — skip');
    return;
  }
  const auth = createLongLivedTokenAuth(process.env.HA_URL, process.env.HA_TOKEN);
  connection = await createConnection({ auth });
  logger.info('SmartHome', '✅ Connecté à Home Assistant');
}

export async function getStates(): Promise<{ entity_id: string; state: string; attributes: any }[]> {
  if (!connection) return [];
  return connection.sendMessagePromise({ type: 'get_states' });
}

export async function callHAService(
  domain: string,     // ex: 'light'
  service: string,    // ex: 'turn_on'
  entityId: string,   // ex: 'light.salon'
  data?: object
): Promise<void> {
  if (!connection) throw new Error('Home Assistant non connecté');
  await callService(connection, domain, service, { entity_id: entityId, ...data });
}

// Raccourcis
export const lights = {
  on:  (id: string)  => callHAService('light', 'turn_on',  id),
  off: (id: string)  => callHAService('light', 'turn_off', id),
  dim: (id: string, brightness: number) =>
    callHAService('light', 'turn_on', id, { brightness: Math.round(brightness * 2.55) }),
};
```

### Skill YAML

```yaml
# skills/smart-home.yaml
id: smart-home
name: Contrôle Maison Intelligente
version: 1.0.0
triggers:
  - "allume"
  - "éteins"
  - "lumière"
  - "chauffage"
  - "volets"
  - "température"
  - "thermostat"
  - "turn on"
  - "turn off"
steps:
  - action: "get_ha_states"
    description: "Récupère l'état actuel des appareils"
  - action: "parse_intent"
    description: "Détermine quelle entité et quelle action"
  - action: "call_ha_service"
    description: "Exécute l'action sur Home Assistant"
  - action: "confirm"
    description: "Confirme l'action effectuée"
examples:
  - "Allume les lumières du salon"
  - "Mets la température à 21 degrés"
  - "Ferme les volets de la chambre"
  - "Éteins tout avant que je dorme"
```

## ✅ Critères de succès Phase I

```
□ "Allume les lumières du salon" → light.salon ON
□ "Température à 21°" → thermostat mis à jour
□ "Éteins tout" → appelle script HA "all_off"
□ Graceful degradation si HA non configuré (skip silencieux)
□ Sécurité : pas de commandes dangereuses sans confirmation
```

---

# ═══════════════════════════════════════════════════════
# PHASE J — GÉNÉRATION MÉDIAS (IMAGES, VIDÉO, AUDIO)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Générer des images (fal.ai), des vidéos (Replicate) et de l'audio (ElevenLabs ou local TTS).

## 📁 Architecture fichiers

```
src/tools/media/
├── image-generator.ts    🆕 fal.ai Flux Pro + DALL-E fallback
├── video-generator.ts    🆕 Replicate (LTX-Video ou CogVideoX)
├── audio-generator.ts    🆕 ElevenLabs TTS + @xenova/transformers local
├── media-store.ts        🆕 Stockage dans data/generated/media/
└── media-types.ts        🆕 Interfaces
```

### Image Generator

```typescript
// src/tools/media/image-generator.ts
import * as fal from '@fal-ai/serverless-client';

fal.config({ credentials: process.env.FAL_KEY });

export interface ImageResult {
  url:      string;
  localPath: string;
  prompt:   string;
  model:    string;
}

export async function generateImage(prompt: string, options?: {
  width?: number; height?: number; style?: 'realistic'|'artistic'|'logo';
}): Promise<ImageResult> {
  const { width = 1024, height = 1024 } = options ?? {};

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: { prompt, image_size: { width, height }, num_images: 1 },
    logs: false,
  }) as any;

  const imageUrl = result.images[0].url;

  // Télécharge et sauvegarde localement
  const localPath = await downloadToLocal(imageUrl, `image-${Date.now()}.jpg`);

  return { url: imageUrl, localPath, prompt, model: 'fal-ai/flux/schnell' };
}
```

### Audio TTS

```typescript
// src/tools/media/audio-generator.ts
export async function textToSpeech(text: string, language = 'fr'): Promise<string> {
  // ElevenLabs si token disponible
  if (process.env.ELEVENLABS_API_KEY) {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method:  'POST',
      headers: {
        'xi-api-key':    process.env.ELEVENLABS_API_KEY!,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        text,
        model_id:     'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    const buffer = await response.arrayBuffer();
    const outPath = path.join('data/generated/media', `tts-${Date.now()}.mp3`);
    fs.writeFileSync(outPath, Buffer.from(buffer));
    return outPath;
  }

  // Fallback : edge-tts (gratuit, voix Microsoft)
  const { execSync } = await import('child_process');
  const voice   = language === 'fr' ? 'fr-FR-DeniseNeural' : 'en-US-JennyNeural';
  const outPath = path.join('data/generated/media', `tts-${Date.now()}.mp3`);
  execSync(`edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outPath}"`);
  return outPath;
}
```

## ✅ Critères de succès Phase J

```
□ "Génère une image de couverture LinkedIn sur le SEO" → image 1200x627
□ "Crée un audio de présentation pour mon site" → fichier MP3
□ fal.ai down → fallback DALL-E 3 si clé OpenAI présente
□ ElevenLabs down → fallback edge-tts (local, gratuit)
□ Toutes les médias sauvegardées dans data/generated/media/
```

---

# ═══════════════════════════════════════════════════════
# PHASE K — MEMORY DREAMING (CYCLE REM NOCTURNE)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Chaque nuit (3h du matin), IntraClaw consolide sa mémoire, identifie des patterns, génère des insights, compresse les vieilles données. Comme OpenClaw's REM cycle.

## 🧠 Mindmap REM Cycle

```
                    ┌─────────────────────────┐
                    │   MEMORY DREAMING       │
                    │   (Chaque nuit à 3h)    │
                    └──────────┬──────────────┘
                               │
     ┌─────────────────────────┼────────────────────────────┐
     │                         │                            │
┌────▼────┐              ┌─────▼─────┐              ┌───────▼──────┐
│  REVIEW │              │  PATTERN  │              │  COMPRESS    │
│ Actions │              │  MINING   │              │  Old memory  │
│ 24h     │              │  (quoi    │              │  (résumé     │
│         │              │  a marché)│              │  plutôt que  │
└────┬────┘              └─────┬─────┘              │  effacer)    │
     │                         │                    └─────────────┘
     │                         │
     ▼                         ▼
┌─────────────────────────────────────────┐
│  HEARTBEAT.md mis à jour avec insights  │
│  Business memory enrichie               │
│  ChromaDB : vecteurs consolidés         │
│  Skill mutations proposées              │
└─────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
src/memory/
├── enhanced.ts            ✅ EXISTANT
├── business-memory.ts     ✅ EXISTANT
├── vector-memory.ts       ✅ EXISTANT
└── dreaming/
    ├── index.ts           🆕 Orchestrateur principal REM
    ├── consolidator.ts    🆕 Résume les 24h d'actions
    ├── pattern-miner.ts   🆕 Identifie les patterns qui marchent
    ├── memory-compressor.ts 🆕 Compresse les vieux souvenirs
    └── insight-writer.ts  🆕 Écrit les insights dans HEARTBEAT.md
```

### Orchestrateur REM

```typescript
// src/memory/dreaming/index.ts
export async function runREMCycle(): Promise<void> {
  logger.info('Dreaming', '💤 Démarrage cycle REM nocturne');
  const startedAt = Date.now();

  // 1. Review des 24 dernières heures
  const actions = await getRecentActions(24 * 60);
  const review = await consolidateActions(actions);

  // 2. Pattern mining
  const patterns = await minePatterns(actions);

  // 3. Compression mémoire ancienne (> 7 jours → résumé)
  await compressOldMemories(7);

  // 4. Écriture des insights
  await writeInsightsToHeartbeat({ review, patterns });

  // 5. Mise à jour business memory
  for (const p of patterns.filter(p => p.category === 'email')) {
    await recordBusinessLearning({
      insight:    p.description,
      source:     'rem_cycle',
      confidence: p.confidence,
    });
  }

  logger.info('Dreaming', `✅ Cycle REM terminé en ${Date.now() - startedAt}ms`);
}
```

### Pattern Miner

```typescript
// src/memory/dreaming/pattern-miner.ts
export interface Pattern {
  category:    'email' | 'prospecting' | 'content' | 'timing';
  description: string;
  confidence:  number;  // 0-1
  evidence:    string[];
}

export async function minePatterns(actions: ActionRecord[]): Promise<Pattern[]> {
  const summary = actions.map(a => ({
    type:    a.task,
    success: a.status === 'success',
    time:    a.createdAt,
    data:    a.data ? JSON.stringify(a.data).slice(0, 200) : '',
  }));

  const prompt = `
Tu es un analyste de données. Voici les actions d'IntraClaw sur les dernières 24h :

${JSON.stringify(summary, null, 2)}

Identifie des patterns récurrents et actionables :
- Quels types d'actions réussissent le plus ?
- À quels moments de la journée les résultats sont-ils meilleurs ?
- Y a-t-il des corrélations (ex: emails envoyés le matin → plus de réponses) ?

Réponds en JSON : [{ "category": "...", "description": "...", "confidence": 0.8, "evidence": ["..."] }]
`.trim();

  const response = await ask({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 600, temperature: 0.4,
    task: AgentTask.MAINTENANCE, modelTier: 'balanced',
  });

  const match = response.content.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}
```

## ✅ Critères de succès Phase K

```
□ Chaque nuit à 3h → runREMCycle() déclenché automatiquement
□ HEARTBEAT.md mis à jour avec "Insights du [date]" section
□ Mémoires > 7 jours compressées (pas effacées — résumées)
□ Patterns identifiés → business_memory.json enrichi
□ Log "💤 Cycle REM terminé en Xms" visible dans les logs
```

---

# ═══════════════════════════════════════════════════════
# PHASE L — PLUGIN SDK (EXTERNAL DEVELOPERS)
# ═══════════════════════════════════════════════════════

## 🎯 Objectif
Des développeurs externes peuvent créer des plugins pour IntraClaw avec une API bien définie, des types TypeScript, et une sandbox de sécurité.

## 🧠 Mindmap Plugin SDK

```
                    ┌─────────────────────────┐
                    │      PLUGIN SDK         │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼──────┐     ┌──────▼──────┐
   │  CONTRACTS  │     │  SANDBOX     │     │  REGISTRY   │
   │  (Types TS  │     │  (Isolation  │     │  (npm-style │
   │  Zod schema)│     │  VM/Worker)  │     │  discovery) │
   └─────────────┘     └─────────────┘     └─────────────┘
          │
   ┌──────┴──────────────────────────────────────────────┐
   │  Contrat d'un Plugin :                               │
   │  - manifest.json (nom, version, description)        │
   │  - index.ts (export default class Plugin)           │
   │  - skills/ (YAML skills que le plugin ajoute)       │
   │  - tools/ (outils TS que le plugin expose)          │
   └─────────────────────────────────────────────────────┘
```

## 📁 Architecture fichiers

```
packages/
└── plugin-sdk/              🆕 Package npm @intraclaw/sdk
    ├── src/
    │   ├── types.ts         🆕 IntraclawPlugin interface
    │   ├── context.ts       🆕 PluginContext (API disponible au plugin)
    │   ├── sandbox.ts       🆕 VM2 sandboxing
    │   └── index.ts         🆕 Exports publics
    ├── tsconfig.json
    └── package.json         🆕 { "name": "@intraclaw/sdk" }

src/plugins/
├── loader.ts                🆕 Charge les plugins depuis plugins/ dir
├── registry.ts              🆕 Map<pluginId, PluginInstance>
└── routes.ts                🆕 API /plugins (CRUD)

plugins/                     🆕 (dossier pour installer les plugins)
└── example-plugin/
    ├── manifest.json
    ├── index.ts
    └── skills/
        └── my-skill.yaml
```

### Interface Plugin SDK

```typescript
// packages/plugin-sdk/src/types.ts
export interface IntraclawPlugin {
  id:          string;
  name:        string;
  version:     string;
  description: string;

  /**
   * Appelé une fois au démarrage du plugin
   */
  onLoad(ctx: PluginContext): Promise<void>;

  /**
   * Appelé à l'arrêt propre
   */
  onUnload?(): Promise<void>;

  /**
   * Intercepte les messages entrants (optionnel)
   */
  onMessage?(message: UniversalMessage): Promise<UniversalMessage | null>;
}

export interface PluginContext {
  /** Enregistre un outil disponible dans l'executor */
  registerTool(name: string, fn: (args: unknown) => Promise<unknown>): void;

  /** Enregistre un skill YAML */
  registerSkill(yamlContent: string): void;

  /** Accès en lecture à la mémoire */
  getMemory(key: string): Promise<string | null>;

  /** Sauvegarde en mémoire */
  setMemory(key: string, value: string): Promise<void>;

  /** Envoie une notification Telegram */
  notify(message: string): Promise<void>;

  /** Appelle Claude (via IntraClaw rate limiter) */
  ask(prompt: string, options?: { maxTokens?: number }): Promise<string>;

  /** Logger du plugin (préfixé avec le nom) */
  logger: { info: Function; warn: Function; error: Function };
}
```

### Exemple de plugin externe

```typescript
// plugins/weather-pro/index.ts
import { IntraclawPlugin, PluginContext } from '@intraclaw/sdk';

export default class WeatherProPlugin implements IntraclawPlugin {
  id = 'weather-pro';
  name = 'Weather Pro';
  version = '1.0.0';
  description = 'Météo avancée avec alertes et forecasts 7 jours';

  async onLoad(ctx: PluginContext): Promise<void> {
    ctx.registerTool('get_weather_forecast', async (args: any) => {
      const { city, days = 7 } = args;
      const res = await fetch(`https://api.openweathermap.org/data/3.0/forecast?q=${city}&cnt=${days}&appid=${process.env.OWM_KEY}`);
      return res.json();
    });

    ctx.registerSkill(`
id: weather-forecast
name: Prévisions Météo
triggers: ["météo", "prévisions", "forecast", "temps demain"]
steps:
  - action: get_weather_forecast
  - action: respond_naturally
`);

    ctx.logger.info('Weather Pro plugin chargé');
  }
}
```

## ✅ Critères de succès Phase L

```
□ npm install @intraclaw/sdk → types disponibles pour les devs
□ Plugin dans plugins/ → chargé automatiquement au démarrage
□ Plugin expose un outil → disponible dans l'executor
□ Plugin malveillant → sandboxé (VM2, pas d'accès fs/network direct)
□ GET /api/plugins → liste des plugins actifs
□ Documentation SDK : README + exemples dans packages/plugin-sdk/
```

---

# ═══════════════════════════════════════════════════════
# 📊 TABLEAU DE BORD — RÉSUMÉ DE TOUTES LES PHASES
# ═══════════════════════════════════════════════════════

```
┌─────────┬───────────────────────────────┬──────────┬─────────┬────────────────────────────────┐
│  Phase  │  Feature                      │  Effort  │  Semain │  Impact Marché                 │
├─────────┼───────────────────────────────┼──────────┼─────────┼────────────────────────────────┤
│    A    │  Multi-messaging gateway      │  ████░░  │  1-2    │  🚀🚀🚀 (WhatsApp = 2B users)  │
│    B    │  Docker + Onboarding wizard   │  ███░░░  │  2-3    │  🚀🚀🚀 (adoption x10)         │
│    C    │  Google Calendar + Outlook    │  ██░░░░  │  3-4    │  🚀🚀 (use case quotidien)     │
│    D    │  Full email management        │  ███░░░  │  4-5    │  🚀🚀🚀 (rival Superhuman)      │
│    E    │  Multi-user + auth JWT        │  ████░░  │  5-6    │  🚀🚀🚀 (SaaS = revenue)       │
│    F    │  Skill marketplace            │  ████░░  │  6-7    │  🚀🚀🚀 (moat technique)       │
│    G    │  Workflow orchestrator        │  █████░  │  7-8    │  🚀🚀🚀 (rival n8n/Zapier)     │
│    H    │  Localisation 10 langues      │  ██░░░░  │  8-9    │  🚀🚀 (marché mondial)         │
│    I    │  Smart Home (HA)              │  ██░░░░  │  9-10   │  🚀 (différenciateur niche)    │
│    J    │  Génération médias            │  ████░░  │  10-11  │  🚀🚀 (créateurs de contenu)   │
│    K    │  Memory dreaming (REM)        │  ███░░░  │  11-12  │  🚀🚀 (différenciateur fort)   │
│    L    │  Plugin SDK                   │  ████░░  │  13-16  │  🚀🚀🚀 (écosystème = moat)    │
└─────────┴───────────────────────────────┴──────────┴─────────┴────────────────────────────────┘

Effort : █ = 1 semaine   Impact : 🚀 = minor, 🚀🚀 = significant, 🚀🚀🚀 = game-changer
```

---

# 🆚 POSITIONNEMENT CONCURRENTIEL FINAL

```
                        FONCTIONNALITÉS PAR AGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature                 │ IntraClaw 2.0 │ OpenClaw │ AutoGPT │ CrewAI │ Devin
────────────────────────┼───────────────┼──────────┼─────────┼────────┼───────
Autonomous loop         │ ✅ PerceptionAI│ ✅       │ ✅      │ ✅     │ ✅
Universal task executor │ ✅ Ambiguity+ │ ✅       │ ✅      │ ❌     │ ✅
Multi-messaging (8 canx)│ ✅ Phase A    │ ❌       │ ❌      │ ❌     │ ❌
Docker onboarding 5min  │ ✅ Phase B    │ ❌       │ ❌      │ ❌     │ ❌
Google Calendar         │ ✅ Phase C    │ ❌       │ ❌      │ ❌     │ ❌
Full email management   │ ✅ Phase D    │ ❌       │ ❌      │ ❌     │ ❌
Multi-user SaaS         │ ✅ Phase E    │ ❌       │ ❌      │ ❌     │ ✅
Skill marketplace       │ ✅ Phase F    │ ❌       │ ❌      │ ✅     │ ❌
Workflow builder visual │ ✅ Phase G    │ ❌       │ ❌      │ ❌     │ ❌
10 langues              │ ✅ Phase H    │ ❌       │ ❌      │ ❌     │ ❌
Smart Home              │ ✅ Phase I    │ ❌       │ ❌      │ ❌     │ ❌
Image/Video generation  │ ✅ Phase J    │ ✅       │ ✅      │ ❌     │ ❌
Memory dreaming (REM)   │ ✅ Phase K    │ ✅ (REM) │ ❌      │ ❌     │ ❌
Plugin SDK externe      │ ✅ Phase L    │ ❌       │ ✅      │ ✅     │ ❌
PAL Router (auto-tier)  │ ✅ EXISTANT   │ ❌       │ ❌      │ ❌     │ ❌
Ouroboros evolution     │ ✅ EXISTANT   │ ✅       │ ❌      │ ❌     │ ❌
Business memory         │ ✅ EXISTANT   │ ❌       │ ❌      │ ❌     │ ❌
3-stage evaluation      │ ✅ EXISTANT   │ ❌       │ ❌      │ ❌     │ ❌
────────────────────────┼───────────────┼──────────┼─────────┼────────┼───────
SCORE TOTAL             │     18/18     │  6/18    │  5/18   │  4/18  │  4/18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

# 🏁 CRITÈRES DE VICTOIRE — "DÉTRONE TOUT LE MONDE"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  MVP (Semaine 4)                                                            │
│  ✓ Multi-messaging : WhatsApp + Discord + Slack                            │
│  ✓ Docker : docker compose up → ready in < 60s                             │
│  ✓ Onboarding wizard en 5 minutes                                          │
│                                                                             │
│  BÊTA PUBLIQUE (Semaine 10)                                                 │
│  ✓ Tout le MVP +                                                            │
│  ✓ Multi-user avec auth                                                     │
│  ✓ Skill marketplace avec 20+ skills communautaires                        │
│  ✓ Google Calendar intégré                                                  │
│  ✓ Email full management                                                    │
│  ✓ Workflow orchestrator (10 templates prêts)                              │
│                                                                             │
│  VERSION 2.0 (Semaine 16)                                                   │
│  ✓ Tout la bêta +                                                           │
│  ✓ 10 langues                                                               │
│  ✓ Smart Home                                                               │
│  ✓ Génération médias                                                        │
│  ✓ Memory dreaming (REM)                                                    │
│  ✓ Plugin SDK public avec doc complète                                      │
│  ✓ 100+ plugins dans le marketplace                                         │
│  ✓ Site vitrine + pricing page                                              │
│                                                                             │
│  MÉTRIQUES CIBLES                                                           │
│  ✓ GitHub stars : 10K en 3 mois                                            │
│  ✓ Users actifs : 1000 en 3 mois                                           │
│  ✓ MRR : 5K€ en 6 mois (plan PRO 10€/mois)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 PROCHAINE ACTION IMMÉDIATE

```
ORDRE D'IMPLÉMENTATION RECOMMANDÉ :

1. Phase B (Docker) → en premier car ça débloue le déploiement pour TOUT
2. Phase A (Multi-messaging) → WhatsApp seul déjà = game changer
3. Phase E (Multi-user) → nécessaire avant Phase F
4. Phase F (Marketplace) → crée l'effet réseau
5. Phase G (Workflows) → différenciateur vs n8n/Zapier
6. Phases C, D, H, I, J, K, L → dans l'ordre selon l'impact voulu

→ Dis-moi "go phase B" et on attaque Docker + Onboarding maintenant.
```

---

*Plan généré le 2026-04-14 · IntraClaw v2.0 World Domination Plan*
*Total estimé : 16 semaines de dev solo, ~11 200 LOC supplémentaires*
