# IntraClaw Dashboard — Plan de développement

**Version :** 1.0
**Date :** Avril 2026
**Statut :** Plan validé — non codé
**Stack cible :** Next.js 15 + Tailwind CSS + shadcn/ui + WebSocket + SQLite

---

## Vision

Un outil de pilotage business professionnel — dark mode, dense en données, temps réel.
Inspiration : **n8n** pour l'organigramme agents, **Paperclip** pour le style épuré, **cmux** pour les notifications, **Linear** pour le Kanban.
Pas de design "gamer". Un vrai cockpit de CEO solo.

---

## Architecture technique

```
IntraClaw (Node.js)
├── src/index.ts          → démarre le scheduler + agents
├── src/server.ts         → serveur Express (REST API + WebSocket)
│   ├── GET  /api/status
│   ├── GET  /api/prospects
│   ├── GET  /api/pipeline
│   ├── GET  /api/actions
│   ├── GET  /api/reports
│   ├── POST /api/chat
│   ├── POST /api/scheduler/pause
│   ├── POST /api/scheduler/resume
│   └── WS   /ws          → push events en temps réel
└── dashboard/            → app Next.js (sous-dossier ou repo séparé)
    ├── app/
    │   ├── page.tsx              → Dashboard principal
    │   ├── agents/page.tsx       → Organigramme agents
    │   ├── pipeline/page.tsx     → Kanban prospects
    │   ├── history/page.tsx      → Timeline actions
    │   ├── chat/page.tsx         → Chat IntraClaw
    │   ├── settings/page.tsx     → Paramètres
    │   └── notifications/page.tsx
    └── components/
```

### Stockage SQLite

Fichier : `data/intraclaw.db`
Tables :
- `agent_actions` — id, agent, task, status, duration_ms, model, cost_eur, created_at
- `pipeline_events` — id, prospect_id, from_status, to_status, created_at
- `notifications` — id, type, message, read, created_at

La base SQLite est écrite par les agents Node.js et lue par le dashboard Next.js.

### WebSocket events (push temps réel)

```typescript
type WSEvent =
  | { type: 'agent_start';    agent: string; task: string }
  | { type: 'agent_done';     agent: string; task: string; success: boolean; durationMs: number }
  | { type: 'prospect_moved'; prospectId: string; from: string; to: string }
  | { type: 'email_sent';     to: string; subject: string }
  | { type: 'cost_update';    spentEur: number; remainingEur: number }
  | { type: 'notification';   message: string; level: 'info' | 'warn' | 'error' }
```

---

## Page 1 — Dashboard principal

**Route :** `/`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🐾 IntraClaw     [Live ●]           Lundi 6 avril, 10:14  │
├──────────────┬──────────────┬────────────────┬──────────────┤
│  Revenus mois│  Prospects   │  Emails envoyés│  Budget API  │
│   0 €        │   0 new      │   0 today      │  0€ / 5€     │
│  ▲ +0€ sem.  │   0 total    │   0 sem.       │  ████░░ 0%   │
├──────────────┴──────────────┴────────────────┴──────────────┤
│  PIPELINE FUNNEL                                             │
│  Nouveau(0) → Contacté(0) → Réponse(0) → Devis(0) → Signé  │
│  [──────────────── barre de progression ────────────────]   │
├───────────────────────────┬─────────────────────────────────┤
│  ACTIVITÉ RÉCENTE         │  AGENTS STATUS                  │
│  Timeline 5 dernières     │  ● Coordinator  [idle]          │
│  actions avec timestamps  │  ● Prospection  [idle]          │
│                           │  ● Cold Email   [idle]          │
│                           │  ● Content      [idle]          │
│                           │  ● Reporting    [idle]          │
└───────────────────────────┴─────────────────────────────────┘
```

### Composants
- `KpiCard` — metric + variation + sparkline 7 jours
- `FunnelBar` — pipeline horizontal avec pourcentages
- `ActivityFeed` — 10 dernières actions, auto-refresh via WS
- `AgentStatusGrid` — 5 agents avec statut, dernière action, badge "en cours"

---

## Page 2 — Organigramme agents

**Route :** `/agents`

### Layout

Organigramme hiérarchique vertical, inspiré de n8n node editor.

```
                    ┌────────────────┐
                    │  COORDINATOR   │
                    │  ● idle        │
                    │  0 actions/j   │
                    └───────┬────────┘
          ┌─────────┬───────┼───────┬──────────┐
    ┌─────┴──┐ ┌────┴──┐ ┌──┴────┐ ┌┴──────┐ ┌─┴──────┐
    │PROSPEC.│ │COLD   │ │CONTENT│ │REPORT.│ │TOOLS   │
    │● idle  │ │EMAIL  │ │● idle │ │● idle │ │(utils) │
    │0/jour  │ │● idle │ │0/jour │ │0/jour │        │
    └────────┘ │0/jour │ └───────┘ └───────┘ └────────┘
               └───────┘
```

Chaque nœud agent affiche :
- Statut visuel : `●` vert (actif), gris (idle), rouge (erreur)
- Dernière action + timestamp relatif ("il y a 2h")
- Nombre d'actions aujourd'hui
- Coût cumulé du jour (€)
- Bouton "Trigger" pour lancer manuellement l'agent

Les connexions entre agents sont des arêtes avec flèches directionnelles.
Clic sur un agent → drawer latéral avec logs des 10 dernières exécutions.

---

## Page 3 — Pipeline Kanban

**Route :** `/pipeline`

### Colonnes
```
NOUVEAU  │  CONTACTÉ  │  INTÉRESSÉ  │  DEVIS  │  SIGNÉ  │  LIVRÉ
────────  ────────────  ────────────  ───────  ──────── ────────
[card]    [card]        [card]                           [card]
[card]    [card]
```

### Prospect Card
```
┌─────────────────────────────┐
│ 🏪 Restaurant Le Midi       │
│ Bruxelles — Restaurant      │
│ 📧 contact@lemidi.be        │
│ ⚠️ Site: perf 34/100         │
│ 📅 Contacté il y a 2j       │
│ [Voir] [Email] [PageSpeed]  │
└─────────────────────────────┘
```

Fonctionnalités :
- **Drag-and-drop** entre colonnes (via `@dnd-kit/core`)
- Drag → appelle `POST /api/prospects/{id}/status` → met à jour Notion
- Filtres : par secteur, par date, par source
- Recherche full-text
- Clic carte → modal détail avec tous les champs + historique emails
- Tri : par date, par score PageSpeed, par secteur

---

## Page 4 — Historique des actions

**Route :** `/history`

### Timeline verticale

```
10:00  ─●─  [Cold Email] Email envoyé → Restaurant Le Midi
             Subject: "Votre site perd des clients..."
             Modèle: claude | Durée: 8.2s | Coût: 0.003€

09:30  ─●─  [Content] Post LinkedIn généré
             Topic: "cybersécurité pour PME"
             Modèle: gemma | 487 tokens

09:00  ─●─  [Prospecting] 3 prospects ajoutés
             Catégorie: boulangerie bruxelles
             Emails vérifiés: 2/3

08:00  ─●─  [Scheduler] Job "Content" démarré
07:00  ─●─  [Morning Brief] Briefing généré — 423 mots
```

Filtres :
- Par agent (Prospecting / Cold Email / Content / Reporting)
- Par statut (succès / erreur)
- Par date (aujourd'hui / cette semaine / ce mois)
- Par coût (> 0.01€)

Export CSV des actions filtrées.

---

## Page 5 — Chat IntraClaw

**Route :** `/chat`

### Layout

Interface de chat style Claude.ai, intégrée dans le dashboard.

```
┌─────────────────────────────────────────────────────────┐
│  Chat avec IntraClaw                         [Effacer]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [IntraClaw]  Bonjour Ayman ! Voici le brief du...     │
│                                                         │
│  [Ayman]      Combien de prospects ce mois-ci ?        │
│                                                         │
│  [IntraClaw]  Tu as 12 prospects en base ce mois...    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Message...                              [Envoyer ↩]   │
└─────────────────────────────────────────────────────────┘
```

- Input → `POST /api/chat` → coordinator → réponse AI
- Affichage Markdown (react-markdown)
- Historique de session persisté en localStorage
- Raccourcis clavier : `Enter` envoie, `Shift+Enter` newline
- Streaming de la réponse (Server-Sent Events ou WS)

---

## Page 6 — Paramètres

**Route :** `/settings`

### Sections

**Scheduler**
```
Morning Brief   [07:00] [lun-ven] [✓ Actif]  [Modifier]
Prospecting     [08:00] [lun-ven] [✓ Actif]  [Modifier]
Content         [09:00] [lun-ven] [✓ Actif]  [Modifier]
Cold Emails     [10:00] [lun-ven] [✓ Actif]  [Modifier]
Evening Report  [18:00] [lun-ven] [✓ Actif]  [Modifier]
Maintenance     [03:00] [dim]     [✓ Actif]  [Modifier]
```

**Rate Limits**
```
Claude API   [50  ] appels/jour   [Sauvegarder]
Gmail        [50  ] emails/jour   [Sauvegarder]
Scraping     [100 ] req/jour      [Sauvegarder]
```

**Budget API**
```
Budget quotidien  [5.00 €]  [Sauvegarder]
Alerte à          [85 %  ]  [Sauvegarder]
```

**Intégrations**
Status de chaque intégration (✓ connecté / ✗ non configuré) :
- Claude CLI, Ollama, Gmail OAuth, Notion API, Telegram Bot

---

## Page 7 — Notifications

**Route :** `/notifications`

### Inspiration cmux

Panel de notifications avec anneaux de couleur selon la priorité.

```
🔵 [Nouveau]  Prospecting — 5 nouveaux prospects ajoutés
              Restaurant, Coiffeur... il y a 2h

🟡 [Attention] Budget API — 87% du budget quotidien utilisé
               4.35€ / 5€ dépensés — il y a 30min

🔴 [Erreur]   Cold Email — Échec envoi email
               contact@example.com — SMTP timeout — il y a 1h
```

Comportements :
- Anneau bleu = info, jaune = warning, rouge = erreur
- Clic → marque comme lu
- "Tout marquer comme lu"
- Badge rouge sur l'icône navbar si notifications non lues
- Les nouvelles notifications pushées via WebSocket font apparaître un toast

---

## Navbar

Barre latérale gauche fixe (64px de large, icons only) — expandable au survol.

```
🐾  [IntraClaw]
─────────────────
📊  Dashboard
🤖  Agents
📋  Pipeline
📜  Historique
💬  Chat
⚙️   Paramètres
🔔  Notifications [3]
─────────────────
🟢  Live
```

---

## Design System

### Couleurs (dark mode)

```css
--bg-base:       #0D0F12   /* fond principal */
--bg-card:       #161A1F   /* cartes */
--bg-hover:      #1E242B   /* hover état */
--border:        #2A313A   /* bordures */
--text-primary:  #E8EDF2   /* texte principal */
--text-muted:    #6B7A8D   /* texte secondaire */
--accent-blue:   #3B82F6   /* actions principales */
--accent-green:  #10B981   /* succès, actif */
--accent-yellow: #F59E0B   /* warning */
--accent-red:    #EF4444   /* erreur */
```

### Typographie
- Font : `Inter` (system-ui fallback)
- Code/logs : `JetBrains Mono`

### Composants shadcn/ui utilisés
`Card`, `Badge`, `Button`, `Dialog`, `Drawer`, `Input`, `Select`,
`Table`, `Tabs`, `Toast`, `Tooltip`, `ScrollArea`, `Separator`

---

## Ordre de développement recommandé

1. **`src/server.ts`** — Express + WebSocket + SQLite setup (½ journée)
2. **`dashboard/`** — Next.js init + layout + navbar (½ journée)
3. **Page 1** — Dashboard principal avec KPIs (1 journée)
4. **Page 3** — Kanban pipeline (1 journée — le plus utile business)
5. **Page 2** — Organigramme agents (½ journée)
6. **Page 5** — Chat (½ journée)
7. **Pages 4, 6, 7** — Historique, Paramètres, Notifications (1 journée)

**Total estimé : 4-5 jours de dev**

---

## Dépendances à installer le moment venu

```bash
# Dashboard Next.js
npx create-next-app@latest dashboard --typescript --tailwind --app

# Composants UI
npx shadcn@latest init
npx shadcn@latest add card badge button dialog drawer input

# Drag and drop Kanban
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Markdown
npm install react-markdown

# Charts
npm install recharts

# Backend IntraClaw
npm install express better-sqlite3 ws
npm install --save-dev @types/express @types/better-sqlite3 @types/ws
```
