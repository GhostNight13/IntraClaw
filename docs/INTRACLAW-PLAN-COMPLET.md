# INTRACLAW — Plan Complet de Construction

## Agent IA Autonome Personnel pour Ayman

**Version :** 1.0
**Date :** 4 avril 2026
**Auteur :** Ayman (assisté par Claude)
**Statut :** Plan de développement — Pré-production

---

> *"La meilleure façon de prédire l'avenir, c'est de le construire."*
> — Alan Kay

---

## TABLE DES MATIÈRES

1. [PARTIE 1 : Comprendre OpenClaw en Profondeur](#partie-1--comprendre-openclaw-en-profondeur)
2. [PARTIE 2 : Ce que les Gens Font avec OpenClaw](#partie-2--ce-que-les-gens-font-avec-openclaw)
3. [PARTIE 3 : Claude Agent SDK — L'Alternative](#partie-3--claude-agent-sdk--lalternative)
4. [PARTIE 4 : Le Plan IntraClaw — Architecture Complète](#partie-4--le-plan-intraclaw--architecture-complète)
5. [PARTIE 5 : Plan de Développement Semaine par Semaine](#partie-5--plan-de-développement-semaine-par-semaine)
6. [PARTIE 6 : Problèmes Possibles et Solutions](#partie-6--problèmes-possibles-et-solutions)
7. [PARTIE 7 : Comparaison IntraClaw vs OpenClaw](#partie-7--comparaison-intraclaw-vs-openclaw)
8. [PARTIE 8 : Budget et Coûts Estimés](#partie-8--budget-et-coûts-estimés)
9. [PARTIE 9 : Ressources et Liens](#partie-9--ressources-et-liens)

---
---
---

# PARTIE 1 : COMPRENDRE OPENCLAW EN PROFONDEUR

## 1.1 — C'est Quoi OpenClaw ? (Explication Ultra-Simple)

Imagine que tu as un robot personnel qui vit dans ton ordinateur. Ce robot peut :

- Lire et écrire des messages sur WhatsApp, Telegram, Slack, Discord...
- Naviguer sur internet tout seul
- Se souvenir de TOUT ce que tu lui as dit (mémoire permanente)
- Faire des tâches automatiquement à des heures précises (comme un réveil ultra-intelligent)
- Apprendre de nouvelles compétences (skills) qu'on lui installe

Ce robot, c'est **OpenClaw**. C'est un programme open-source (gratuit, code visible par tout le monde) qui transforme un modèle d'IA comme Claude ou GPT en un **agent autonome** — c'est-à-dire une IA qui ne se contente pas de répondre à tes questions, mais qui **agit** toute seule.

La différence entre ChatGPT/Claude et OpenClaw, c'est comme la différence entre :

- **Un assistant vocal** (Siri, Alexa) qui attend tes commandes → c'est ChatGPT/Claude
- **Un employé** qui travaille tout seul pendant que tu dors → c'est OpenClaw

OpenClaw ne "pense" pas lui-même. Il utilise un LLM (Large Language Model) comme Claude, GPT-4, ou DeepSeek comme "cerveau". Le rôle d'OpenClaw, c'est de donner des **mains**, des **yeux**, et une **mémoire** à ce cerveau.


## 1.2 — L'Histoire d'OpenClaw

### Le Créateur : Peter Steinberger

Peter Steinberger est un développeur autrichien. Il est connu dans la communauté iOS/macOS pour avoir créé PSPDFKit, un framework PDF très utilisé. En novembre 2025, il publie un petit projet personnel sur GitHub : **Clawdbot**.

Clawdbot, c'est son assistant IA personnel. Rien de fou au départ — juste un bot qui tourne sur son Mac et qui répond sur WhatsApp via le LLM Claude d'Anthropic.

### La Timeline

- **Novembre 2025** : Publication de "Clawdbot" sur GitHub. Quelques centaines d'étoiles.
- **Décembre 2025 - Janvier 2026** : Le projet explose sur Twitter/X et Hacker News. Les gens adorent l'idée d'avoir leur propre agent IA local.
- **27 janvier 2026** : Anthropic envoie une plainte pour violation de marque (le nom "Clawdbot" est trop proche de "Claude"). Le projet est renommé **Moltbot**.
- **30 janvier 2026** : Peter trouve que "Moltbot" ne sonne pas bien. Nouveau renommage : **OpenClaw**. Le nom colle parfaitement — "Open" pour open-source, "Claw" comme un clin d'œil à Claude.
- **Février 2026** : Explosion totale. Le repo atteint 100K étoiles en quelques semaines.
- **14 février 2026** : Peter Steinberger annonce qu'il rejoint OpenAI. Le projet est transféré à une fondation open-source indépendante.
- **Mars 2026** : Le repo dépasse les 247K étoiles et 47K forks. C'est l'un des repos les plus étoilés de l'histoire de GitHub.
- **Début 2026 (Q1)** : Crises de sécurité multiples — CVE-2026-25253, campagne ClawHavoc, rapport Cisco.
- **4 avril 2026** : Anthropic bloque officiellement l'utilisation des abonnements Claude (Max, Pro, Team) avec OpenClaw et les outils tiers. Seule l'API payante reste possible.

### Les Chiffres (Mars 2026)

- **310K+ étoiles** sur GitHub (le chiffre exact varie selon les sources, entre 247K confirmé début mars et 310K+ fin mars)
- **47K+ forks**
- **13K+ skills** dans le marketplace ClawHub
- **500K+ instances** déployées dans le monde (estimation VentureBeat)
- **135K+ instances** exposées sur internet public (ce qui est un problème de sécurité énorme)


## 1.3 — L'Architecture Technique d'OpenClaw

### Vue d'Ensemble : Les Deux Couches

L'architecture d'OpenClaw se divise en deux couches distinctes :

```
┌─────────────────────────────────────────────────┐
│                COUCHE 1 : GATEWAY                │
│  (Le cerveau opérationnel — toujours actif)      │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Sessions │ │  Config  │ │ Cron/    │         │
│  │ Manager  │ │ Manager  │ │ Heartbeat│         │
│  └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Channel  │ │ Webhook  │ │ Presence │         │
│  │ Router   │ │ Handler  │ │ Tracker  │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                   │
│          WebSocket Server (port 18789)            │
└─────────────────────────────────────────────────┘
                      │
                      │ WebSocket
                      │
┌─────────────────────────────────────────────────┐
│              COUCHE 2 : AGENT/BOT                │
│  (Le "penseur" — utilise le LLM)                 │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │   LLM    │ │ Memory   │ │  Tools   │         │
│  │ Provider │ │ System   │ │ Manager  │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐                       │
│  │  Skills  │ │ Browser  │                       │
│  │ Loader   │ │ Control  │                       │
│  └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────┘
```

### Couche 1 : Le Gateway (Serveur WebSocket)

Le Gateway est le cœur toujours actif d'OpenClaw. C'est un serveur WebSocket qui tourne en permanence sur ton ordinateur, par défaut sur `localhost:18789`.

**Ce que fait le Gateway :**

1. **Gestion des sessions** : Quand tu envoies un message via WhatsApp, le Gateway crée une "session" — un contexte de conversation avec un historique.

2. **Routage des canaux (channels)** : Le Gateway est connecté à tous tes canaux de messagerie. Quand un message arrive sur WhatsApp, il le route vers l'agent. Quand l'agent répond, il renvoie la réponse sur WhatsApp.

3. **Présence** : Le Gateway sait qui est connecté, qui est en ligne, qui attend une réponse.

4. **Configuration** : Tous les paramètres (quel LLM utiliser, quels canaux activer, quelles permissions) sont gérés par le Gateway.

5. **Cron Jobs / Heartbeat** : Le Gateway lit le fichier HEARTBEAT.md toutes les 30 minutes et exécute les tâches planifiées.

6. **Webhooks** : Le Gateway peut recevoir des appels HTTP externes (par exemple, un site qui notifie d'un événement).

**Le Gateway ne pense pas.** Il ne prend aucune décision intelligente. Son rôle est purement logistique : recevoir, router, planifier.

**Communication WebSocket :**

```
Client (CLI, app macOS, web UI)
    │
    │  WebSocket frame (JSON)
    │  Premier frame = "connect"
    │
    ▼
Gateway (localhost:18789)
    │
    │  Route vers l'agent approprié
    │
    ▼
Agent (utilise Claude/GPT pour "penser")
    │
    │  Réponse
    │
    ▼
Gateway
    │
    │  Route vers le canal d'origine
    │
    ▼
WhatsApp / Telegram / Slack / etc.
```

### Couche 2 : L'Agent (Le Bot)

L'agent, c'est la partie "intelligente". Quand le Gateway lui transmet un message, l'agent :

1. Lit ses fichiers de mémoire (SOUL.md, MEMORY.md, etc.)
2. Construit un prompt avec le contexte + le message de l'utilisateur
3. Envoie le tout au LLM (Claude, GPT, etc.)
4. Reçoit la réponse du LLM
5. Exécute les actions demandées (appels d'outils, écriture en mémoire, etc.)
6. Renvoie la réponse au Gateway

### Le Daemon

En pratique, OpenClaw tourne comme un "daemon" — un processus en arrière-plan sur ton Mac ou ton serveur. Tu le lances une fois, et il tourne indéfiniment. Sur macOS, c'est géré via `launchd` (le système de services de macOS). Sur Linux/VPS, c'est géré via `systemd` ou `pm2`.

Le daemon redémarre automatiquement en cas de crash, et il reprend là où il en était grâce à la mémoire persistante (les fichiers Markdown sur le disque).


## 1.4 — Le Système de Mémoire (Les 8 Fichiers)

La mémoire d'OpenClaw est brillamment simple : **ce sont juste des fichiers Markdown sur ton disque dur**. Pas de base de données complexe, pas de vecteurs embeddings obligatoires (bien que ça puisse être ajouté). Juste du texte.

Pourquoi du Markdown ? Parce que :

- C'est lisible par un humain (tu peux ouvrir SOUL.md avec n'importe quel éditeur)
- C'est lisible par l'IA (le LLM comprend parfaitement le Markdown)
- C'est versionnable avec Git (tu peux voir l'historique de toutes les modifications)
- C'est léger (quelques Ko par fichier)
- C'est portable (copie les fichiers sur un autre ordi, et ton agent "se souvient" de tout)

### Fichier 1 : SOUL.md — La Personnalité

C'est le fichier le plus important. Il définit **qui est ton agent**.

```markdown
# SOUL.md — IntraClaw

## Identité
Tu es IntraClaw, l'assistant IA personnel d'Ayman.
Tu es direct, efficace, et tu ne perds pas de temps en bavardage inutile.

## Ton
- Professionnel mais décontracté
- Pas de blabla — va droit au but
- Utilise le français par défaut, l'anglais si nécessaire

## Règles absolues
- Ne jamais supprimer de données sans confirmation explicite
- Toujours sauvegarder avant de modifier
- Si tu n'es pas sûr, demande
- Ne jamais envoyer un email sans l'avoir montré d'abord

## Ce que tu sais sur Ayman
- 20 ans, étudiant en informatique à Bruxelles
- Fondateur de HaiSkills (formation IA/cybersécurité)
- Freelance développeur web/app
- Cherche des clients B2B (PME, startups, agences)
```

Chaque fois que l'agent démarre ou commence une nouvelle conversation, il lit SOUL.md **en premier**. C'est comme sa "conscience" — ça influence TOUT ce qu'il fait.

### Fichier 2 : USER.md — Le Profil Utilisateur

USER.md contient toutes les informations sur toi, l'utilisateur principal.

```markdown
# USER.md — Profil d'Ayman

## Informations personnelles
- Nom : Ayman
- Âge : 20 ans
- Localisation : Bruxelles, Belgique
- Études : Informatique
- Langues : Français (natif), Anglais (courant), Arabe (natif)

## Business — HaiSkills
- Type : Formation en ligne (IA, cybersécurité)
- Site : haiskills.com
- Cible : Étudiants, pros en reconversion, curieux tech
- Revenus actuels : [à remplir]
- Objectif : [à remplir]

## Freelance
- Services : Développement web/app, automatisation
- Stack : Next.js, React, Node.js, Python, Supabase
- Clients cibles : PME Bruxelles, startups tech, agences web
- Tarif : [à remplir]

## Préférences de communication
- Email : ayman.idamre@gmail.com
- WhatsApp : [numéro]
- Heures actives : 9h-23h
- Préfère les rapports courts et actionnables
```

### Fichier 3 : MEMORY.md — La Mémoire Long-Terme

C'est la mémoire vivante de l'agent. Elle grandit au fil du temps.

```markdown
# MEMORY.md — Mémoire Long-Terme

## Faits importants
- [2026-04-01] Ayman a lancé la campagne de prospection pour agences web Bruxelles
- [2026-04-02] Client potentiel "Digital Wave" a répondu positivement au cold email
- [2026-04-03] Le post LinkedIn sur la cybersécurité a eu 2300 vues

## Décisions prises
- Format des cold emails : court (max 5 lignes), personnalisé, avec CTA clair
- Fréquence des posts HaiSkills : 3x/semaine (lundi, mercredi, vendredi)
- Pas de prospection le dimanche

## Leçons apprises
- Les emails envoyés avant 10h ont un meilleur taux d'ouverture
- Les sujets d'email avec le prénom du destinataire convertissent mieux
- Les posts avec des chiffres concrets performent 2x mieux
```

En plus de MEMORY.md, OpenClaw utilise des fichiers journaliers dans un dossier `memory/` :

```
memory/
├── 2026-04-01.md
├── 2026-04-02.md
├── 2026-04-03.md
└── 2026-04-04.md
```

Chaque jour, un nouveau fichier est créé. L'agent charge automatiquement les notes d'aujourd'hui et d'hier. Pour les jours plus anciens, il utilise `memory_search` (recherche sémantique) pour retrouver les informations pertinentes.

### Fichier 4 : HEARTBEAT.md — Les Tâches Planifiées

Le Gateway lit ce fichier toutes les 30 minutes. C'est l'équivalent d'un cron job, mais en langage naturel.

```markdown
# HEARTBEAT.md — Tâches Planifiées

## Tous les jours à 8h00
- Vérifier les nouvelles réponses aux cold emails dans Gmail
- Mettre à jour le CRM Notion avec les réponses reçues
- Préparer le rapport matinal

## Tous les jours à 12h00
- Envoyer les cold emails du jour (max 30)
- Publier le post HaiSkills prévu pour aujourd'hui

## Tous les jours à 20h00
- Compiler le rapport de fin de journée
- Envoyer le rapport par WhatsApp à Ayman
- Planifier les tâches de demain

## Tous les lundis à 9h00
- Scraper 50 nouveaux prospects sur Google Maps
- Enrichir les fiches avec les emails trouvés
- Ajouter au CRM Notion

## Tous les vendredis à 18h00
- Rapport hebdomadaire complet
- Analyse des taux de réponse aux emails
- Suggestions d'amélioration
```

### Fichier 5 : AGENTS.md — Les Règles de Workflow

Ce fichier définit COMMENT l'agent doit se comporter dans différentes situations.

```markdown
# AGENTS.md — Règles de Workflow

## Règle 1 : Validation des emails
Avant d'envoyer un cold email :
1. Vérifier que le prospect n'a pas déjà été contacté (check CRM)
2. Personnaliser le template avec les infos du prospect
3. Si c'est le premier email de la journée, montrer un exemple à Ayman
4. Logger l'envoi dans le CRM

## Règle 2 : Gestion des réponses
Quand un prospect répond :
1. Classer la réponse (positif / négatif / question / OOO)
2. Si positif → déplacer dans la colonne "Intéressé" du CRM
3. Si question → rédiger un brouillon de réponse
4. Si négatif → marquer "Fermé" dans le CRM
5. Notifier Ayman par WhatsApp pour les réponses positives

## Règle 3 : Contenu HaiSkills
Pour chaque post à créer :
1. Choisir le thème depuis le Content Pipeline Notion
2. Générer le contenu (500-800 mots)
3. Ajouter dans Notion en statut "Draft"
4. Ayman review manuellement avant publication

## Règle 4 : Escalation
Quand l'agent ne sait pas quoi faire :
1. Ne JAMAIS inventer une réponse
2. Poser la question à Ayman par WhatsApp
3. Attendre la réponse avant de continuer
4. Sauvegarder la décision dans MEMORY.md pour la prochaine fois
```

### Fichier 6 : TOOLS.md — Les Outils Disponibles

Ce fichier liste tous les outils que l'agent peut utiliser.

```markdown
# TOOLS.md — Outils Disponibles

## gmail
- Envoyer des emails
- Lire des emails
- Rechercher des emails
- Gérer les brouillons

## notion
- Créer des pages
- Modifier des pages
- Requêter des bases de données
- Mettre à jour des propriétés

## browser
- Naviguer sur des URLs
- Extraire du contenu de pages web
- Remplir des formulaires
- Prendre des captures d'écran

## filesystem
- Lire des fichiers
- Écrire des fichiers
- Lister des dossiers
- Modifier des fichiers

## shell
- Exécuter des commandes terminal
- Lancer des scripts
```

### Fichier 7 : IDENTITY.md — L'Identité Publique

Ce fichier définit comment l'agent se présente quand il communique avec des personnes externes (prospects, clients, etc.).

```markdown
# IDENTITY.md — Identité Publique

## Quand tu écris un email au nom d'Ayman :
- Signe toujours "Ayman" (pas "IntraClaw")
- Utilise un ton professionnel mais humain
- Ne mentionne JAMAIS que tu es une IA
- Email de réponse : ayman.idamre@gmail.com

## Quand tu réponds sur WhatsApp à Ayman :
- Tu peux être toi-même (IntraClaw)
- Sois direct et concis
- Utilise des emojis avec parcimonie
```

### Fichier 8 : BOOTSTRAP.md — Le Démarrage

Ce fichier contient les instructions d'initialisation — ce que l'agent doit faire quand il démarre pour la première fois ou après un crash.

```markdown
# BOOTSTRAP.md — Procédure de Démarrage

## Au premier lancement
1. Lire SOUL.md pour charger la personnalité
2. Lire USER.md pour connaître Ayman
3. Lire AGENTS.md pour connaître les règles
4. Lire TOOLS.md pour savoir quels outils sont disponibles
5. Lire MEMORY.md pour récupérer le contexte
6. Lire HEARTBEAT.md pour connaître les tâches planifiées
7. Envoyer un message à Ayman : "IntraClaw démarré. Tous les systèmes opérationnels."

## Après un crash/restart
1. Même séquence que ci-dessus
2. Vérifier le dernier fichier mémoire journalier
3. Identifier les tâches qui auraient dû être exécutées pendant le downtime
4. Rattraper les tâches critiques manquées
5. Notifier Ayman du restart et des tâches rattrapées
```


## 1.5 — Les Skills (Compétences)

Les skills sont des "plugins" pour OpenClaw. Chaque skill est un dossier contenant au minimum un fichier `SKILL.md` qui décrit ce que le skill fait et comment l'utiliser.

### Structure d'un Skill

```
skills/
├── cold-email/
│   ├── SKILL.md          # Description et instructions
│   ├── templates/         # Templates d'emails
│   │   ├── first-touch.md
│   │   ├── follow-up-1.md
│   │   └── follow-up-2.md
│   └── config.json        # Configuration
├── google-maps-scraper/
│   ├── SKILL.md
│   └── scraper.ts
└── notion-crm/
    ├── SKILL.md
    └── schema.json
```

### Exemple de SKILL.md

```markdown
# Skill : Cold Email Outreach

## Description
Ce skill gère l'envoi automatisé de cold emails pour la prospection B2B.

## Quand utiliser
- Quand Ayman demande d'envoyer des emails de prospection
- Quand le heartbeat déclenche l'envoi quotidien
- Quand de nouveaux prospects sont ajoutés au CRM

## Instructions
1. Récupérer la liste des prospects "À contacter" depuis Notion
2. Pour chaque prospect :
   a. Vérifier qu'il n'a pas déjà reçu un email
   b. Personnaliser le template avec son nom, entreprise, et contexte
   c. Envoyer via Gmail API
   d. Mettre à jour le CRM (statut → "Email 1 envoyé", date)
3. Maximum 30 emails par jour
4. Intervalle minimum : 2 minutes entre chaque envoi

## Templates disponibles
- first-touch.md : Premier contact
- follow-up-1.md : Relance J+3
- follow-up-2.md : Relance J+7 (dernier essai)
```

### ClawHub — Le Marketplace de Skills

ClawHub, c'est comme un "App Store" pour OpenClaw. En mars 2026, il contenait plus de 13 000 skills créés par la communauté. On y trouve des skills pour tout : SEO, e-commerce, réseaux sociaux, domotique, développement, finance, etc.

**Le problème de ClawHub : la sécurité.** Contrairement à l'App Store d'Apple, ClawHub n'a pas de processus de validation strict. N'importe qui peut publier un skill. Et c'est exactement ce qui a causé la crise ClawHavoc (on en parle plus bas).


## 1.6 — Les Channels (Canaux de Messagerie)

Les channels sont les "ponts" entre OpenClaw et les plateformes de messagerie. Chaque channel a son propre adaptateur qui normalise les messages entrants et sortants.

### Channels supportés par OpenClaw

| Channel | Bibliothèque utilisée | Type de connexion |
|---------|----------------------|-------------------|
| WhatsApp | Baileys | QR Code pairing |
| Telegram | grammY | Bot Token |
| Discord | discord.js | Bot Token |
| Slack | @slack/bolt | OAuth/App |
| Signal | signal-cli | Phone number |
| iMessage | BlueBubbles | Local bridge |
| Google Chat | API officielle | Service Account |
| Microsoft Teams | Bot Framework | Azure AD |
| Matrix | matrix-js-sdk | Homeserver |
| IRC | irc-framework | Server/Channel |
| WebChat | Built-in | WebSocket |
| LINE | @line/bot-sdk | Channel Token |
| Mattermost | API officielle | Personal Access Token |
| Nostr | nostr-tools | Relay |
| Twitch | tmi.js | OAuth |
| WeChat | wechaty | Puppet |

### Focus : WhatsApp via Baileys

Baileys est une bibliothèque Node.js non officielle qui permet de se connecter à WhatsApp sans passer par l'API Business (qui coûte cher et nécessite une vérification Facebook Business).

Comment ça marche :

1. Au premier lancement, Baileys génère un QR Code dans le terminal
2. Tu scannes le QR Code avec WhatsApp sur ton téléphone
3. Baileys stocke les credentials dans `~/.openclaw/credentials`
4. À partir de là, Baileys reçoit tous les messages WhatsApp via WebSocket
5. Le channel adapter parse les messages et les transmet au Gateway

**Avantages :**
- Gratuit
- Pas besoin de WhatsApp Business API
- Fonctionne comme WhatsApp Web

**Inconvénients :**
- Non officiel (Meta peut bloquer à tout moment)
- Risque de ban si usage abusif
- Nécessite que le téléphone reste connecté à internet


## 1.7 — Le Browser Control (Contrôle du Navigateur)

OpenClaw peut contrôler un navigateur Chrome/Chromium via Puppeteer ou Playwright. Ça lui permet de :

- Naviguer sur des sites web
- Remplir des formulaires
- Cliquer sur des boutons
- Extraire du contenu (scraping)
- Prendre des captures d'écran
- Se connecter à des services web

C'est essentiel pour des tâches comme :
- Scraper Google Maps pour trouver des prospects
- Vérifier les profils LinkedIn des prospects
- Publier du contenu sur les réseaux sociaux
- Surveiller des sites web concurrents


## 1.8 — La Sécurité — Les Problèmes Majeurs

### CVE-2026-25253 : La Faille Critique

**Qu'est-ce que c'est ?**
Une vulnérabilité de type "Remote Code Execution" (RCE) avec un score CVSS de 8.8/10 (critique). En gros : quelqu'un pouvait exécuter du code arbitraire sur ta machine en exploitant ton instance OpenClaw, même si elle n'écoutait que sur localhost.

**Comment ça marchait ?**
La faille exploitait une chaîne d'attaque "one-click" — il suffisait qu'un utilisateur OpenClaw clique sur un lien malveillant pour que l'attaquant prenne le contrôle de son agent.

**Correction :**
Patché dans la version 2026.1.29 d'OpenClaw.

### ClawHavoc : La Campagne de Skills Malveillantes

**Le problème :**
Des attaquants ont publié des skills malveillantes sur ClawHub. Ces skills semblaient légitimes (noms normaux, descriptions convaincantes), mais contenaient du code malveillant caché.

**Les chiffres :**
- Première découverte : 341 skills malveillantes (12% du registre à l'époque)
- Après scan étendu (16 février 2026) : 824+ skills malveillantes confirmées
- Analyse Bitdefender : environ 900 skills malveillantes, soit environ 20% de l'écosystème total

**Que faisaient ces skills ?**
- **Atomic macOS Stealer (AMOS)** : Un malware qui vole les mots de passe, cookies, et données de portefeuilles crypto sur macOS
- **Reverse shells** : Donnent un accès distant à l'attaquant sur ta machine
- **Keyloggers** : Enregistrent tout ce que tu tapes
- **Vol de credentials** : Extraient tes tokens API, clés SSH, etc.

### Le Rapport Cisco

Cisco a publié un rapport qualifiant OpenClaw de "cauchemar sécuritaire" (security nightmare). Ils ont même lancé **DefenseClaw**, un outil spécialement conçu pour surveiller et sécuriser les déploiements OpenClaw.

### Les Recommandations Microsoft

Microsoft a publié des guidelines officielles recommandant aux entreprises de "ne pas installer et exécuter OpenClaw avec des comptes de travail ou personnels principaux".

### Les 9 CVE en 4 Jours (Mars 2026)

En mars 2026, 9 CVE (vulnérabilités) ont été publiées en seulement 4 jours, révélant des faiblesses systémiques dans l'architecture d'OpenClaw.

### Leçons pour IntraClaw

Ces problèmes de sécurité nous donnent des leçons cruciales pour la conception d'IntraClaw :

1. **Pas de marketplace public** : On ne télécharge pas de skills de sources inconnues
2. **Pas d'exposition réseau** : IntraClaw reste sur localhost, jamais exposé à internet
3. **Tokens dans .env** : Jamais de credentials dans le code
4. **Audit du code** : Chaque skill est écrite par nous, pas téléchargée
5. **Principe du moindre privilège** : L'agent n'a accès qu'à ce dont il a besoin


## 1.9 — Pourquoi Anthropic a Bloqué OpenClaw

### Ce qui s'est passé

Le 4 avril 2026, Anthropic a officiellement annoncé que les abonnements Claude (Max, Pro, Team) ne couvriraient plus l'utilisation via OpenClaw et les outils tiers.

### Pourquoi ?

Boris Cherny, Head of Claude Code chez Anthropic, a expliqué :

> "Nos abonnements n'ont pas été conçus pour les patterns d'utilisation de ces outils tiers. La capacité est une ressource que nous gérons avec soin et nous priorisons nos clients utilisant nos produits et API."

En d'autres termes : les utilisateurs OpenClaw avec un abonnement Claude Max à $100/mois utilisaient des centaines de dollars de compute, ce qui n'était pas viable financièrement pour Anthropic.

### Les concessions offertes par Anthropic

- Un crédit unique équivalent au coût mensuel de l'abonnement
- Des réductions allant jusqu'à 30% sur l'achat de bundles d'usage supplémentaire
- Délai raccourci : les abonnements ont été éteints le jour même (après une semaine de délai négociée par Peter Steinberger)

### Impact pour Ayman

C'est exactement pourquoi on construit IntraClaw. Ayman a un abonnement Claude Max, mais il ne peut plus l'utiliser avec OpenClaw. Les options :

1. **Payer l'API Claude** : Pay-per-token (plus cher sur le long terme, mais flexible)
2. **Utiliser un autre LLM** : DeepSeek, GPT-4, Gemini, Llama (via Ollama pour du local)
3. **Construire son propre agent** : C'est ce qu'on fait avec IntraClaw, en utilisant l'API Claude directement

---
---
---

# PARTIE 2 : CE QUE LES GENS FONT AVEC OPENCLAW

## 2.1 — Automatisation Business

### Prospection et Cold Emailing

C'est le cas d'usage le plus populaire d'OpenClaw dans le contexte business. Le workflow typique :

1. **Scraping** : L'agent scrape Google Maps, LinkedIn, ou des annuaires sectoriels pour trouver des entreprises cibles
2. **Enrichissement** : Il visite les sites web des entreprises pour trouver les emails des décideurs
3. **CRM** : Il ajoute chaque prospect dans un CRM (Notion, Airtable, ou Google Sheets)
4. **Email personnalisé** : Il rédige un cold email personnalisé pour chaque prospect
5. **Envoi** : Il envoie les emails via Gmail/SMTP
6. **Suivi** : Il surveille les réponses et envoie des follow-ups automatiques
7. **Reporting** : Il compile des statistiques quotidiennes (taux d'envoi, taux d'ouverture, taux de réponse)

**Chiffres typiques rapportés par les utilisateurs :**
- 30-50 cold emails personnalisés par jour
- Taux de réponse de 5-15% (contre 1-3% pour des emails non personnalisés)
- Gain de temps : 3-4 heures/jour économisées

### Gestion CRM Automatisée

Les utilisateurs connectent OpenClaw à Notion ou Airtable pour :
- Créer automatiquement des fiches prospect
- Mettre à jour les statuts (contacté, répondu, meeting planifié, devis envoyé, client)
- Générer des rappels de suivi
- Calculer des metrics de conversion

### Réponse Automatique aux Leads Entrants

Quand un prospect remplit un formulaire de contact ou envoie un email :
- L'agent détecte le nouveau lead
- Il analyse le besoin exprimé
- Il rédige une réponse personnalisée dans les minutes qui suivent
- Il propose des créneaux de meeting (via Calendly ou directement)


## 2.2 — E-commerce

### Gestion des Commandes

- Surveillance des nouvelles commandes (Shopify, WooCommerce)
- Notification au vendeur
- Mise à jour du suivi
- Réponse automatique aux questions sur le statut de livraison

### Gestion des Stocks

- Alertes quand un produit passe sous un seuil
- Commande automatique de réapprovisionnement
- Mise à jour des fiches produit

### Gestion des Avis

- Surveillance des nouveaux avis (Google, Trustpilot, Amazon)
- Réponse automatique aux avis positifs (remerciements)
- Alerte pour les avis négatifs (nécessitent une attention humaine)
- Compilation de rapports sur le sentiment global

### Gestion des Retours

- Traitement automatique des demandes de retour
- Génération des étiquettes de retour
- Suivi du processus de remboursement


## 2.3 — Marketing et Contenu

### Génération de Contenu

L'agent peut :
- Écrire des articles de blog optimisés SEO
- Créer des posts pour LinkedIn, Twitter/X, Instagram
- Rédiger des newsletters
- Produire des scripts vidéo (YouTube, TikTok)

### Le Cas TikTok : 500K Vues en 5 Jours

Un développeur a documenté publiquement comment il a utilisé OpenClaw pour automatiser la création de contenu TikTok :

1. **Setup** : Il a créé un agent appelé "Larry" avec une skill de création de TikTok slideshows
2. **Workflow** : L'agent générait automatiquement des slideshows (texte + images) et les postait sur TikTok via l'API
3. **Résultats en 5 jours** :
   - 500K+ vues cumulées
   - Plusieurs vidéos virales
   - $714/mois en revenus récurrents (via les liens en bio renvoyant vers son app mobile)
4. **Après une semaine** : 8 millions de vues et $671 en MRR (Monthly Recurring Revenue)

Ce cas a été largement documenté et a contribué à la viralité d'OpenClaw.

### Gestion des Réseaux Sociaux

- Publication automatique à heures optimales
- Réponse aux commentaires et DMs
- Curation de contenu (partage d'articles pertinents)
- Analyse des performances (engagement, reach, croissance)

### SEO Automatisé

- Recherche de mots-clés
- Audit SEO de pages existantes
- Suggestions d'optimisation
- Surveillance des positions sur Google
- Analyse des concurrents


## 2.4 — Domotique (Smart Home)

### Home Assistant Integration

Des utilisateurs ont connecté OpenClaw à Home Assistant pour :
- Contrôler les lumières par commande vocale ou texte
- Ajuster le thermostat selon l'heure et la météo
- Surveiller les capteurs (température, humidité, mouvement)
- Automatiser des scénarios complexes ("Quand je dis 'bonne nuit', éteins toutes les lumières, baisse le chauffage à 18°C, et active l'alarme")

### Surveillance

- Alertes quand quelqu'un sonne à la porte
- Notifications sur détection de mouvement
- Résumé quotidien de l'activité du domicile


## 2.5 — Développement

### Résolution de Bugs Automatique

- Surveillance des issues GitHub/GitLab
- Analyse du bug report
- Tentative de reproduction locale
- Proposition d'un fix (pull request automatique)
- Notification au développeur principal

### CI/CD

- Surveillance des builds
- Analyse des erreurs de build
- Suggestions de fix
- Déclenchement de re-builds après fix

### Code Review

- Analyse automatique du code des pull requests
- Suggestions d'amélioration
- Vérification des standards de code
- Détection de vulnérabilités de sécurité basiques


## 2.6 — Cas Concret : Freelancer Command Center

Un freelancer a documenté son setup OpenClaw avec 10 skills spécialisées :

1. **Inbox Manager** : Trie et catégorise les emails entrants
2. **Proposal Writer** : Rédige des propositions commerciales personnalisées
3. **Invoice Tracker** : Surveille les factures impayées et envoie des relances
4. **Time Logger** : Track le temps passé sur chaque projet
5. **Client Reporter** : Génère des rapports d'avancement pour les clients
6. **Social Poster** : Publie du contenu sur LinkedIn pour attirer des clients
7. **Lead Finder** : Scrape les sites de freelance pour trouver des missions
8. **Contract Analyzer** : Analyse les contrats reçus et identifie les clauses problématiques
9. **Meeting Notes** : Transcrit et résume les réunions
10. **Daily Briefing** : Compile un résumé matinal de tout ce qui s'est passé

Ce freelancer a rapporté un gain de productivité de 40% et une augmentation de ses revenus de 25% en 2 mois.


## 2.7 — Lead Generation et Prospection Automatisée

### Le Workflow Complet

```
Google Maps / LinkedIn / Annuaires
         │
         ▼
    [Scraping]
         │
         ▼
    [Enrichissement]
    - Email du décideur
    - Taille entreprise
    - Secteur d'activité
    - Technologies utilisées
         │
         ▼
    [Scoring]
    - Note de 1 à 10
    - Basé sur les critères ICP (Ideal Customer Profile)
         │
         ▼
    [CRM Notion]
    - Fiche prospect créée
    - Statut : "Nouveau"
         │
         ▼
    [Cold Email Séquence]
    - Email 1 : Premier contact (J+0)
    - Email 2 : Follow-up (J+3)
    - Email 3 : Dernier essai (J+7)
         │
         ▼
    [Suivi Réponses]
    - Positif → Pipeline "Intéressé"
    - Négatif → Archivé
    - Pas de réponse → Archivé après 3 emails
```

---
---
---

# PARTIE 3 : CLAUDE AGENT SDK — L'ALTERNATIVE

## 3.1 — C'est Quoi le Claude Agent SDK ?

Le Claude Agent SDK est une bibliothèque officielle d'Anthropic (disponible en Python et TypeScript) qui te permet de construire des agents IA avec la même technologie que Claude Code.

### La Différence entre Claude API et Claude Agent SDK

- **Claude API** : Tu envoies un message, Claude répond. C'est un "question → réponse" simple.
- **Claude Agent SDK** : Tu donnes une tâche, Claude l'exécute en appelant des outils automatiquement, en boucle, jusqu'à ce que la tâche soit terminée.

La magie du SDK, c'est la **boucle agentique** (agent loop) :

```
Tâche donnée par l'utilisateur
         │
         ▼
    ┌──────────┐
    │  Claude   │◄──────────────────┐
    │  "pense"  │                   │
    └────┬─────┘                   │
         │                          │
         ▼                          │
    Décision :                      │
    ├── Appeler un outil ──────────►│ Résultat de l'outil
    ├── Appeler un subagent ───────►│ Résultat du subagent
    └── Répondre à l'utilisateur    │
         │                          │
         ▼                          │
    Tâche terminée                  │
```

Claude décide tout seul quels outils appeler, dans quel ordre, et quand la tâche est terminée. C'est exactement ce que fait OpenClaw, mais en version officielle Anthropic.

### L'Histoire du SDK

- **Mi-2025** : Anthropic lance le "Claude Code SDK" — une version programmatique de Claude Code
- **Septembre 2025** : Renommage en "Claude Agent SDK" quand ils réalisent que le runtime est généraliste, pas spécifique au code
- **Mars 2026** : Version 0.1.48 (Python) et 0.2.71 (TypeScript)


## 3.2 — Installation

### Python

```bash
pip install claude-agent-sdk
```

Pré-requis : Python 3.10+

### TypeScript/Node.js

```bash
npm install @anthropic-ai/claude-agent-sdk
```

Pré-requis : Node.js 18+


## 3.3 — Les Outils Built-In

Le SDK vient avec 10+ outils intégrés que l'agent peut utiliser automatiquement :

| Outil | Description |
|-------|-------------|
| `file_read` | Lire le contenu d'un fichier |
| `file_edit` | Modifier un fichier existant |
| `file_write` | Créer ou réécrire un fichier |
| `bash` | Exécuter des commandes shell |
| `web_search` | Rechercher sur le web |
| `web_fetch` | Récupérer le contenu d'une URL |
| `glob` | Trouver des fichiers par pattern |
| `grep` | Chercher du texte dans des fichiers |
| `notebook_edit` | Modifier des notebooks Jupyter |

Tu peux aussi créer des **outils custom** pour n'importe quoi : appeler des APIs, requêter des bases de données, contrôler un navigateur, etc.


## 3.4 — Exemples de Code

### Exemple 1 : Agent Basique (Python)

```python
from claude_agent_sdk import Agent

# Créer un agent avec un prompt système
agent = Agent(
    model="claude-sonnet-4-6",
    system_prompt="""Tu es IntraClaw, l'assistant IA d'Ayman.
    Tu es direct, efficace, et tu vas droit au but.
    Tu as accès au système de fichiers et au terminal."""
)

# Donner une tâche à l'agent
result = agent.run(
    "Crée un fichier rapport.md avec un résumé des 5 dernières
    nouvelles tech du jour. Recherche sur le web d'abord."
)

print(result)
```

### Exemple 2 : Agent avec Outils Custom (Python)

```python
from claude_agent_sdk import Agent, Tool

# Définir un outil custom
class NotionTool(Tool):
    name = "notion_query"
    description = "Requête la base de données CRM Notion"

    def run(self, query: str) -> str:
        # Appel à l'API Notion
        import requests
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28"
        }
        response = requests.post(
            f"https://api.notion.com/v1/databases/{DB_ID}/query",
            headers=headers,
            json={"filter": query}
        )
        return response.json()

# Créer l'agent avec l'outil custom
agent = Agent(
    model="claude-sonnet-4-6",
    tools=[NotionTool()],
    system_prompt="Tu es IntraClaw. Tu gères le CRM Notion d'Ayman."
)

result = agent.run(
    "Combien de prospects ont le statut 'Intéressé' dans le CRM ?"
)
```

### Exemple 3 : Subagents pour Parallélisation (Python)

```python
from claude_agent_sdk import Agent

# Agent principal qui délègue
main_agent = Agent(
    model="claude-sonnet-4-6",
    system_prompt="""Tu es IntraClaw, l'agent principal.
    Tu peux déléguer des sous-tâches à des subagents spécialisés.
    - Subagent "prospection" pour la recherche de prospects
    - Subagent "content" pour la création de contenu
    - Subagent "reporting" pour les rapports"""
)

# Les subagents tournent en parallèle
result = main_agent.run(
    "Fais les 3 tâches suivantes en parallèle :
    1. Trouve 10 agences web à Bruxelles sur Google Maps
    2. Écris un post LinkedIn sur les tendances IA 2026
    3. Compile le rapport de la semaine depuis le CRM"
)
```


## 3.5 — Pricing du Claude Agent SDK

Le Claude Agent SDK utilise la même tarification que l'API Claude standard. Pas d'abonnement — tu paies par token.

### Tarifs Actuels (Avril 2026)

| Modèle | Input (par M tokens) | Output (par M tokens) | Contexte |
|--------|---------------------|----------------------|----------|
| Claude Haiku 4.5 | $1 | $5 | 200K |
| Claude Sonnet 4.6 | $3 | $15 | 1M |
| Claude Opus 4.6 | $5 | $25 | 1M |

### Réductions disponibles

- **Batch API** : -50% sur tous les tokens (pour les tâches non-urgentes)
- **Prompt Caching** : -90% sur les inputs répétés
- **Combiné** : Jusqu'à -95% de réduction

### Estimation pour IntraClaw

En utilisant Claude Sonnet 4.6 (bon rapport qualité/prix) :

- **Prospection quotidienne** (30 emails) : environ 50K tokens input + 30K output = environ $0.60/jour
- **Contenu quotidien** (1 post) : environ 20K tokens = environ $0.36/jour
- **Reporting** : environ 30K tokens = environ $0.54/jour
- **Interactions diverses** : environ 20K tokens = environ $0.36/jour

**Total estimé : $1.86/jour soit environ $56/mois**

Avec prompt caching activé, on peut réduire à environ **$20-30/mois**.


## 3.6 — MCP (Model Context Protocol)

Le SDK supporte nativement le MCP, le protocole de connexion aux outils externes d'Anthropic. Il y a 50+ serveurs MCP officiels disponibles :

- **Notion MCP** : Lire/écrire dans Notion
- **Gmail MCP** : Gérer les emails
- **Slack MCP** : Envoyer des messages Slack
- **GitHub MCP** : Gérer les repos
- **Google Calendar MCP** : Gérer l'agenda
- **Supabase MCP** : Gérer les bases de données
- Et bien d'autres...

Pour IntraClaw, les MCP les plus utiles seront : Notion, Gmail, et potentiellement Google Calendar.


## 3.7 — Sessions et Persistance

Le SDK gère les sessions de conversation. Chaque session a un historique qui peut être sauvegardé et rechargé. Combiné avec notre système de fichiers Markdown (inspiré d'OpenClaw), ça nous donne une mémoire persistante complète.

### Différence avec OpenClaw

| Aspect | OpenClaw | Claude Agent SDK |
|--------|----------|-----------------|
| Mémoire | Fichiers MD natifs | À implémenter soi-même |
| Channels | 20+ intégrés | À implémenter soi-même |
| Gateway | WebSocket built-in | À implémenter soi-même |
| Heartbeat | Built-in (30 min) | À implémenter soi-même |
| Skills | Marketplace (ClawHub) | Custom uniquement |
| Sécurité | Problématique | Sous notre contrôle total |
| Coût | Abonnement Claude (bloqué) | Pay-per-token API |
| Complexité | Clé en main | Plus de travail initial |

---
---
---

# PARTIE 4 : LE PLAN INTRACLAW — ARCHITECTURE COMPLÈTE

## 4.1 — Vision Globale

IntraClaw est un agent IA autonome personnel, conçu spécifiquement pour les besoins d'Ayman. Contrairement à OpenClaw qui essaie d'être universel, IntraClaw est **sur mesure**.

### Objectifs Prioritaires

1. **Prospection automatique** : Trouver des clients B2B pour le freelancing d'Ayman
2. **Cold emailing** : Envoyer des emails de prospection personnalisés
3. **CRM automatisé** : Gérer le pipeline de vente dans Notion
4. **Contenu HaiSkills** : Générer du contenu éducatif pour la plateforme
5. **Reporting quotidien** : Compiler et envoyer un rapport quotidien
6. **Mémoire permanente** : Ne jamais perdre d'informations

### Ce qu'IntraClaw ne fait PAS (v1)

- Pas de channels multiples (pas de WhatsApp, Telegram, etc. en v1)
- Pas de marketplace de skills
- Pas de GUI web (tout est en CLI + fichiers)
- Pas de multi-utilisateur (c'est pour Ayman uniquement)
- Pas de domotique


## 4.2 — Choix Techniques

### Langage : TypeScript

**Pourquoi TypeScript plutôt que Python ?**

1. **OpenClaw est en TypeScript** — On peut s'inspirer directement du code
2. **Node.js est excellent pour l'asynchrone** — Idéal pour gérer plusieurs tâches en parallèle (emails, scraping, API calls)
3. **npm a les meilleures librairies pour nos besoins** :
   - Puppeteer/Playwright pour le browser control
   - Baileys pour WhatsApp (v2)
   - node-cron pour le scheduling
   - Nodemailer pour les emails
4. **TypeScript = JavaScript typé** — Moins de bugs, meilleur DX
5. **Le Claude Agent SDK a une version TypeScript** — On peut l'intégrer si besoin

### Runtime : Node.js 20+

Node.js est le runtime JavaScript côté serveur. Version 20+ pour le support natif des dernières features ES.

### Base de données : Fichiers Markdown + SQLite

- **Fichiers Markdown** : Pour la mémoire de l'agent (SOUL.md, MEMORY.md, etc.) — lisibles par l'humain ET par l'IA
- **SQLite** : Pour les données structurées (liste de prospects, emails envoyés, logs) — rapide, léger, pas de serveur

### API LLM : Claude API (Anthropic)

On utilise l'API Claude directement, en mode pay-per-token. Modèle principal : Claude Sonnet 4.6 (meilleur rapport qualité/prix).

### Emails : Gmail API (OAuth2) + Nodemailer

- **Gmail API** : Pour lire les emails, surveiller les réponses
- **Nodemailer** : Pour envoyer les cold emails (plus de contrôle sur le format)

### CRM : Notion API

L'API officielle de Notion pour gérer les bases de données de prospects.

### Scraping : Puppeteer

Puppeteer pour contrôler Chrome headless et scraper Google Maps.

### Scheduling : node-cron

Pour exécuter des tâches à intervalles réguliers (comme le heartbeat d'OpenClaw).

### WhatsApp (v2) : Baileys

Pour la version 2, on ajoutera un canal WhatsApp via Baileys.


## 4.3 — Architecture Détaillée

### Structure du Projet

```
intraclaw/
├── src/
│   ├── index.ts                    # Point d'entrée principal
│   ├── agent/
│   │   ├── agent.ts                # Classe Agent principale
│   │   ├── llm.ts                  # Client API Claude
│   │   ├── tools.ts                # Registre des outils
│   │   └── prompt-builder.ts       # Construction des prompts
│   ├── memory/
│   │   ├── memory-manager.ts       # Gestion de la mémoire
│   │   ├── file-store.ts           # Lecture/écriture des fichiers MD
│   │   ├── daily-notes.ts          # Notes journalières
│   │   └── compactor.ts            # Compaction de la mémoire ancienne
│   ├── scheduler/
│   │   ├── scheduler.ts            # Orchestrateur cron
│   │   ├── heartbeat.ts            # Lecteur du HEARTBEAT.md
│   │   └── task-queue.ts           # File d'attente des tâches
│   ├── modules/
│   │   ├── prospection/
│   │   │   ├── google-maps-scraper.ts
│   │   │   ├── email-finder.ts
│   │   │   ├── prospect-enricher.ts
│   │   │   └── scoring.ts
│   │   ├── email/
│   │   │   ├── gmail-client.ts
│   │   │   ├── cold-email-sender.ts
│   │   │   ├── sequence-manager.ts
│   │   │   ├── reply-tracker.ts
│   │   │   └── templates/
│   │   │       ├── first-touch.md
│   │   │       ├── follow-up-1.md
│   │   │       └── follow-up-2.md
│   │   ├── content/
│   │   │   ├── content-generator.ts
│   │   │   ├── notion-publisher.ts
│   │   │   └── content-pipeline.ts
│   │   ├── crm/
│   │   │   ├── notion-crm.ts
│   │   │   ├── pipeline-manager.ts
│   │   │   └── metrics.ts
│   │   └── reporting/
│   │       ├── daily-report.ts
│   │       ├── weekly-report.ts
│   │       └── report-sender.ts
│   ├── skills/
│   │   ├── skill-loader.ts
│   │   └── skill-runner.ts
│   ├── db/
│   │   ├── sqlite.ts               # Client SQLite
│   │   ├── migrations/             # Migrations de schéma
│   │   └── schema.sql              # Schéma initial
│   ├── utils/
│   │   ├── logger.ts               # Système de logging
│   │   ├── config.ts               # Chargement de la config
│   │   ├── retry.ts                # Retry avec backoff exponentiel
│   │   └── rate-limiter.ts         # Rate limiting
│   └── types/
│       ├── prospect.ts
│       ├── email.ts
│       ├── task.ts
│       └── report.ts
├── workspace/
│   ├── SOUL.md
│   ├── USER.md
│   ├── MEMORY.md
│   ├── HEARTBEAT.md
│   ├── AGENTS.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   ├── BOOTSTRAP.md
│   └── memory/                     # Notes journalières
│       └── 2026-04-04.md
├── skills/
│   ├── cold-email/
│   │   └── SKILL.md
│   ├── google-maps-scraper/
│   │   └── SKILL.md
│   ├── content-haiskills/
│   │   └── SKILL.md
│   └── daily-report/
│       └── SKILL.md
├── data/
│   └── intraclaw.db                # Base SQLite
├── logs/
│   └── intraclaw.log
├── .env                            # Variables d'environnement (JAMAIS commit)
├── .env.example                    # Exemple de .env
├── package.json
├── tsconfig.json
├── README.md
└── Makefile                        # Commandes raccourcies
```

### Flux de Données Principal

```
                    ┌─────────────────────┐
                    │    SCHEDULER        │
                    │  (node-cron)        │
                    │                     │
                    │  Lit HEARTBEAT.md   │
                    │  toutes les 30 min  │
                    └─────────┬───────────┘
                              │
                              │ Déclenche
                              ▼
┌─────────────────────────────────────────────────┐
│                 AGENT PRINCIPAL                   │
│                                                   │
│  1. Charge la mémoire (SOUL + USER + MEMORY)     │
│  2. Lit la tâche à exécuter                       │
│  3. Construit le prompt                           │
│  4. Appelle Claude API                            │
│  5. Exécute les actions (tools)                   │
│  6. Sauvegarde en mémoire                         │
│  7. Passe à la tâche suivante                     │
└─────────┬──────────┬──────────┬─────────┬────────┘
          │          │          │         │
          ▼          ▼          ▼         ▼
     ┌────────┐ ┌────────┐ ┌───────┐ ┌────────┐
     │Prospect│ │ Email  │ │Content│ │Report  │
     │Module  │ │Module  │ │Module │ │Module  │
     └───┬────┘ └───┬────┘ └───┬───┘ └───┬────┘
         │          │          │         │
         ▼          ▼          ▼         ▼
    ┌─────────┐ ┌────────┐ ┌───────┐ ┌───────┐
    │Google   │ │Gmail   │ │Notion │ │Gmail/ │
    │Maps     │ │API     │ │API    │ │WA     │
    │(Puppet.)│ │        │ │       │ │       │
    └─────────┘ └────────┘ └───────┘ └───────┘
```


## 4.4 — Module Prospection Auto

### 4.4.1 — Google Maps Scraper

Le scraper Google Maps est le point d'entrée du pipeline de prospection.

**Workflow détaillé :**

```
Input : "agences web Bruxelles"
         │
         ▼
[1. Lancer Puppeteer en mode headless]
         │
         ▼
[2. Naviguer vers Google Maps]
   URL: https://www.google.com/maps/search/agences+web+Bruxelles
         │
         ▼
[3. Scroll pour charger plus de résultats]
   - Scroll 5-10 fois dans le panel latéral
   - Attente aléatoire entre chaque scroll (2-5 sec)
         │
         ▼
[4. Extraire les données de chaque fiche]
   Pour chaque résultat :
   - Nom de l'entreprise
   - Adresse
   - Numéro de téléphone
   - Site web
   - Note Google (étoiles)
   - Nombre d'avis
   - Catégorie
   - Horaires d'ouverture
         │
         ▼
[5. Pour chaque entreprise avec un site web :]
   - Visiter le site web
   - Chercher une page "Contact", "About", ou "Team"
   - Extraire les emails (regex sur la page)
   - Chercher les noms des fondateurs/managers
         │
         ▼
[6. Enrichissement]
   - Vérifier la validité des emails (format + MX check)
   - Estimer la taille de l'entreprise
   - Détecter les technologies utilisées (BuiltWith-style)
         │
         ▼
[7. Scoring]
   Score de 1 à 10 basé sur :
   - A un site web ? (+2)
   - Site web récent (< 2 ans) ? (+1)
   - Utilise des techs modernes (React, Next.js) ? (+1)
   - Note Google > 4 étoiles ? (+1)
   - > 20 avis ? (+1)
   - Email du décideur trouvé ? (+2)
   - Localisation Bruxelles centre ? (+1)
   - Moins de 50 employés ? (+1)
         │
         ▼
[8. Sauvegarde dans SQLite + Notion CRM]
   - Fiche prospect créée
   - Statut : "Nouveau"
   - Score : X/10
```

**Code simplifié du scraper :**

```typescript
// src/modules/prospection/google-maps-scraper.ts

import puppeteer from 'puppeteer';
import { ProspectRepository } from '../../db/prospect-repository';
import { NotionCRM } from '../crm/notion-crm';
import { Logger } from '../../utils/logger';
import { delay, randomDelay } from '../../utils/helpers';

interface ScrapedBusiness {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  category: string;
}

export class GoogleMapsScraper {
  private browser: puppeteer.Browser | null = null;
  private logger = new Logger('GoogleMapsScraper');

  async scrape(query: string, maxResults: number = 50): Promise<ScrapedBusiness[]> {
    this.logger.info(`Démarrage du scraping: "${query}" (max: ${maxResults})`);

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--lang=fr-FR'
      ]
    });

    try {
      const page = await this.browser.newPage();

      // User-Agent aléatoire pour éviter la détection
      await page.setUserAgent(this.getRandomUserAgent());

      // Viewport réaliste
      await page.setViewport({ width: 1366, height: 768 });

      // Navigation vers Google Maps
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Accepter les cookies si demandé
      await this.acceptCookies(page);

      // Attendre le chargement des résultats
      await page.waitForSelector('[role="feed"]', { timeout: 10000 });

      // Scroll pour charger plus de résultats
      const results = await this.scrollAndExtract(page, maxResults);

      this.logger.info(`${results.length} entreprises trouvées`);
      return results;

    } finally {
      await this.browser.close();
    }
  }

  private async scrollAndExtract(
    page: puppeteer.Page,
    maxResults: number
  ): Promise<ScrapedBusiness[]> {
    const businesses: ScrapedBusiness[] = [];
    let previousCount = 0;
    let scrollAttempts = 0;

    while (businesses.length < maxResults && scrollAttempts < 20) {
      // Extraire les résultats visibles
      const newBusinesses = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="feed"] > div');
        return Array.from(items).map(item => {
          const nameEl = item.querySelector('.fontHeadlineSmall');
          const ratingEl = item.querySelector('.MW4etd');
          const reviewEl = item.querySelector('.UY7F9');
          // ... extraction des données
          return {
            name: nameEl?.textContent || '',
            // ... autres champs
          };
        }).filter(b => b.name);
      });

      // Ajouter les nouveaux résultats
      for (const biz of newBusinesses) {
        if (!businesses.find(b => b.name === biz.name)) {
          businesses.push(biz as ScrapedBusiness);
        }
      }

      // Vérifier si on a atteint la fin
      if (businesses.length === previousCount) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }
      previousCount = businesses.length;

      // Scroll vers le bas avec délai aléatoire
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
      });

      // Délai aléatoire entre 2 et 5 secondes
      await randomDelay(2000, 5000);
    }

    return businesses.slice(0, maxResults);
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...',
      // ... plus de user agents
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private async acceptCookies(page: puppeteer.Page): Promise<void> {
    try {
      const consentButton = await page.$('button[aria-label*="Accept"]');
      if (consentButton) {
        await consentButton.click();
        await delay(1000);
      }
    } catch {
      // Pas de popup de cookies, on continue
    }
  }
}
```

### 4.4.2 — Email Finder

Une fois qu'on a les sites web des entreprises, on cherche les emails.

```typescript
// src/modules/prospection/email-finder.ts

import puppeteer from 'puppeteer';

export class EmailFinder {
  private emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  async findEmails(website: string): Promise<string[]> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const emails = new Set<string>();

    try {
      // Pages à vérifier
      const pagesToCheck = [
        website,
        `${website}/contact`,
        `${website}/about`,
        `${website}/team`,
        `${website}/a-propos`,
        `${website}/nous-contacter`,
        `${website}/equipe`,
        `${website}/impressum`,
      ];

      for (const url of pagesToCheck) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const content = await page.content();

          // Extraire les emails du HTML
          const found = content.match(this.emailRegex) || [];
          found.forEach(email => {
            // Filtrer les faux positifs
            if (!email.includes('example.com') &&
                !email.includes('wixpress.com') &&
                !email.includes('sentry.io') &&
                !email.endsWith('.png') &&
                !email.endsWith('.jpg')) {
              emails.add(email.toLowerCase());
            }
          });

          // Chercher aussi dans les liens mailto:
          const mailtoLinks = await page.$$eval(
            'a[href^="mailto:"]',
            links => links.map(l => l.getAttribute('href')?.replace('mailto:', '') || '')
          );
          mailtoLinks.forEach(e => { if (e) emails.add(e.toLowerCase()); });

        } catch {
          // Page non accessible, on passe à la suivante
          continue;
        }
      }

    } finally {
      await browser.close();
    }

    return Array.from(emails);
  }

  // Vérification basique de la validité d'un email
  async verifyEmail(email: string): Promise<boolean> {
    const domain = email.split('@')[1];

    // Vérifier que le domaine a des records MX
    try {
      const dns = require('dns').promises;
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords.length > 0;
    } catch {
      return false;
    }
  }
}
```

### 4.4.3 — Prospect Scoring

```typescript
// src/modules/prospection/scoring.ts

interface ProspectData {
  name: string;
  website: string;
  email: string | null;
  rating: number;
  reviewCount: number;
  hasModernTech: boolean;
  employeeEstimate: number;
  location: string;
}

export class ProspectScorer {
  score(prospect: ProspectData): number {
    let score = 0;

    // A un site web (+2)
    if (prospect.website) score += 2;

    // Email du décideur trouvé (+2)
    if (prospect.email) score += 2;

    // Bonne note Google (+1)
    if (prospect.rating >= 4.0) score += 1;

    // Nombre d'avis significatif (+1)
    if (prospect.reviewCount >= 20) score += 1;

    // Technologies modernes (+1)
    if (prospect.hasModernTech) score += 1;

    // Taille PME (+1)
    if (prospect.employeeEstimate > 2 && prospect.employeeEstimate < 50) score += 1;

    // Localisation Bruxelles (+1)
    if (prospect.location.toLowerCase().includes('bruxelles') ||
        prospect.location.toLowerCase().includes('brussels')) score += 1;

    return Math.min(score, 10);
  }
}
```


## 4.5 — Module Email (Cold Emailing)

### 4.5.1 — Séquence d'Emails

La séquence standard est en 3 touches :

**Email 1 — Premier Contact (J+0)**

```markdown
Objet : [Prénom], une question rapide sur [Entreprise]

Bonjour [Prénom],

Je suis tombé sur [Entreprise] en cherchant des [type d'entreprise]
à Bruxelles, et j'ai été impressionné par [élément spécifique — site,
projet, avis client].

J'aide les [type d'entreprise] à [bénéfice concret] grâce à
[service]. Par exemple, [résultat concret obtenu pour un client
similaire].

Est-ce que ça vaudrait le coup d'en discuter 15 minutes cette
semaine ?

Bonne journée,
Ayman
Fondateur — HaiSkills
```

**Email 2 — Follow-up (J+3)**

```markdown
Objet : Re: [Prénom], une question rapide sur [Entreprise]

Bonjour [Prénom],

Je me permets de revenir vers vous — je comprends que les journées
sont chargées.

En une phrase : je peux [bénéfice principal] pour [Entreprise],
comme je l'ai fait pour [nom client ou secteur similaire].

Un créneau de 10 minutes cette semaine ?

Ayman
```

**Email 3 — Dernier Essai (J+7)**

```markdown
Objet : Re: [Prénom], une question rapide sur [Entreprise]

Bonjour [Prénom],

Dernier message — si ce n'est pas le bon moment, je comprends
tout à fait.

Si jamais [bénéfice] vous intéresse à l'avenir, n'hésitez pas
à me répondre. Je serai là.

Bonne continuation,
Ayman
```

### 4.5.2 — Sequence Manager

```typescript
// src/modules/email/sequence-manager.ts

import { GmailClient } from './gmail-client';
import { NotionCRM } from '../crm/notion-crm';
import { Logger } from '../../utils/logger';
import { delay } from '../../utils/helpers';

interface EmailSequenceStep {
  templateName: string;
  delayDays: number;
  subject: string;
}

export class SequenceManager {
  private logger = new Logger('SequenceManager');
  private gmail: GmailClient;
  private crm: NotionCRM;

  private sequence: EmailSequenceStep[] = [
    { templateName: 'first-touch', delayDays: 0, subject: '{firstName}, une question rapide sur {company}' },
    { templateName: 'follow-up-1', delayDays: 3, subject: 'Re: {firstName}, une question rapide sur {company}' },
    { templateName: 'follow-up-2', delayDays: 7, subject: 'Re: {firstName}, une question rapide sur {company}' },
  ];

  constructor(gmail: GmailClient, crm: NotionCRM) {
    this.gmail = gmail;
    this.crm = crm;
  }

  async processDaily(): Promise<void> {
    this.logger.info('Début du traitement quotidien des séquences email');

    // 1. Récupérer les prospects à contacter aujourd'hui
    const prospectsToContact = await this.crm.getProspectsForToday();

    // 2. Pour chaque prospect, déterminer l'étape de la séquence
    for (const prospect of prospectsToContact) {
      const step = this.getNextStep(prospect);
      if (!step) {
        this.logger.info(`${prospect.name}: séquence terminée`);
        continue;
      }

      // 3. Charger et personnaliser le template
      const template = await this.loadTemplate(step.templateName);
      const personalizedEmail = this.personalizeTemplate(template, prospect);

      // 4. Envoyer l'email
      try {
        await this.gmail.send({
          to: prospect.email,
          subject: this.personalizeSubject(step.subject, prospect),
          body: personalizedEmail,
        });

        // 5. Mettre à jour le CRM
        await this.crm.updateProspect(prospect.id, {
          lastEmailSent: new Date().toISOString(),
          emailStep: step.templateName,
          status: `Email ${this.getStepNumber(step)} envoyé`,
        });

        this.logger.info(`Email envoyé à ${prospect.name} (${step.templateName})`);

        // 6. Attendre entre les envois (anti-spam)
        await delay(120000 + Math.random() * 60000); // 2-3 minutes

      } catch (error) {
        this.logger.error(`Erreur envoi email à ${prospect.name}: ${error}`);
      }
    }

    this.logger.info('Traitement quotidien terminé');
  }

  private getNextStep(prospect: any): EmailSequenceStep | null {
    // Logique pour déterminer quelle étape envoyer
    if (!prospect.lastEmailSent) return this.sequence[0];

    const daysSinceLastEmail = this.daysBetween(
      new Date(prospect.lastEmailSent), new Date()
    );

    const currentStepIndex = this.sequence.findIndex(
      s => s.templateName === prospect.emailStep
    );

    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex >= this.sequence.length) return null;

    const nextStep = this.sequence[nextStepIndex];
    if (daysSinceLastEmail >= nextStep.delayDays) return nextStep;

    return null; // Pas encore le moment
  }

  private personalizeTemplate(template: string, prospect: any): string {
    return template
      .replace(/{firstName}/g, prospect.firstName)
      .replace(/{company}/g, prospect.company)
      .replace(/{specificDetail}/g, prospect.specificDetail || '')
      .replace(/{service}/g, 'développement web et automatisation');
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diff = date2.getTime() - date1.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private getStepNumber(step: EmailSequenceStep): number {
    return this.sequence.indexOf(step) + 1;
  }

  private personalizeSubject(subject: string, prospect: any): string {
    return subject
      .replace(/{firstName}/g, prospect.firstName)
      .replace(/{company}/g, prospect.company);
  }

  private async loadTemplate(name: string): Promise<string> {
    const fs = require('fs').promises;
    return fs.readFile(`src/modules/email/templates/${name}.md`, 'utf-8');
  }
}
```

### 4.5.3 — Gmail Client

```typescript
// src/modules/email/gmail-client.ts

import { google } from 'googleapis';
import { Logger } from '../../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export class GmailClient {
  private gmail: any;
  private logger = new Logger('GmailClient');

  async initialize(): Promise<void> {
    const auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'http://localhost:3000/oauth/callback'
    );

    auth.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    this.gmail = google.gmail({ version: 'v1', auth });
    this.logger.info('Gmail client initialisé');
  }

  async send(options: EmailOptions): Promise<void> {
    const rawMessage = this.createRawMessage(options);

    await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    this.logger.info(`Email envoyé à ${options.to}: ${options.subject}`);
  }

  async getUnreadReplies(since: Date): Promise<any[]> {
    const query = `is:unread after:${this.formatDate(since)} in:inbox`;

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    const messages = response.data.messages || [];
    const fullMessages = [];

    for (const msg of messages) {
      const full = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
      });
      fullMessages.push(full.data);
    }

    return fullMessages;
  }

  private createRawMessage(options: EmailOptions): string {
    const email = [
      `To: ${options.to}`,
      `From: ${process.env.GMAIL_FROM_EMAIL}`,
      `Subject: ${options.subject}`,
      options.cc ? `Cc: ${options.cc}` : '',
      'Content-Type: text/plain; charset=utf-8',
      '',
      options.body,
    ].filter(Boolean).join('\r\n');

    return Buffer.from(email).toString('base64url');
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '/');
  }
}
```


## 4.6 — Module Content Auto (HaiSkills)

### 4.6.1 — Content Pipeline

Le module content suit ce workflow :

```
[1. Notion Content Pipeline]
   Base de données avec les sujets planifiés
   Colonnes : Titre, Thème, Statut, Date prévue, Plateforme
         │
         ▼
[2. Sélection du sujet du jour]
   L'agent choisit le prochain sujet "À écrire"
         │
         ▼
[3. Génération via Claude API]
   Prompt personnalisé avec :
   - Le thème
   - Le ton HaiSkills (éducatif, accessible, concret)
   - La longueur cible (500-800 mots)
   - Le format (article, post LinkedIn, thread Twitter)
         │
         ▼
[4. Sauvegarde dans Notion]
   - Contenu ajouté à la page Notion
   - Statut → "Draft"
   - Notification à Ayman pour review
         │
         ▼
[5. Review manuelle par Ayman]
   Ayman lit, corrige si nécessaire, valide
         │
         ▼
[6. Publication]
   (v1 : manuelle par Ayman)
   (v2 : automatique via Buffer API ou API native)
```

### 4.6.2 — Content Generator

```typescript
// src/modules/content/content-generator.ts

import { ClaudeClient } from '../../agent/llm';
import { Logger } from '../../utils/logger';

interface ContentRequest {
  title: string;
  theme: string;
  platform: 'linkedin' | 'blog' | 'twitter' | 'instagram';
  targetLength: number; // en mots
  keywords?: string[];
}

interface GeneratedContent {
  title: string;
  body: string;
  hashtags: string[];
  summary: string;
}

export class ContentGenerator {
  private claude: ClaudeClient;
  private logger = new Logger('ContentGenerator');

  constructor(claude: ClaudeClient) {
    this.claude = claude;
  }

  async generate(request: ContentRequest): Promise<GeneratedContent> {
    this.logger.info(`Génération de contenu: "${request.title}" pour ${request.platform}`);

    const systemPrompt = `Tu es le rédacteur de contenu pour HaiSkills,
    une plateforme de formation en IA et cybersécurité fondée par Ayman.

    Ton style :
    - Éducatif mais accessible (pas de jargon inutile)
    - Concret avec des exemples pratiques
    - Engageant (pose des questions, utilise des analogies)
    - Professionnel mais pas ennuyeux
    - En français

    Format pour ${request.platform} :
    ${this.getFormatInstructions(request.platform)}`;

    const userPrompt = `Écris un ${this.getContentType(request.platform)}
    sur le thème "${request.theme}" avec le titre "${request.title}".

    Longueur cible : ${request.targetLength} mots.
    ${request.keywords ? `Mots-clés à inclure naturellement : ${request.keywords.join(', ')}` : ''}

    Fournis aussi :
    - 5-7 hashtags pertinents
    - Un résumé en 1 phrase`;

    const response = await this.claude.chat(systemPrompt, userPrompt);

    // Parser la réponse pour extraire le contenu, hashtags, et résumé
    return this.parseResponse(response, request.title);
  }

  private getFormatInstructions(platform: string): string {
    switch (platform) {
      case 'linkedin':
        return `Post LinkedIn :
        - Commence par un hook accrocheur (1-2 lignes max)
        - Sauts de ligne fréquents (1 idée par paragraphe)
        - Maximum 1300 caractères (environ 200 mots)
        - Termine par un call-to-action ou une question
        - PAS de liens dans le post (l'algo LinkedIn pénalise)`;

      case 'blog':
        return `Article de blog :
        - Introduction engageante
        - Sous-titres clairs (H2, H3)
        - 500-800 mots
        - Exemples concrets
        - Conclusion avec call-to-action`;

      case 'twitter':
        return `Thread Twitter/X :
        - Premier tweet = hook viral
        - 5-8 tweets max
        - Chaque tweet fait une idée
        - Dernier tweet = CTA + résumé`;

      case 'instagram':
        return `Carrousel Instagram :
        - Slide 1 : Titre accrocheur
        - Slides 2-8 : Un point par slide
        - Slide finale : CTA + logo HaiSkills
        - Texte court, impactant`;

      default:
        return '';
    }
  }

  private getContentType(platform: string): string {
    const types: Record<string, string> = {
      linkedin: 'post LinkedIn',
      blog: 'article de blog',
      twitter: 'thread Twitter',
      instagram: 'texte pour carrousel Instagram',
    };
    return types[platform] || 'contenu';
  }

  private parseResponse(response: string, title: string): GeneratedContent {
    // Parsing simplifié — en production, on utiliserait
    // un format structuré (JSON mode de Claude)
    const hashtagMatch = response.match(/#\w+/g) || [];
    return {
      title,
      body: response,
      hashtags: hashtagMatch.slice(0, 7),
      summary: response.split('\n')[0] || title,
    };
  }
}
```


## 4.7 — Module Reporting

### 4.7.1 — Rapport Quotidien

Chaque soir à 20h, l'agent compile un rapport avec :

```markdown
# Rapport IntraClaw — 4 avril 2026

## Prospection
- Emails envoyés aujourd'hui : 28
- Nouveaux prospects ajoutés : 12
- Réponses reçues : 3 (1 positif, 1 question, 1 négatif)
- Taux de réponse cumulé : 8.2%

## Pipeline CRM
- Prospects total : 234
- À contacter : 45
- Email envoyé : 112
- Intéressé : 18
- Meeting planifié : 5
- Devis envoyé : 3
- Client : 1

## Contenu HaiSkills
- Post LinkedIn publié : "5 outils IA gratuits en 2026"
- Engagement : [en attente — données demain]

## Actions requises (pour Ayman)
- Répondre au prospect "Digital Wave" (intéressé par un site web)
- Valider le brouillon de post pour demain
- Confirmer le meeting avec "TechStart" jeudi 10h

## Statistiques techniques
- Tokens Claude consommés : 142K (coût estimé : $1.84)
- Erreurs : 0
- Uptime : 100%
```

### 4.7.2 — Report Builder

```typescript
// src/modules/reporting/daily-report.ts

import { NotionCRM } from '../crm/notion-crm';
import { GmailClient } from '../email/gmail-client';
import { ClaudeClient } from '../../agent/llm';
import { MemoryManager } from '../../memory/memory-manager';
import { Logger } from '../../utils/logger';

export class DailyReportBuilder {
  private crm: NotionCRM;
  private gmail: GmailClient;
  private claude: ClaudeClient;
  private memory: MemoryManager;
  private logger = new Logger('DailyReport');

  constructor(crm: NotionCRM, gmail: GmailClient, claude: ClaudeClient, memory: MemoryManager) {
    this.crm = crm;
    this.gmail = gmail;
    this.claude = claude;
    this.memory = memory;
  }

  async build(): Promise<string> {
    this.logger.info('Construction du rapport quotidien...');

    // 1. Récupérer les metrics du CRM
    const crmMetrics = await this.crm.getDailyMetrics();

    // 2. Récupérer les stats email
    const emailStats = await this.getEmailStats();

    // 3. Récupérer les notes de la journée
    const dailyNotes = await this.memory.getTodayNotes();

    // 4. Demander à Claude de compiler le rapport
    const report = await this.claude.chat(
      `Tu es IntraClaw. Compile un rapport quotidien concis et actionnable
      à partir des données suivantes. Format Markdown.
      Mets en avant les actions requises par Ayman.`,
      `
      Données CRM : ${JSON.stringify(crmMetrics)}
      Stats emails : ${JSON.stringify(emailStats)}
      Notes du jour : ${dailyNotes}
      Date : ${new Date().toISOString().split('T')[0]}
      `
    );

    // 5. Sauvegarder le rapport
    await this.memory.saveDailyReport(report);

    return report;
  }

  async sendReport(report: string, method: 'email' | 'whatsapp' = 'email'): Promise<void> {
    if (method === 'email') {
      await this.gmail.send({
        to: process.env.AYMAN_EMAIL!,
        subject: `Rapport IntraClaw — ${new Date().toLocaleDateString('fr-FR')}`,
        body: report,
      });
      this.logger.info('Rapport envoyé par email');
    }
    // WhatsApp sera ajouté en v2
  }

  private async getEmailStats(): Promise<object> {
    // Statistiques des emails envoyés/reçus aujourd'hui
    const sent = await this.gmail.getSentToday();
    const replies = await this.gmail.getRepliesToday();
    return {
      sent: sent.length,
      replies: replies.length,
      positive: replies.filter((r: any) => r.sentiment === 'positive').length,
      negative: replies.filter((r: any) => r.sentiment === 'negative').length,
    };
  }
}
```


## 4.8 — Scheduler / Heartbeat

### 4.8.1 — Implémentation

```typescript
// src/scheduler/scheduler.ts

import * as cron from 'node-cron';
import { HeartbeatReader } from './heartbeat';
import { Agent } from '../agent/agent';
import { Logger } from '../utils/logger';

interface ScheduledTask {
  cronExpression: string;
  description: string;
  handler: () => Promise<void>;
}

export class Scheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private heartbeat: HeartbeatReader;
  private agent: Agent;
  private logger = new Logger('Scheduler');

  constructor(agent: Agent) {
    this.agent = agent;
    this.heartbeat = new HeartbeatReader();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initialisation du scheduler...');

    // Tâche principale : lire le HEARTBEAT.md toutes les 30 minutes
    this.schedule('heartbeat', '*/30 * * * *', async () => {
      this.logger.info('Heartbeat check...');
      const tasks = await this.heartbeat.readPendingTasks();
      for (const task of tasks) {
        await this.agent.executeTask(task);
      }
    });

    // Prospection quotidienne (lundi 9h)
    this.schedule('weekly-prospection', '0 9 * * 1', async () => {
      this.logger.info('Lancement prospection hebdomadaire');
      await this.agent.executeTask({
        type: 'prospection',
        description: 'Scraper 50 nouveaux prospects sur Google Maps',
      });
    });

    // Emails quotidiens (12h, du lundi au vendredi)
    this.schedule('daily-emails', '0 12 * * 1-5', async () => {
      this.logger.info('Envoi des cold emails quotidiens');
      await this.agent.executeTask({
        type: 'email',
        description: 'Traiter les séquences email du jour',
      });
    });

    // Vérification des réponses (8h et 14h)
    this.schedule('check-replies-morning', '0 8 * * 1-5', async () => {
      await this.agent.executeTask({
        type: 'email',
        description: 'Vérifier les nouvelles réponses aux emails',
      });
    });

    this.schedule('check-replies-afternoon', '0 14 * * 1-5', async () => {
      await this.agent.executeTask({
        type: 'email',
        description: 'Vérifier les nouvelles réponses aux emails',
      });
    });

    // Contenu HaiSkills (lundi, mercredi, vendredi à 10h)
    this.schedule('content-generation', '0 10 * * 1,3,5', async () => {
      await this.agent.executeTask({
        type: 'content',
        description: 'Générer le contenu HaiSkills du jour',
      });
    });

    // Rapport quotidien (20h)
    this.schedule('daily-report', '0 20 * * *', async () => {
      await this.agent.executeTask({
        type: 'reporting',
        description: 'Compiler et envoyer le rapport quotidien',
      });
    });

    // Rapport hebdomadaire (vendredi 18h)
    this.schedule('weekly-report', '0 18 * * 5', async () => {
      await this.agent.executeTask({
        type: 'reporting',
        description: 'Compiler le rapport hebdomadaire complet',
      });
    });

    this.logger.info(`${this.tasks.size} tâches planifiées`);
  }

  private schedule(name: string, cronExpr: string, handler: () => Promise<void>): void {
    const task = cron.schedule(cronExpr, async () => {
      try {
        await handler();
      } catch (error) {
        this.logger.error(`Erreur dans la tâche "${name}": ${error}`);
      }
    }, {
      timezone: 'Europe/Brussels'
    });

    this.tasks.set(name, task);
    this.logger.info(`Tâche "${name}" planifiée: ${cronExpr}`);
  }

  stop(): void {
    for (const [name, task] of this.tasks) {
      task.stop();
      this.logger.info(`Tâche "${name}" arrêtée`);
    }
  }
}
```

### 4.8.2 — Heartbeat Reader

```typescript
// src/scheduler/heartbeat.ts

import { FileStore } from '../memory/file-store';
import { Logger } from '../utils/logger';

interface PendingTask {
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export class HeartbeatReader {
  private fileStore: FileStore;
  private logger = new Logger('Heartbeat');

  constructor() {
    this.fileStore = new FileStore('workspace');
  }

  async readPendingTasks(): Promise<PendingTask[]> {
    const heartbeatContent = await this.fileStore.read('HEARTBEAT.md');
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Parser le HEARTBEAT.md pour trouver les tâches dues
    const tasks: PendingTask[] = [];

    const lines = heartbeatContent.split('\n');
    let currentSchedule = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSchedule = line.replace('## ', '').trim().toLowerCase();
      } else if (line.startsWith('- ') && currentSchedule) {
        if (this.isTaskDue(currentSchedule, currentHour, currentDay)) {
          tasks.push({
            type: 'heartbeat',
            description: line.replace('- ', '').trim(),
            priority: 'medium',
          });
        }
      }
    }

    if (tasks.length > 0) {
      this.logger.info(`${tasks.length} tâches dues trouvées dans HEARTBEAT.md`);
    }

    return tasks;
  }

  private isTaskDue(schedule: string, currentHour: number, currentDay: string): boolean {
    // Parser les expressions comme "tous les jours à 8h00"
    // ou "tous les lundis à 9h00"
    if (schedule.includes('tous les jours')) {
      const hourMatch = schedule.match(/(\d{1,2})h/);
      if (hourMatch) {
        const targetHour = parseInt(hourMatch[1]);
        return Math.abs(currentHour - targetHour) < 1;
      }
    }

    if (schedule.includes('tous les lundis') && currentDay === 'monday') {
      const hourMatch = schedule.match(/(\d{1,2})h/);
      if (hourMatch) {
        return currentHour === parseInt(hourMatch[1]);
      }
    }

    if (schedule.includes('tous les vendredis') && currentDay === 'friday') {
      const hourMatch = schedule.match(/(\d{1,2})h/);
      if (hourMatch) {
        return currentHour === parseInt(hourMatch[1]);
      }
    }

    return false;
  }
}
```


## 4.9 — Notion CRM

### 4.9.1 — Structure de la Base Notion

La base de données Notion CRM a cette structure :

| Propriété | Type | Description |
|-----------|------|-------------|
| Nom | Title | Nom de l'entreprise |
| Contact | Text | Nom du contact principal |
| Email | Email | Email du contact |
| Téléphone | Phone | Numéro de téléphone |
| Site Web | URL | Site web de l'entreprise |
| Secteur | Select | Secteur d'activité |
| Statut | Select | Nouveau / Contacté / Intéressé / Meeting / Devis / Client / Fermé |
| Score | Number | Score de prospection (1-10) |
| Source | Select | Google Maps / LinkedIn / Referral / Inbound |
| Email Step | Select | Aucun / Email 1 / Follow-up 1 / Follow-up 2 |
| Dernier Contact | Date | Date du dernier email/interaction |
| Notes | Text | Notes libres |
| Ville | Select | Bruxelles / Liège / Anvers / Autre |
| Budget Estimé | Number | Budget estimé du projet |
| Priorité | Select | Haute / Moyenne / Basse |

### 4.9.2 — Notion CRM Client

```typescript
// src/modules/crm/notion-crm.ts

import { Client } from '@notionhq/client';
import { Logger } from '../../utils/logger';

export class NotionCRM {
  private notion: Client;
  private databaseId: string;
  private logger = new Logger('NotionCRM');

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });
    this.databaseId = process.env.NOTION_CRM_DATABASE_ID!;
  }

  async addProspect(prospect: any): Promise<string> {
    const response = await this.notion.pages.create({
      parent: { database_id: this.databaseId },
      properties: {
        'Nom': { title: [{ text: { content: prospect.name } }] },
        'Contact': { rich_text: [{ text: { content: prospect.contact || '' } }] },
        'Email': { email: prospect.email },
        'Téléphone': { phone_number: prospect.phone || '' },
        'Site Web': { url: prospect.website || null },
        'Secteur': { select: { name: prospect.sector || 'Autre' } },
        'Statut': { select: { name: 'Nouveau' } },
        'Score': { number: prospect.score || 0 },
        'Source': { select: { name: prospect.source || 'Google Maps' } },
        'Ville': { select: { name: prospect.city || 'Bruxelles' } },
      },
    });

    this.logger.info(`Prospect ajouté: ${prospect.name} (${response.id})`);
    return response.id;
  }

  async updateProspect(pageId: string, updates: any): Promise<void> {
    const properties: any = {};

    if (updates.status) {
      properties['Statut'] = { select: { name: updates.status } };
    }
    if (updates.emailStep) {
      properties['Email Step'] = { select: { name: updates.emailStep } };
    }
    if (updates.lastEmailSent) {
      properties['Dernier Contact'] = { date: { start: updates.lastEmailSent } };
    }
    if (updates.notes) {
      properties['Notes'] = { rich_text: [{ text: { content: updates.notes } }] };
    }

    await this.notion.pages.update({
      page_id: pageId,
      properties,
    });

    this.logger.info(`Prospect mis à jour: ${pageId}`);
  }

  async getProspectsForToday(): Promise<any[]> {
    // Récupérer les prospects qui doivent recevoir un email aujourd'hui
    const response = await this.notion.databases.query({
      database_id: this.databaseId,
      filter: {
        and: [
          {
            property: 'Statut',
            select: { does_not_equal: 'Client' },
          },
          {
            property: 'Statut',
            select: { does_not_equal: 'Fermé' },
          },
          {
            property: 'Email',
            email: { is_not_empty: true },
          },
        ],
      },
      sorts: [
        { property: 'Score', direction: 'descending' },
      ],
    });

    return response.results.map(this.parseProspect);
  }

  async getDailyMetrics(): Promise<object> {
    const allProspects = await this.notion.databases.query({
      database_id: this.databaseId,
    });

    const statuses: Record<string, number> = {};
    for (const page of allProspects.results) {
      const status = (page as any).properties['Statut']?.select?.name || 'Inconnu';
      statuses[status] = (statuses[status] || 0) + 1;
    }

    return {
      total: allProspects.results.length,
      byStatus: statuses,
    };
  }

  private parseProspect(page: any): any {
    return {
      id: page.id,
      name: page.properties['Nom']?.title?.[0]?.text?.content || '',
      email: page.properties['Email']?.email || '',
      status: page.properties['Statut']?.select?.name || '',
      score: page.properties['Score']?.number || 0,
      emailStep: page.properties['Email Step']?.select?.name || '',
      lastEmailSent: page.properties['Dernier Contact']?.date?.start || null,
      company: page.properties['Nom']?.title?.[0]?.text?.content || '',
      firstName: page.properties['Contact']?.rich_text?.[0]?.text?.content?.split(' ')[0] || '',
    };
  }
}
```


## 4.10 — Sécurité

### 4.10.1 — Principes de Sécurité d'IntraClaw

IntraClaw est conçu avec la sécurité comme priorité, en tirant les leçons des problèmes d'OpenClaw :

1. **Aucune exposition réseau**
   - Le scheduler et l'agent tournent localement
   - Pas de WebSocket ouvert sur un port public
   - Pas de Gateway accessible depuis internet
   - Communications uniquement via APIs HTTPS sortantes (Claude, Gmail, Notion)

2. **Gestion des secrets**
   - Tous les tokens et clés API dans `.env`
   - `.env` dans `.gitignore` (jamais commité)
   - `.env.example` fourni comme template (sans les vraies valeurs)
   - En production (VPS) : variables d'environnement système

3. **Pas de skills tierces**
   - Aucun marketplace
   - Toutes les skills sont écrites par Ayman
   - Pas de téléchargement de code externe
   - Chaque skill est auditée avant utilisation

4. **Principe du moindre privilège**
   - L'agent n'a que les permissions minimales nécessaires
   - Gmail : accès en lecture + envoi uniquement
   - Notion : accès à la base CRM uniquement
   - Pas d'accès admin

5. **Logging et audit**
   - Chaque action est loggée avec timestamp
   - Les emails envoyés sont tous archivés
   - Les modifications CRM sont tracées
   - Les erreurs sont loggées avec stack trace

### 4.10.2 — Fichier .env

```bash
# .env — JAMAIS commit ce fichier !

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Gmail OAuth2
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REFRESH_TOKEN=1//xxxxx
GMAIL_FROM_EMAIL=ayman.idamre@gmail.com

# Notion API
NOTION_TOKEN=secret_xxxxx
NOTION_CRM_DATABASE_ID=xxxxx

# Configuration
AYMAN_EMAIL=ayman.idamre@gmail.com
TIMEZONE=Europe/Brussels
MAX_EMAILS_PER_DAY=30
LOG_LEVEL=info
```

---
---
---

# PARTIE 5 : PLAN DE DÉVELOPPEMENT SEMAINE PAR SEMAINE

## Semaine 1 : Fondations (7 jours)

### Jour 1-2 : Setup Projet

**Objectifs :**
- Initialiser le projet TypeScript/Node.js
- Configurer l'environnement de développement
- Créer la structure de dossiers

**Actions concrètes :**

```bash
# Créer le projet
mkdir intraclaw && cd intraclaw
npm init -y
npm install typescript ts-node @types/node --save-dev
npx tsc --init

# Installer les dépendances principales
npm install @anthropic-ai/sdk          # Claude API
npm install @notionhq/client           # Notion API
npm install googleapis                  # Gmail API
npm install puppeteer                   # Browser control
npm install node-cron @types/node-cron  # Scheduling
npm install better-sqlite3              # SQLite
npm install winston                     # Logging
npm install dotenv                      # Variables d'environnement
npm install zod                         # Validation de schéma

# Outils de développement
npm install --save-dev nodemon eslint prettier
npm install --save-dev @types/better-sqlite3

# Créer la structure
mkdir -p src/{agent,memory,scheduler,modules/{prospection,email,content,crm,reporting},skills,db,utils,types}
mkdir -p workspace/memory
mkdir -p skills/{cold-email,google-maps-scraper,content-haiskills,daily-report}
mkdir -p data logs
```

**Livrables :**
- Projet compilable (`npm run build` fonctionne)
- `tsconfig.json` configuré
- `.env.example` créé
- `.gitignore` configuré
- Structure de dossiers complète

### Jour 3 : Système de Mémoire

**Objectifs :**
- Implémenter le FileStore (lecture/écriture des fichiers MD)
- Créer le MemoryManager
- Créer les 8 fichiers de mémoire initiaux

**Livrables :**
- `FileStore` : lecture, écriture, append de fichiers Markdown
- `MemoryManager` : chargement du contexte, sauvegarde, notes journalières
- 8 fichiers MD dans `workspace/` avec le contenu initial
- Tests unitaires pour FileStore

### Jour 4 : Client Claude API

**Objectifs :**
- Implémenter le client API Claude (Anthropic SDK)
- Créer le PromptBuilder (construction des prompts avec contexte mémoire)
- Tester l'intégration

**Livrables :**
- `ClaudeClient` : envoi de messages, gestion des erreurs, retry
- `PromptBuilder` : assemblage du system prompt avec SOUL.md + USER.md + contexte
- Test fonctionnel : envoyer un message et recevoir une réponse
- Rate limiting intégré

### Jour 5 : Scheduler Basique

**Objectifs :**
- Implémenter le Scheduler avec node-cron
- Implémenter le HeartbeatReader
- Créer la TaskQueue

**Livrables :**
- `Scheduler` : planification de tâches avec expressions cron
- `HeartbeatReader` : parsing de HEARTBEAT.md
- `TaskQueue` : file d'attente avec priorités
- Test : une tâche qui s'exécute toutes les minutes et log un message

### Jour 6 : Agent Principal

**Objectifs :**
- Créer la classe Agent principale qui orchestre tout
- Intégrer mémoire + Claude + scheduler
- Boucle agentique basique (tool calling)

**Livrables :**
- `Agent` : classe principale avec méthode `executeTask()`
- Intégration du tool calling de Claude (l'agent peut appeler des outils)
- Registre d'outils basique (fichiers + shell)
- Test end-to-end : demander à l'agent de créer un fichier et vérifier qu'il le fait

### Jour 7 : Base SQLite + Logging

**Objectifs :**
- Créer le schéma SQLite pour les données structurées
- Implémenter le système de logging
- Créer le point d'entrée (index.ts)

**Schéma SQLite initial :**

```sql
-- Prospects
CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  notion_page_id TEXT,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  sector TEXT,
  city TEXT DEFAULT 'Bruxelles',
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Nouveau',
  source TEXT DEFAULT 'Google Maps',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emails envoyés
CREATE TABLE sent_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id TEXT REFERENCES prospects(id),
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  opened BOOLEAN DEFAULT FALSE,
  replied BOOLEAN DEFAULT FALSE,
  reply_sentiment TEXT
);

-- Logs d'activité
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contenu généré
CREATE TABLE generated_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  theme TEXT,
  platform TEXT,
  status TEXT DEFAULT 'draft',
  notion_page_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tokens consommés (pour le tracking des coûts)
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL,
  task_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Livrables :**
- Schéma SQLite créé et migré
- Logger configuré (winston) avec rotation des fichiers
- `index.ts` qui lance tout (mémoire → agent → scheduler)
- Le système démarre et tourne sans erreur


## Semaine 2 : Module Prospection + Email (7 jours)

### Jour 8-9 : Google Maps Scraper

**Objectifs :**
- Implémenter le scraper Google Maps complet
- Tester avec une vraie requête
- Gérer les edge cases (pas de résultats, CAPTCHA, etc.)

**Livrables :**
- `GoogleMapsScraper` fonctionnel
- Extraction de 50 entreprises par requête
- Données sauvegardées en SQLite
- Screenshots de debug en cas d'erreur
- Gestion du rate limiting (délais aléatoires)

### Jour 10 : Email Finder + Enrichissement

**Objectifs :**
- Implémenter la recherche d'emails sur les sites web
- Vérification MX des emails trouvés
- Scoring des prospects

**Livrables :**
- `EmailFinder` fonctionnel
- `ProspectScorer` fonctionnel
- `ProspectEnricher` qui combine le tout
- Taux de succès cible : trouver un email pour 40%+ des entreprises

### Jour 11 : Notion API Integration

**Objectifs :**
- Créer la base de données CRM dans Notion (manuellement)
- Implémenter le client Notion CRM
- Tester CRUD complet

**Livrables :**
- Base Notion CRM créée avec toutes les colonnes
- `NotionCRM` : addProspect, updateProspect, getProspects, getDailyMetrics
- Test : ajouter un prospect, le modifier, le requêter
- Synchronisation bidirectionnelle SQLite ↔ Notion

### Jour 12-13 : Gmail API Integration + Cold Email

**Objectifs :**
- Configurer OAuth2 pour Gmail
- Implémenter l'envoi d'emails
- Implémenter le suivi des réponses
- Créer les templates d'email

**Livrables :**
- `GmailClient` fonctionnel (envoi + lecture)
- OAuth2 configuré avec refresh token
- 3 templates d'email (first-touch, follow-up-1, follow-up-2)
- `SequenceManager` fonctionnel
- `ReplyTracker` qui détecte les réponses et les classe

### Jour 14 : Pipeline Complet de Prospection

**Objectifs :**
- Intégrer tous les modules en un pipeline end-to-end
- Test du workflow complet : scrape → enrich → CRM → email → tracking

**Livrables :**
- Pipeline fonctionnel de bout en bout
- Test avec 10 vrais prospects (Bruxelles)
- Vérification que tout se sauvegarde correctement (SQLite + Notion)
- Documentation du processus


## Semaine 3 : Module Contenu + Reporting (7 jours)

### Jour 15-16 : Content Generator

**Objectifs :**
- Implémenter le générateur de contenu via Claude
- Créer les prompts pour différentes plateformes (LinkedIn, blog)
- Intégrer avec Notion (Content Pipeline)

**Livrables :**
- `ContentGenerator` fonctionnel pour LinkedIn et blog
- Prompts optimisés pour le ton HaiSkills
- `NotionPublisher` : sauvegarde les drafts dans Notion
- Test : générer 3 posts et les sauvegarder dans Notion

### Jour 17-18 : Reporting

**Objectifs :**
- Implémenter le rapport quotidien
- Implémenter le rapport hebdomadaire
- Envoi par email

**Livrables :**
- `DailyReportBuilder` fonctionnel
- `WeeklyReportBuilder` fonctionnel
- Rapport formaté en Markdown lisible
- Envoi automatique par email à 20h

### Jour 19-20 : Skills System

**Objectifs :**
- Implémenter le chargeur de skills
- Créer les 4 skills initiales
- Tester le lancement de skills depuis le heartbeat

**Livrables :**
- `SkillLoader` : lit les SKILL.md et enregistre les compétences
- `SkillRunner` : exécute une skill en donnant ses instructions à l'agent
- 4 skills fonctionnelles :
  1. `cold-email` : gestion des séquences email
  2. `google-maps-scraper` : scraping de prospects
  3. `content-haiskills` : génération de contenu
  4. `daily-report` : compilation des rapports

### Jour 21 : Intégration Complète

**Objectifs :**
- Tout connecter ensemble
- Test de 24h en conditions réelles
- Fix des bugs trouvés

**Livrables :**
- Système intégré fonctionnel
- 24h de fonctionnement sans crash
- Logs propres et informatifs
- Tous les modules communiquent correctement


## Semaine 4 : Polish + Déploiement (7 jours)

### Jour 22-23 : Gestion d'Erreurs et Robustesse

**Objectifs :**
- Ajouter retry avec backoff exponentiel partout
- Gérer tous les edge cases
- Ajouter des circuit breakers

**Livrables :**
- `RetryHelper` avec backoff exponentiel (1s, 2s, 4s, 8s, 16s)
- `CircuitBreaker` pour les APIs externes
- Gestion gracieuse des erreurs réseau
- Fallback quand une API est down (log + skip + retry plus tard)
- Test de résilience : couper internet pendant 5 minutes et vérifier la récupération

### Jour 24 : Optimisation des Coûts

**Objectifs :**
- Implémenter le prompt caching
- Optimiser la taille des prompts
- Tracker les coûts en temps réel

**Livrables :**
- Cache des prompts système (SOUL.md, USER.md ne changent pas souvent)
- Compression de la mémoire historique (résumé des vieux fichiers)
- Dashboard des coûts dans le rapport quotidien
- Alerte si le coût quotidien dépasse un seuil

### Jour 25 : Tests Complets

**Objectifs :**
- Tests unitaires pour chaque module
- Tests d'intégration pour les pipelines
- Test de charge (simuler une semaine d'utilisation)

**Livrables :**
- 80%+ de couverture de tests
- Suite de tests automatisée (`npm test`)
- Tests d'intégration qui simulent le workflow complet
- Rapport de tests

### Jour 26-27 : Déploiement

**Option A : Mac (Daemon via launchd)**

```xml
<!-- ~/Library/LaunchAgents/com.intraclaw.agent.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.intraclaw.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/ayman/intraclaw/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/ayman/intraclaw/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ayman/intraclaw/logs/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

```bash
# Charger le daemon
launchctl load ~/Library/LaunchAgents/com.intraclaw.agent.plist

# Vérifier qu'il tourne
launchctl list | grep intraclaw

# Arrêter
launchctl unload ~/Library/LaunchAgents/com.intraclaw.agent.plist
```

**Option B : VPS (Daemon via PM2)**

```bash
# Sur le VPS (Ubuntu)
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2
npm install -g pm2

# Cloner le projet
git clone git@github.com:ayman/intraclaw.git
cd intraclaw
npm install
npm run build

# Copier le .env
cp .env.example .env
nano .env  # Remplir les vraies valeurs

# Lancer avec PM2
pm2 start dist/index.js --name intraclaw

# Auto-restart au boot
pm2 startup
pm2 save

# Monitoring
pm2 monit
pm2 logs intraclaw
```

### Jour 28 : Documentation + Makefile

**Livrables :**

```makefile
# Makefile

.PHONY: dev build start stop logs test clean

# Développement (avec hot-reload)
dev:
	npx nodemon --exec ts-node src/index.ts

# Build production
build:
	npx tsc

# Lancer en production (Mac)
start:
	launchctl load ~/Library/LaunchAgents/com.intraclaw.agent.plist

# Arrêter
stop:
	launchctl unload ~/Library/LaunchAgents/com.intraclaw.agent.plist

# Voir les logs
logs:
	tail -f logs/intraclaw.log

# Lancer les tests
test:
	npx jest

# Nettoyer les builds
clean:
	rm -rf dist/

# Backup de la mémoire
backup:
	tar -czf backups/memory-$(date +%Y%m%d).tar.gz workspace/

# Status
status:
	launchctl list | grep intraclaw
```

---
---
---

# PARTIE 6 : PROBLÈMES POSSIBLES ET SOLUTIONS

## Problème 1 : Rate Limiting API Claude

**Le problème :**
L'API Claude a des limites de requêtes par minute (RPM) et par jour. Si on dépasse, on reçoit des erreurs 429 (Too Many Requests).

**Pourquoi ça arrive :**
Quand on envoie trop de requêtes à Claude en peu de temps — par exemple, si on génère 30 emails personnalisés d'un coup.

**La solution :**
Implémenter une queue avec backoff exponentiel :

```typescript
class RateLimitedQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private minDelay = 1000; // 1 seconde minimum entre les requêtes

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (error: any) {
        if (error.status === 429) {
          // Rate limited — attendre et réessayer
          const retryAfter = error.headers?.['retry-after'] || 60;
          await delay(retryAfter * 1000);
          this.queue.unshift(task); // Remettre en tête de queue
        }
      }
      await delay(this.minDelay);
    }

    this.processing = false;
  }
}
```

**Plan B :**
Si le rate limiting est trop agressif, passer à un modèle local (Ollama + Llama 3) pour les tâches simples (personnalisation d'emails basique), et réserver Claude pour les tâches complexes (génération de contenu, analyse de réponses).


## Problème 2 : Google Maps Bloque le Scraping

**Le problème :**
Google détecte les bots et peut bloquer l'accès ou afficher des CAPTCHAs.

**Pourquoi ça arrive :**
Google analyse les patterns de navigation (vitesse, régularité, user-agent) et détecte les comportements non-humains.

**La solution :**
1. **Rotation de User-Agents** : Changer le user-agent à chaque session
2. **Délais aléatoires** : Entre 2 et 8 secondes entre chaque action
3. **Comportement humain** : Scroll progressif, mouvements de souris aléatoires
4. **Limiter le volume** : Maximum 50 entreprises par session, 2-3 sessions par semaine
5. **Changer d'IP** : Utiliser un proxy résidentiel si nécessaire

**Plan B :**
Si Google Maps devient trop difficile à scraper :
- Utiliser l'API Google Places (payante mais légale — $2 par 1000 requêtes)
- Scraper d'autres sources : Pages Jaunes, Yelp, annuaires sectoriels
- Utiliser des services tiers comme Apollo.io ou Hunter.io (freemium) pour trouver des prospects


## Problème 3 : Gmail Bloque les Cold Emails (Spam)

**Le problème :**
Gmail peut marquer tes emails comme spam, ou pire, suspendre temporairement ton compte si tu envoies trop d'emails non sollicités.

**Pourquoi ça arrive :**
Gmail surveille le ratio envoi/réponse, le contenu des emails, et le comportement d'envoi.

**La solution :**

1. **Warm-up progressif** :
   - Semaine 1 : 5 emails/jour
   - Semaine 2 : 10 emails/jour
   - Semaine 3 : 20 emails/jour
   - Semaine 4+ : 30 emails/jour (maximum)

2. **SPF/DKIM/DMARC** : Configurer l'authentification email (si domaine custom)

3. **Bonnes pratiques de contenu** :
   - Pas de mots "spam" (gratuit, promotion, offre limitée...)
   - Emails courts (5-8 lignes max)
   - Toujours un lien de désinscription
   - Pas de pièces jointes
   - Pas d'images excessives
   - Personnalisation réelle (pas juste le prénom)

4. **Limites strictes** :
   - Maximum 30 emails/jour
   - Minimum 2 minutes entre chaque envoi
   - Pas d'envoi le week-end
   - Pause si le taux de bounce > 5%

**Plan B :**
- Utiliser un domaine séparé (ex: contact@haiskills.com) pour les cold emails
- Utiliser un service dédié comme Instantly, Lemlist, ou Woodpecker (freemium)
- Envoyer via SMTP externe (SendGrid, Mailgun) au lieu de Gmail directement


## Problème 4 : Notion API Rate Limits

**Le problème :**
L'API Notion a une limite de 3 requêtes par seconde.

**Pourquoi ça arrive :**
Quand on fait beaucoup d'opérations CRM d'un coup (ajout en masse de prospects).

**La solution :**
1. **Batch requests** : Regrouper les opérations et les envoyer par lots
2. **Cache local** : Garder une copie locale (SQLite) et synchroniser par batch
3. **Queue avec throttling** : Maximum 2 requêtes/seconde vers Notion
4. **Sync incrémentielle** : Ne synchroniser que les changements, pas tout

**Plan B :**
Si Notion devient trop limitant, migrer vers Airtable (limite plus haute) ou une base Supabase (pas de limite API).


## Problème 5 : Mémoire qui Grossit Trop

**Le problème :**
Au fil du temps, MEMORY.md et les notes journalières vont grossir, utilisant trop de tokens dans le contexte Claude.

**Pourquoi ça arrive :**
Chaque jour ajoute des données. Après 3 mois, les fichiers mémoire peuvent dépasser 100K tokens.

**La solution :**
Compaction automatique de la mémoire :

```typescript
class MemoryCompactor {
  async compact(olderThan: number = 30): Promise<void> {
    // 1. Lire toutes les notes plus vieilles que X jours
    const oldNotes = await this.getNotesOlderThan(olderThan);

    // 2. Demander à Claude de les résumer
    const summary = await this.claude.chat(
      'Résume ces notes en gardant uniquement les faits importants, ' +
      'les décisions prises, et les leçons apprises.',
      oldNotes.join('\n\n')
    );

    // 3. Remplacer les vieilles notes par le résumé
    await this.memory.write('memory/archive.md', summary);

    // 4. Supprimer les vieilles notes individuelles
    for (const note of oldNotes) {
      await this.memory.delete(note.path);
    }
  }
}
```

**Plan B :**
Utiliser la recherche sémantique (embeddings) pour ne charger que les souvenirs pertinents au lieu de tout charger à chaque fois.


## Problème 6 : Mac qui S'éteint / Crash

**Le problème :**
Si le Mac d'Ayman s'éteint, IntraClaw s'arrête. Les tâches planifiées ne s'exécutent pas.

**Pourquoi ça arrive :**
Le Mac peut s'éteindre pour : batterie vide, mise à jour macOS, crash, fermeture du couvercle.

**La solution :**
1. **launchd avec KeepAlive** : Le daemon redémarre automatiquement après un crash
2. **BOOTSTRAP.md** : L'agent sait quoi faire au redémarrage (rattraper les tâches manquées)
3. **Logs de dernière activité** : Savoir exactement quand le système s'est arrêté

**Plan B :**
Migrer vers un VPS (5-10€/mois) :
- Hetzner : 5€/mois pour un VPS avec 2 vCPU, 4GB RAM
- DigitalOcean : $6/mois pour un Droplet basique
- Le VPS tourne 24/7, pas de risque d'interruption
- PM2 pour la gestion du process


## Problème 7 : Coût API Claude

**Le problème :**
L'API Claude est facturée par token. Les coûts peuvent grimper si l'agent fait beaucoup de requêtes.

**Pourquoi ça arrive :**
Chaque interaction avec Claude consomme des tokens (input + output). Plus le contexte est long, plus c'est cher.

**La solution :**

1. **Utiliser Claude Sonnet 4.6** au lieu d'Opus : 3x moins cher, suffisant pour la plupart des tâches
2. **Prompt caching** : Les parties statiques du prompt (SOUL.md, USER.md) sont cachées — -90% sur ces tokens
3. **Optimiser la taille du contexte** : Ne charger que la mémoire pertinente
4. **Cache des réponses** : Si une requête similaire a déjà été faite, réutiliser la réponse
5. **Budget quotidien** : Alerte + arrêt si le budget quotidien est dépassé ($5/jour max)

**Estimation réaliste :**

| Tâche | Tokens/jour | Coût/jour (Sonnet) |
|-------|------------|-------------------|
| Prospection (30 emails) | 60K | $0.63 |
| Contenu (1 post) | 20K | $0.36 |
| Reporting | 30K | $0.54 |
| Interactions | 20K | $0.36 |
| **Total** | **130K** | **$1.89/jour** |

Soit environ **$57/mois** sans optimisations, et **$20-30/mois** avec prompt caching.

**Plan B :**
Utiliser un modèle local (Ollama + Llama 3) pour les tâches simples (personnalisation d'emails) et réserver Claude pour les tâches intelligentes (analyse, rédaction de qualité).


## Problème 8 : Sécurité des Tokens

**Le problème :**
Si quelqu'un accède à tes tokens API (Claude, Gmail, Notion), il peut les utiliser à tes frais ou accéder à tes données.

**Pourquoi ça arrive :**
Tokens commitéss dans Git, fichiers .env mal protégés, backup non chiffré.

**La solution :**

1. **`.env` dans `.gitignore`** : Le fichier n'est JAMAIS commité
2. **Permissions restrictives** : `chmod 600 .env` (lisible uniquement par le propriétaire)
3. **Rotation régulière** : Renouveler les tokens tous les 3 mois
4. **Monitoring** : Surveiller l'utilisation anormale des APIs

**Plan B :**
Utiliser un gestionnaire de secrets comme :
- macOS Keychain (pour le développement local)
- Doppler ou HashiCorp Vault (pour le VPS)


## Problème 9 : Puppeteer qui Plante

**Le problème :**
Puppeteer peut planter pour diverses raisons : timeout, page qui ne charge pas, Chrome qui crash.

**Pourquoi ça arrive :**
Pages web lentes, JavaScript complexe, mémoire insuffisante, Chrome headless instable.

**La solution :**

1. **Retry logic** : 3 tentatives avec backoff exponentiel
2. **Timeouts stricts** : 30 secondes max par page
3. **Screenshots de debug** : Capturer l'écran quand une erreur survient
4. **Gestion mémoire** : Fermer le navigateur après chaque session de scraping
5. **Headless mode** : Toujours utiliser le mode headless (pas de GUI)

```typescript
async function safeNavigate(page: puppeteer.Page, url: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      return true;
    } catch (error) {
      logger.warn(`Tentative ${attempt}/3 échouée pour ${url}: ${error}`);
      if (attempt < 3) {
        await delay(attempt * 2000); // Backoff
      }
    }
  }

  // Prendre un screenshot de debug
  await page.screenshot({ path: `logs/error-${Date.now()}.png` });
  return false;
}
```

**Plan B :**
Si Puppeteer est trop instable, passer à Playwright (plus robuste, maintenu par Microsoft) ou utiliser des services de scraping comme ScrapingBee ou Apify.


## Problème 10 : WhatsApp qui Bloque le Numéro (v2)

**Le problème :**
Meta peut bloquer ton numéro WhatsApp si tu envoies trop de messages automatisés via Baileys.

**Pourquoi ça arrive :**
Baileys utilise le protocole WhatsApp Web de manière non officielle. Meta détecte les patterns anormaux.

**La solution :**

1. **Usage limité** : Utiliser WhatsApp uniquement pour les notifications à Ayman, pas pour la prospection
2. **Volume minimal** : Maximum 10 messages/jour via WhatsApp
3. **Messages naturels** : Pas de messages génériques, toujours personnalisés
4. **Warm-up progressif** : Commencer par 2-3 messages/jour et augmenter lentement
5. **Numéro secondaire** : Utiliser un numéro WhatsApp dédié à IntraClaw (pas le numéro principal d'Ayman)

**Plan B :**
Si WhatsApp bloque le numéro :
- Utiliser Telegram au lieu de WhatsApp (plus tolérant envers les bots)
- Envoyer les notifications par email uniquement
- Utiliser l'API WhatsApp Business officielle (payante mais sans risque de ban)

---
---
---

# PARTIE 7 : COMPARAISON INTRACLAW vs OPENCLAW

## Tableau Comparatif Détaillé

| Feature | OpenClaw | IntraClaw v1 | IntraClaw v2 (Roadmap) |
|---------|----------|-------------|----------------------|
| **Architecture** | | | |
| Gateway WebSocket | Oui (port 18789) | Non (pas nécessaire) | Optionnel |
| Daemon/Background | Oui (launchd/systemd) | Oui (launchd/PM2) | Oui |
| Multi-plateforme | macOS, Linux, Windows | macOS, Linux | macOS, Linux |
| | | | |
| **LLM** | | | |
| Claude | Oui (bloqué via sub) | Oui (API directe) | Oui |
| GPT-4 | Oui | Non | Optionnel |
| DeepSeek | Oui | Non | Optionnel |
| Ollama (local) | Oui | Non | Oui |
| Multi-model | Oui | Non | Oui |
| | | | |
| **Mémoire** | | | |
| Fichiers Markdown | Oui (3 fichiers core) | Oui (8 fichiers) | Oui |
| Notes journalières | Oui | Oui | Oui |
| Recherche sémantique | Oui (optionnel) | Non | Oui |
| Compaction auto | Non | Oui | Oui |
| | | | |
| **Channels** | | | |
| WhatsApp | Oui (Baileys) | Non | Oui (Baileys) |
| Telegram | Oui (grammY) | Non | Optionnel |
| Slack | Oui | Non | Non |
| Discord | Oui | Non | Non |
| Email | Via skills | Oui (Gmail API natif) | Oui |
| 20+ autres | Oui | Non | Non |
| | | | |
| **Skills** | | | |
| Marketplace (ClawHub) | Oui (13K+ skills) | Non | Non |
| Skills custom | Oui | Oui | Oui |
| Installation CLI | Oui | Non (manuel) | CLI custom |
| | | | |
| **Prospection** | | | |
| Google Maps scraping | Via skills | Natif | Natif |
| Email finding | Via skills | Natif | Natif |
| Cold email séquences | Via skills | Natif | Natif |
| CRM integration | Via skills | Natif (Notion) | Natif + multi-CRM |
| | | | |
| **Contenu** | | | |
| Génération de posts | Via skills | Natif | Natif |
| Multi-plateforme | Via skills | LinkedIn, Blog | Tous |
| Publication auto | Via skills | Non (draft only) | Oui (Buffer API) |
| | | | |
| **Reporting** | | | |
| Rapports quotidiens | Via skills | Natif | Natif |
| Rapports hebdo | Via skills | Natif | Natif |
| Dashboard web | Non | Non | Oui (optionnel) |
| | | | |
| **Sécurité** | | | |
| Marketplace public | Oui (problématique) | Non (privé) | Non |
| Exposure réseau | Possible (135K exposés) | Jamais | Jamais |
| Audit de code | Non garanti | Toujours | Toujours |
| CVEs connues | 9+ en Q1 2026 | 0 (code privé) | 0 |
| | | | |
| **Coût** | | | |
| Setup | Gratuit | Gratuit | Gratuit |
| LLM | Abonnement (bloqué) | API pay-per-token | API + local |
| Infrastructure | Gratuit (local) | Gratuit (local) | 5-10€/mois (VPS) |
| Coût mensuel estimé | $20-100/mois (sub) | $20-57/mois (API) | $25-67/mois |
| | | | |
| **Complexité** | | | |
| Installation | 5 minutes | 2-4 heures | 2-4 heures |
| Configuration | Fichiers MD | Fichiers MD + .env | Fichiers MD + .env |
| Maintenance | Communauté | Ayman seul | Ayman seul |
| Courbe d'apprentissage | Moyenne | Haute (build from scratch) | Moyenne |

## Ce que IntraClaw v1 fait MIEUX qu'OpenClaw

1. **Sécurité** : Pas de marketplace, pas d'exposition réseau, code audité
2. **Spécialisation** : Optimisé pour les besoins exact d'Ayman (prospection B2B + contenu)
3. **Coûts maîtrisés** : Tracking détaillé des tokens, budget quotidien, optimisations
4. **Simplicité** : Pas de Gateway WebSocket, pas de channels complexes
5. **Mémoire** : Compaction automatique, pas de bloat au fil du temps

## Ce qu'OpenClaw fait MIEUX (Features Roadmap v2)

1. **Multi-channel** : WhatsApp, Telegram, Slack, etc.
2. **Multi-model** : Possibilité d'utiliser GPT-4, DeepSeek, Ollama
3. **Recherche sémantique** : Retrouver des souvenirs par similarité
4. **Écosystème** : 13K+ skills prêtes à l'emploi
5. **Communauté** : Support, documentation, plugins

---
---
---

# PARTIE 8 : BUDGET ET COÛTS ESTIMÉS

## 8.1 — Coûts de Développement

| Poste | Coût |
|-------|------|
| Temps d'Ayman (4 semaines) | 0€ (investissement personnel) |
| Claude API pendant le dev | ~$20 (pour les tests) |
| Domaine (optionnel) | 10€/an |
| **Total setup** | **~$30** |

## 8.2 — Coûts Mensuels Opérationnels

### Scénario 1 : Utilisation Légère (20 emails/jour, 3 posts/semaine)

| Poste | Coût/mois |
|-------|-----------|
| Claude API (Sonnet, avec caching) | $20-25 |
| VPS (optionnel) | $0 (Mac local) |
| Gmail | $0 (gratuit) |
| Notion API | $0 (gratuit, plan free) |
| **Total** | **$20-25/mois** |

### Scénario 2 : Utilisation Modérée (30 emails/jour, 5 posts/semaine)

| Poste | Coût/mois |
|-------|-----------|
| Claude API (Sonnet, avec caching) | $35-45 |
| VPS (optionnel) | $5 (Hetzner) |
| Gmail | $0 |
| Notion API | $0 |
| **Total** | **$40-50/mois** |

### Scénario 3 : Utilisation Intensive (50 emails/jour, daily posts, multi-plateforme)

| Poste | Coût/mois |
|-------|-----------|
| Claude API (mix Sonnet + Haiku) | $50-70 |
| VPS | $5-10 |
| Gmail | $0 |
| Notion API | $0 |
| Google Places API (si Maps API) | $10-20 |
| **Total** | **$65-100/mois** |

## 8.3 — ROI Estimé

Si IntraClaw permet de signer **1 client freelance** par mois grâce à la prospection automatisée :

- Revenu moyen par projet : 1000-5000€
- Coût IntraClaw : 20-50€/mois
- **ROI : 2000-10000%**

Même avec un taux de conversion très faible (1 client tous les 2 mois), le ROI reste massif.

## 8.4 — Optimisations de Coûts

1. **Prompt Caching** : -90% sur les tokens d'input répétés (SOUL.md, USER.md)
2. **Claude Haiku** pour les tâches simples : Personnalisation d'emails, classification de réponses ($1/$5 au lieu de $3/$15)
3. **Batch API** : -50% pour les tâches non-urgentes (génération de contenu en batch la nuit)
4. **Modèle local** (v2) : Ollama + Llama 3 pour les tâches triviales = $0
5. **Cache de réponses** : Si la même question revient, réutiliser la réponse précédente

---
---
---

# PARTIE 9 : RESSOURCES ET LIENS

## 9.1 — Documentation Officielle

### Claude / Anthropic

- Claude API Documentation : https://platform.claude.com/docs/en/home
- Claude Agent SDK Overview : https://platform.claude.com/docs/en/agent-sdk/overview
- Claude Agent SDK Quickstart : https://platform.claude.com/docs/en/agent-sdk/quickstart
- Claude Agent SDK Python Reference : https://platform.claude.com/docs/en/agent-sdk/python
- Claude Agent SDK TypeScript (GitHub) : https://github.com/anthropics/claude-agent-sdk-typescript
- Claude Agent SDK Python (GitHub) : https://github.com/anthropics/claude-agent-sdk-python
- Claude API Pricing : https://platform.claude.com/docs/en/about-claude/pricing

### OpenClaw

- OpenClaw GitHub : https://github.com/openclaw/openclaw
- OpenClaw Documentation : https://docs.openclaw.ai
- OpenClaw Memory System : https://docs.openclaw.ai/concepts/memory
- OpenClaw Architecture : https://docs.openclaw.ai/concepts/architecture
- OpenClaw Wikipedia : https://en.wikipedia.org/wiki/OpenClaw

## 9.2 — Bibliothèques et Outils

### Core

- Node.js : https://nodejs.org
- TypeScript : https://www.typescriptlang.org
- npm : https://www.npmjs.com

### APIs

- Notion API : https://developers.notion.com
- Notion SDK for JavaScript : https://github.com/makenotion/notion-sdk-js
- Gmail API : https://developers.google.com/gmail/api
- Google APIs Node.js Client : https://github.com/googleapis/google-api-nodejs-client

### Scraping & Browser Control

- Puppeteer : https://pptr.dev
- Puppeteer GitHub : https://github.com/puppeteer/puppeteer
- Playwright (alternative) : https://playwright.dev

### Scheduling

- node-cron : https://github.com/node-cron/node-cron
- PM2 (process manager) : https://pm2.keymetrics.io

### Base de données

- better-sqlite3 : https://github.com/WiseLibs/better-sqlite3

### WhatsApp (v2)

- Baileys : https://github.com/WhiskeySockets/Baileys

### Logging

- Winston : https://github.com/winstonjs/winston

### Utilitaires

- dotenv : https://github.com/motdotla/dotenv
- zod (validation) : https://github.com/colinhacks/zod

## 9.3 — Tutoriels et Articles

### OpenClaw

- OpenClaw Architecture Explained : https://ppaolo.substack.com/p/openclaw-system-architecture-overview
- Deep Dive into OpenClaw's Agentic Orchestration : https://softmaxdata.com/blog/deep-dive-into-openclaws-agentic-orchestrate-design-patterns-philosophy-framework-choices/
- OpenClaw and the Programmable Soul : https://duncsand.medium.com/openclaw-and-the-programmable-soul-2546c9c1782c
- Who Made OpenClaw : https://remoteopenclaw.com/blog/who-made-openclaw

### Sécurité OpenClaw

- The OpenClaw Security Crisis (Conscia) : https://conscia.com/blog/the-openclaw-security-crisis/
- OpenClaw Security: Every Risk (Apigene) : https://apigene.ai/blog/openclaw-security
- Cisco DefenseClaw : https://blogs.cisco.com/ai/cisco-announces-defenseclaw
- Nine CVEs in Four Days : https://openclawai.io/blog/openclaw-cve-flood-nine-vulnerabilities-four-days-march-2026
- ClawJacked Vulnerability : https://www.oasis.security/blog/openclaw-vulnerability

### Anthropic & Claude

- Anthropic Blocks OpenClaw (VentureBeat) : https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and/
- Hacker News Discussion : https://news.ycombinator.com/item?id=47633396
- Anthropic Official Statement : https://the-decoder.com/anthropic-cuts-off-third-party-tools-like-openclaw-for-claude-subscribers-citing-unsustainable-demand/

### Cas d'Utilisation

- Build a Viral TikTok Machine with OpenClaw : https://stormy.ai/blog/build-viral-tiktok-machine-openclaw-2026-playbook
- OpenClaw LinkedIn Lead Generation : https://stormy.ai/blog/openclaw-linkedin-lead-generation-playbook-2026
- How to Make Money with OpenClaw : https://openclawway.com/blog/openclaw-make-money-guide/

## 9.4 — Outils Complémentaires (Optionnels)

### Email Marketing

- Lemlist : https://www.lemlist.com (cold email platform)
- Instantly : https://instantly.ai (email outreach)
- SendGrid : https://sendgrid.com (email API)

### Lead Generation

- Hunter.io : https://hunter.io (email finder)
- Apollo.io : https://www.apollo.io (sales intelligence)

### Contenu

- Buffer : https://buffer.com (social media scheduling API)
- Canva API : https://www.canva.com/developers (design automation)

### Hosting VPS

- Hetzner Cloud : https://www.hetzner.com/cloud (à partir de 4.51€/mois)
- DigitalOcean : https://www.digitalocean.com (à partir de $6/mois)
- Contabo : https://contabo.com (à partir de 5.99€/mois)

---
---
---

# ANNEXE A : CHECKLIST DE LANCEMENT

## Avant de Coder

- [ ] Créer un compte API Anthropic (https://console.anthropic.com)
- [ ] Ajouter un moyen de paiement pour l'API
- [ ] Créer un projet Google Cloud pour Gmail API
- [ ] Activer Gmail API dans la console Google Cloud
- [ ] Créer les credentials OAuth2 pour Gmail
- [ ] Créer une intégration Notion (https://www.notion.so/my-integrations)
- [ ] Créer la base de données CRM dans Notion
- [ ] Partager la base Notion avec l'intégration
- [ ] Installer Node.js 20+ sur le Mac
- [ ] Installer Git

## Pendant le Développement

- [ ] Initialiser le repo Git
- [ ] Créer `.gitignore` complet
- [ ] Créer `.env.example`
- [ ] Ne JAMAIS commit `.env`
- [ ] Tester chaque module individuellement avant l'intégration
- [ ] Écrire des tests pour les modules critiques

## Avant le Déploiement

- [ ] Faire tourner 24h en mode dev sans erreur
- [ ] Vérifier que le rate limiting fonctionne
- [ ] Vérifier les logs de coûts API
- [ ] Configurer le daemon (launchd ou PM2)
- [ ] Tester le redémarrage automatique après crash
- [ ] Faire un backup de la mémoire initiale
- [ ] Configurer les alertes (email si erreur critique)

## Après le Déploiement

- [ ] Surveiller les logs pendant 48h
- [ ] Vérifier que les emails sont bien envoyés et pas en spam
- [ ] Vérifier que le CRM se met à jour correctement
- [ ] Ajuster les paramètres (nombre d'emails, fréquence, etc.)
- [ ] Commencer le warm-up progressif des emails

---
---
---

# ANNEXE B : GLOSSAIRE

| Terme | Définition |
|-------|------------|
| **Agent IA** | Un programme qui utilise un LLM pour prendre des décisions et exécuter des actions de manière autonome |
| **LLM** | Large Language Model — un modèle d'IA entraîné sur du texte (Claude, GPT, etc.) |
| **Token** | Unité de mesure du texte pour les LLMs. 1 token ≈ 4 caractères en anglais, ≈ 3 caractères en français |
| **API** | Application Programming Interface — interface pour communiquer avec un service (Claude, Gmail, Notion...) |
| **SDK** | Software Development Kit — bibliothèque de code pour faciliter l'utilisation d'une API |
| **WebSocket** | Protocole de communication bidirectionnelle en temps réel entre un client et un serveur |
| **Daemon** | Programme qui tourne en arrière-plan en permanence |
| **Cron job** | Tâche planifiée qui s'exécute à intervalles réguliers |
| **Headless browser** | Navigateur web sans interface graphique, contrôlé par code |
| **Scraping** | Extraction automatique de données depuis des pages web |
| **Cold email** | Email envoyé à un prospect qui n'a pas demandé à être contacté |
| **CRM** | Customer Relationship Management — outil de gestion des relations clients |
| **Pipeline** | Succession d'étapes dans un processus (prospection pipeline, content pipeline) |
| **OAuth2** | Protocole d'authentification sécurisé pour accéder aux APIs (Gmail, Google, etc.) |
| **Rate limiting** | Limitation du nombre de requêtes qu'on peut faire à une API par unité de temps |
| **Backoff exponentiel** | Stratégie de retry où le délai d'attente double à chaque tentative (1s, 2s, 4s, 8s...) |
| **Prompt** | Le texte/instruction qu'on envoie au LLM pour obtenir une réponse |
| **System prompt** | Instructions permanentes données au LLM pour définir son comportement |
| **Tool calling** | Capacité du LLM à appeler des fonctions/outils externes pendant sa réponse |
| **MCP** | Model Context Protocol — protocole d'Anthropic pour connecter des outils aux LLMs |
| **Baileys** | Bibliothèque Node.js non officielle pour se connecter à WhatsApp |
| **Puppeteer** | Bibliothèque Node.js de Google pour contrôler Chrome par programmation |
| **SQLite** | Base de données légère stockée dans un seul fichier |
| **PM2** | Process Manager pour Node.js — gère le redémarrage automatique |
| **launchd** | Système de gestion de services de macOS |
| **VPS** | Virtual Private Server — serveur virtuel hébergé dans le cloud |
| **SPF/DKIM** | Standards d'authentification email pour prouver que tu es l'expéditeur légitime |

---
---
---

# ANNEXE C : FAQ

**Q : Est-ce que c'est légal de scraper Google Maps ?**
Le web scraping est dans une zone grise juridique. En Belgique/UE, le RGPD s'applique pour les données personnelles. Pour les données publiques d'entreprises (nom, adresse, téléphone, email professionnel), c'est généralement toléré tant que tu respectes les limites de volume et les conditions d'utilisation du service. Ne scrape jamais de données personnelles de particuliers. Pour être complètement safe, tu peux utiliser l'API Google Places (payante mais officielle).

**Q : Est-ce que c'est légal d'envoyer des cold emails en Belgique ?**
En B2B, le cold emailing est généralement autorisé en Belgique et dans l'UE, à condition de respecter certaines règles : tu dois t'adresser à des professionnels (pas des particuliers), inclure un moyen de désinscription, identifier clairement l'expéditeur, et ne pas envoyer de contenu trompeur. Le RGPD prévoit un "intérêt légitime" pour la prospection B2B. Cela dit, reste raisonnable sur les volumes et respecte les désinscriptions.

**Q : Pourquoi ne pas juste utiliser OpenClaw ?**
Trois raisons. (1) Anthropic a bloqué l'utilisation des abonnements Claude avec OpenClaw depuis le 4 avril 2026. (2) OpenClaw a des problèmes de sécurité sérieux (ClawHavoc, CVEs multiples). (3) Un agent sur mesure est plus efficace qu'un agent généraliste pour des besoins spécifiques.

**Q : Pourquoi ne pas utiliser un autre LLM gratuit ?**
Tu peux. Ollama + Llama 3 est gratuit et tourne en local. Mais la qualité de Claude Sonnet pour la rédaction de contenu et la personnalisation d'emails est nettement supérieure aux modèles open-source actuels. La stratégie hybride (Claude pour les tâches de qualité + modèle local pour les tâches simples) est le meilleur compromis.

**Q : Combien de temps pour tout construire ?**
4 semaines à raison de 3-4 heures par jour. En intensif (8h/jour), 2 semaines suffisent pour le MVP (v1).

**Q : Est-ce que je peux partager IntraClaw avec d'autres personnes ?**
IntraClaw est conçu pour un usage personnel (Ayman). Pour le transformer en produit SaaS, il faudrait : multi-tenancy, authentification, billing, support, hébergement robuste, conformité RGPD. C'est un projet à part entière.

**Q : Et si Claude change encore ses prix ou ses conditions ?**
C'est un risque réel. La stratégie de mitigation : garder le code modulaire pour pouvoir changer de LLM facilement. L'interface `LLMClient` abstraite permettra de passer de Claude à GPT-4, DeepSeek, ou un modèle local sans réécrire tout le code.

---
---
---

# PARTIE 10 : INTRACLAW V2 — FUSION OPENCLAW + CLAW CODE

## 10.1 — Pourquoi Combiner les Deux

Le repo github.com/ultraworkers/claw-code (166K stars) est une reimplementation clean-room de l'architecture agent en Rust. Il implémente les mêmes patterns qu'OpenClaw mais de manière plus performante et plus sécurisée grâce à Rust.

### Ce qu'on prend d'OpenClaw :

- Le concept des 8 fichiers mémoire (SOUL.md, HEARTBEAT.md, MEMORY.md, etc.)
- Le système de skills (dossiers avec SKILL.md)
- Le système de channels (WhatsApp via Baileys, Telegram via grammY)
- Le heartbeat daemon (cron toutes les 30 min)
- Le Gateway WebSocket pour orchestrer

### Ce qu'on prend de Claw Code :

- L'architecture en crates Rust modulaire (api-client, runtime, tools, commands, plugins)
- Le Provider Abstraction Pattern (support multi-LLM propre)
- Le Tool Manifest System (déclaration JSON/YAML des outils)
- Le Plugin Hook Pipeline (extensibilité événementielle)
- Le Session Compaction (optimisation mémoire par résumé du contexte)
- La sécurité memory-safe de Rust


## 10.2 — Architecture Hybride IntraClaw V2

```
IntraClaw V2
├── core/                    # Rust (de claw-code)
│   ├── api-client/          # Provider abstraction (Claude, GPT, local)
│   ├── runtime/             # Session state, MCP, prompts
│   ├── tools/               # Tool manifests (Gmail, Notion, Puppeteer)
│   ├── plugins/             # Hook pipeline (pre/post processing)
│   └── scheduler/           # Heartbeat daemon (cron)
├── agents/                  # TypeScript (de OpenClaw)
│   ├── prospection/         # Agent scraping + cold email
│   ├── content/             # Agent génération contenu
│   ├── crm/                 # Agent CRM Notion
│   └── reporting/           # Agent rapport quotidien
├── channels/                # TypeScript (de OpenClaw)
│   ├── whatsapp/            # Baileys integration
│   ├── telegram/            # grammY integration
│   └── webchat/             # Interface web locale
├── memory/                  # Fichiers Markdown (de OpenClaw)
│   ├── SOUL.md
│   ├── USER.md
│   ├── MEMORY.md
│   ├── HEARTBEAT.md
│   ├── AGENTS.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   └── BOOTSTRAP.md
├── skills/                  # Dossiers avec SKILL.md
│   ├── cold-email/
│   ├── prospect-scraper/
│   ├── content-generator/
│   └── invoice-creator/
└── config/
    ├── .env                 # Secrets (API keys)
    └── config.yml           # Configuration générale
```


## 10.3 — Avantages de l'Approche Hybride

1. **Performance** : Le core en Rust est 10-100x plus rapide que le TypeScript d'OpenClaw pour le session management et le streaming
2. **Sécurité** : Rust est memory-safe, pas de buffer overflow, pas de race conditions
3. **Flexibilité** : Les agents en TypeScript sont faciles à modifier et à créer (Ayman est en info, il peut les adapter)
4. **Mémoire permanente** : Les fichiers Markdown persistent à l'infini sur disque
5. **Multi-LLM** : Le provider abstraction de claw-code permet de switcher entre Claude, GPT, Ollama sans changer le code
6. **Extensible** : Le plugin hook pipeline permet d'ajouter des comportements custom sans toucher au core
7. **Indépendant** : Pas de dépendance à OpenClaw, OpenAI, ou Anthropic pour la plateforme. Seulement pour l'API LLM.


## 10.4 — Plan de Développement V2 (Après V1)

La V1 (4 semaines, décrite dans les parties précédentes) est en pur TypeScript. C'est le MVP qui rapporte de l'argent.

La V2 (4-6 semaines supplémentaires) intègre les composants Rust de claw-code :

**Semaine 5-6 :** Porter le api-client et le runtime de claw-code vers IntraClaw

**Semaine 7-8 :** Implémenter le tool manifest system et le plugin pipeline

**Semaine 9-10 :** Ajouter les channels (WhatsApp, Telegram) et le webchat

**Semaine 10+ :** Optimisation, tests, déploiement VPS


## 10.5 — Ce qui Rend IntraClaw MEILLEUR qu'OpenClaw

| Feature | OpenClaw | IntraClaw V2 |
|---------|----------|-------------|
| Core | TypeScript (lent) | Rust (ultra-rapide) |
| Sécurité | CVE-2026-25253, ClawHavoc | Pas de ClawHub, skills privées |
| LLM | OpenAI-first | Claude-first (ton abonnement) |
| Channels | 50+ (complexe) | 2-3 (simple, ce dont t'as besoin) |
| Skills | 13K+ publiques (risque sécurité) | Custom uniquement (100% safe) |
| Mémoire | Fichiers MD | Fichiers MD + SQLite (backup) |
| Coût | API OpenAI obligatoire | Claude Agent SDK (ton abonnement) |
| Propriétaire | Fondation OpenClaw/OpenAI | TOI (Ayman, 100%) |
| Focus | Généraliste | Spécialisé prospection + agence web |


## 10.6 — Risques et Mitigation

**Risque 1 : Rust est difficile à apprendre**
Mitigation : Le core Rust est compilé une fois. Les agents et skills sont en TypeScript (facile). Tu n'as pas besoin de toucher au Rust au quotidien.

**Risque 2 : Le repo claw-code n'est pas maintenu**
Mitigation : On fork et on maintient notre propre version. Le code est open source (MIT), on peut faire ce qu'on veut.

**Risque 3 : Intégrer Rust + TypeScript est complexe**
Mitigation : Le core Rust expose une API HTTP/WebSocket. Les agents TypeScript communiquent via cette API. Pas de binding direct, communication réseau standard.

---
---
---

# PARTIE 11 : INTRACLAW ULTIMATE — LE MEILLEUR DE CHAQUE ALTERNATIVE

## 11.1 — Les 5 Meilleures Alternatives à OpenClaw Analysées

Un rapport indépendant (Manus, avril 2026) a identifié 5 alternatives majeures à OpenClaw. Pour construire IntraClaw, on prend le meilleur de CHACUNE.

### Hermes Agent (30K+ stars GitHub)

- **Ce qu'il fait bien :** Boucle d'apprentissage intégrée. L'agent s'AMÉLIORE automatiquement avec le temps. Mémoire persistante avancée (9/10). Modélisation de l'utilisateur — il comprend de mieux en mieux Ayman au fil du temps.
- **Ce qu'on prend pour IntraClaw :** Le système de self-improvement loop. Après chaque tâche, IntraClaw analyse ce qui a marché et ce qui n'a pas marché, et met à jour ses règles automatiquement dans MEMORY.md. C'est le feature #1 qui manque à OpenClaw.

### Paperclip (30K+ stars, lancé mars 2026)

- **Ce qu'il fait bien :** Orchestration multi-agents en structure d'entreprise. Organigrammes, délégation, budget management, heartbeat system. Un "hedge fund" d'agents IA.
- **Ce qu'on prend pour IntraClaw :** L'architecture multi-agents avec spécialisation. Au lieu d'un seul agent qui fait tout, IntraClaw aura des agents spécialisés : Agent Prospection, Agent Content, Agent CRM, Agent Reporting. Chacun avec sa propre mémoire et ses propres skills. Un Agent Coordinator les orchestre.

### NanoClaw (6.7K stars)

- **Ce qu'il fait bien :** Sécurité maximale (10/10). Seulement 5 fichiers. Isolation Docker/Apple container. Support Raspberry Pi. WhatsApp natif. Surface d'attaque minimale.
- **Ce qu'on prend pour IntraClaw :** L'approche minimaliste et sécurisée. IntraClaw sera petit (pas 50 packages npm comme OpenClaw), avec isolation Docker optionnelle, et ZERO dépendance aux registres publics de skills (pas de ClawHub = pas de skills malveillantes).

### Nanobot (26.8K stars)

- **Ce qu'il fait bien :** 4000 lignes de Python seulement. 99% plus petit qu'OpenClaw. MCP server intégré. Mémoire locale. Compression de tokens. Ultra-facile à comprendre et modifier.
- **Ce qu'on prend pour IntraClaw :** La philosophie "less is more". Le code d'IntraClaw sera lisible en une après-midi. Pas de sur-ingénierie. Chaque ligne de code a une raison d'être. Si le codebase entier tient en 5000-10000 lignes, c'est parfait.

### ZeroClaw (15K stars)

- **Ce qu'il fait bien :** Reimplementation en Rust. Démarrage en 10ms (400x plus rapide qu'OpenClaw). 6-8MB RAM. Compatible hardware à $10. Edge computing.
- **Ce qu'on prend pour IntraClaw :** Les composants critiques en Rust pour la performance (scheduler, session management, streaming). Le reste en TypeScript pour la flexibilité. Architecture hybride Rust+TypeScript comme définie dans la Partie 10.


## 11.2 — Architecture IntraClaw Ultimate — Fusion de Tout

```
INTRACLAW ULTIMATE =
  Hermes Agent (self-improvement loop, mémoire 9/10)
+ Paperclip (multi-agents, orchestration)
+ NanoClaw (sécurité 10/10, minimalisme)
+ Nanobot (code minimal, lisible)
+ ZeroClaw (Rust core, performance 10/10)
+ OpenClaw (heartbeat, skills, channels concept)
+ Claw Code (provider abstraction, tool manifests, plugin hooks)
```


## 11.3 — Ce qui Rend IntraClaw MEILLEUR que TOUS les Autres

| Feature | OpenClaw | Hermes | Paperclip | NanoClaw | Nanobot | ZeroClaw | INTRACLAW |
|---------|----------|--------|-----------|----------|---------|----------|-----------|
| Mémoire | 7/10 | 9/10 | 7/10 | 6/10 | 8/10 | 10/10 | 10/10 |
| Performance | 6/10 | 7/10 | 7/10 | 9/10 | 9/10 | 10/10 | 10/10 |
| Sécurité | 4/10 | 7/10 | 7/10 | 10/10 | 8/10 | 8/10 | 10/10 |
| Simplicité | 3/10 | 6/10 | 5/10 | 8/10 | 9/10 | 7/10 | 8/10 |
| Self-improve | 0/10 | 9/10 | 5/10 | 0/10 | 3/10 | 0/10 | 9/10 |
| Multi-agent | 5/10 | 7/10 | 10/10 | 3/10 | 3/10 | 5/10 | 9/10 |
| Propriétaire | Non | Non | Non | Non | Non | Non | TOI |


## 11.4 — Les 7 Principes de Design d'IntraClaw

1. **Self-Improvement** (de Hermes) : L'agent apprend de chaque interaction et s'améliore
2. **Multi-Agent** (de Paperclip) : Agents spécialisés qui collaborent
3. **Security-First** (de NanoClaw) : Isolation, zéro registre public, skills privées
4. **Minimal Code** (de Nanobot) : Maximum 10 000 lignes, lisible en une après-midi
5. **Rust Performance** (de ZeroClaw) : Core ultra-rapide, 10ms startup, 8MB RAM
6. **Heartbeat + Skills** (d'OpenClaw) : Tâches planifiées + système extensible
7. **Provider Abstraction** (de Claw Code) : Multi-LLM, pas verrouillé à un fournisseur


## 11.5 — Implémentation du Self-Improvement Loop

Le feature le plus important emprunté à Hermes Agent. Voici comment ça marche dans IntraClaw :

Après CHAQUE tâche exécutée :

1. L'agent évalue le résultat (succès/échec/partiel)
2. Si échec ou résultat partiel → analyse pourquoi
3. Met à jour MEMORY.md avec la leçon apprise
4. Met à jour AGENTS.md avec la nouvelle règle
5. La prochaine fois qu'une tâche similaire arrive, l'agent applique la leçon

**Exemple concret :**

- **Tâche :** Envoyer cold email à prospect X
- **Résultat :** Email bounced (adresse invalide)
- **Leçon :** "Vérifier la validité de l'email avant d'envoyer (utiliser un service de vérification)"
- **Règle ajoutée à AGENTS.md :** "Avant chaque envoi d'email, vérifier l'adresse avec un ping SMTP"
- **Prochaine fois :** L'agent vérifie automatiquement avant d'envoyer

Ce système fait qu'IntraClaw devient MEILLEUR chaque jour, contrairement à OpenClaw qui reste statique.


## 11.6 — Implémentation du Multi-Agent System

Emprunté à Paperclip. Voici la structure :

```
Agent Coordinator (cerveau)
├── Agent Prospection
│   ├── Skill : scraping Google Maps
│   ├── Skill : extraction emails
│   └── Skill : enrichissement données
├── Agent Cold Email
│   ├── Skill : rédaction personnalisée
│   ├── Skill : envoi Gmail
│   └── Skill : tracking réponses
├── Agent Content
│   ├── Skill : génération posts
│   ├── Skill : planification calendrier
│   └── Skill : analyse engagement
├── Agent CRM
│   ├── Skill : mise à jour Notion
│   ├── Skill : pipeline management
│   └── Skill : alertes prospects chauds
└── Agent Reporting
    ├── Skill : compilation données
    ├── Skill : rapport quotidien
    └── Skill : prévisions revenus
```

**Chaque agent :**
- A sa propre mémoire (fichier dédié dans memory/)
- A ses propres skills (dossier dédié dans skills/)
- Communique avec le Coordinator via messages internes
- Peut être activé/désactivé indépendamment
- Tourne dans son propre thread/process

**Le Coordinator :**
- Reçoit les tâches du heartbeat
- Détermine quel agent doit s'en charger
- Surveille l'exécution
- Compile les résultats
- Applique le self-improvement loop


## 11.7 — Plan de Dev Mis à Jour

Le plan original (Parties 5 et 10) reste valide. On ajoute :

**Semaine 1-4 :** IntraClaw V1 (comme prévu, TypeScript MVP)

**Semaine 5-6 :** Intégration Rust core (de ZeroClaw/Claw Code)

**Semaine 7-8 :** Self-improvement loop (de Hermes)

**Semaine 9-10 :** Multi-agent system (de Paperclip)

**Semaine 11-12 :** Security hardening (de NanoClaw) + optimisation (de Nanobot)

Après semaine 12 : IntraClaw est l'agent IA personnel le plus complet, le plus performant, et le plus sécurisé qui existe. Et il t'appartient à 100%.

---
---
---

# PARTIE 12 : GRAVITYCLAW — LEÇONS À INTÉGRER DANS INTRACLAW

## 12.1 — Qu'est-ce que GravityClaw ?

GravityClaw est un système créé par Jack Roberts qui combine OpenClaw avec Google AntiGravity pour créer un "employé numérique" autonome. Il a présenté 7 cas d'usage révolutionnaires dans une vidéo virale (33 min). Le système tourne sur Railway (hébergement cloud pas cher), utilise Pinecone pour la mémoire sémantique, et coûte environ 0,06$/semaine en utilisation légère.


## 12.2 — Le Framework CLAWS — À Reproduire dans IntraClaw

GravityClaw utilise un framework en 5 étapes appelé CLAWS. C'est exactement ce qu'IntraClaw doit implémenter :

### C — Connect (Connexion)

- Interface via Telegram (ou WhatsApp)
- Docker + Node.js comme base
- Sécurité par whitelisting d'ID utilisateur (seul Ayman peut parler à son agent)
- **Pour IntraClaw :** On utilise Telegram (grammY) ou WhatsApp (Baileys) comme interface. Whitelisting par défaut.

### L — Listen (Écouter)

- Groq API pour la transcription vocale ultra-rapide (Whisper)
- ElevenLabs pour la synthèse vocale avec intelligence émotionnelle
- L'agent peut ÉCOUTER des messages vocaux et RÉPONDRE en voix
- **Pour IntraClaw :** Intégrer Groq Whisper pour la transcription vocale (gratuit tier). Ayman envoie un vocal sur Telegram/WhatsApp, IntraClaw le transcrit et répond. V2 : ajouter ElevenLabs pour les réponses vocales.

### A — Archive (Mémoire)

Le système de mémoire 3 tiers — C'EST LE FEATURE LE PLUS IMPORTANT :

**Tier 1 — Core Memory (mémoire permanente) :**
- Faits toujours présents dans le system prompt
- Exemples : "Ayman a 20 ans", "Il a une agence web à Bruxelles", "Il utilise Claude Code"
- Stocké dans un fichier ou base de données SQL
- **Pour IntraClaw :** C'est notre USER.md + SOUL.md. Toujours injecté dans chaque prompt.

**Tier 2 — Conversation Buffer (mémoire courte) :**
- Cache des messages récents de la conversation en cours
- Permet de garder le fil de la discussion
- **Pour IntraClaw :** Les derniers 50-100 messages en mémoire RAM. Compaction quand ça dépasse.

**Tier 3 — Semantic Long-Term Memory (mémoire sémantique) :**
- Base de données vectorielle Pinecone
- Après CHAQUE échange, le système extrait automatiquement les faits importants, préférences et engagements
- Les stocke comme embeddings vectoriels dans Pinecone
- Quand une nouvelle question arrive, recherche sémantique dans l'index pour récupérer le contexte pertinent du passé
- L'agent se SOUVIENT de TOUT, même des conversations d'il y a 6 mois
- **Pour IntraClaw :** Intégrer ChromaDB (gratuit, local, pas de cloud) ou Pinecone (cloud, freemium) comme mémoire vectorielle. Après chaque tâche, extraire les faits clés et les vectoriser. Avant chaque nouvelle tâche, recherche sémantique pour récupérer le contexte pertinent. C'est CE feature qui fait la différence entre un agent basique et un agent qui te connaît vraiment.

### W — Wire (Connexions)

- MCP servers pour se connecter à tout : Zapier, Notion, GitHub, Gmail, bases de données custom
- **Pour IntraClaw :** On a déjà les MCPs Notion et Gmail. Ajouter : Google Sheets, Google Calendar, et un MCP custom pour le scraping.

### S — Sense (Heartbeat / Sens)

- Node-cron job qui se déclenche à 8h du matin
- Envoie un message proactif personnalisé (briefing matinal)
- L'agent PREND L'INITIATIVE sans qu'on lui demande
- **Pour IntraClaw :** C'est notre HEARTBEAT.md. Briefing à 8h : météo Bruxelles, prospects à relancer aujourd'hui, posts à publier, revenus du mois.


## 12.3 — Les 7 Niveaux de GravityClaw — Roadmap IntraClaw

### Niveau 1 : Gestion des tâches par voix

- Envoyer un vocal → IntraClaw l'ajoute dans le CRM Notion ou la todo list
- **Stack :** Groq Whisper + Notion API
- **Priorité IntraClaw :** V2 (semaine 7-8)

### Niveau 2 : Mémoire sémantique (Pinecone/ChromaDB)

- L'agent se souvient de TOUT grâce aux embeddings vectoriels
- **Stack :** ChromaDB (local, gratuit) ou Pinecone (cloud, freemium)
- **Priorité IntraClaw :** V1 (semaine 3-4) — C'EST CRITIQUE

### Niveau 3 : Analyse de contenu externe

- Analyser des vidéos YouTube, des PDFs, des articles pour alimenter la base de connaissances
- **Stack :** YouTube Transcript API + PDF parser + Web scraper
- **Priorité IntraClaw :** V2 (semaine 9-10)

### Niveau 4 : Génération de documents

- Créer des factures PDF, des devis, des propositions directement depuis le chat
- **Stack :** Skill facturation-freelance d'Ayman (déjà créé !)
- **Priorité IntraClaw :** V1 (semaine 2) — On a déjà le skill

### Niveau 5 : Mission Control (Dashboard)

- Tableau de bord centralisé : coûts, activité agents, config, métriques
- Vue temps réel de tout ce que fait IntraClaw
- **Stack :** React + WebSocket + SQLite
- **Priorité IntraClaw :** V2 (semaine 11-12)

### Niveau 6 : Pipeline de contenu

- Idéation → rédaction → planification → publication de posts/scripts
- **Stack :** Claude API + Notion Content Pipeline (déjà créé !)
- **Priorité IntraClaw :** V1 (semaine 1-2) — Déjà opérationnel via tâches programmées

### Niveau 7 : Briefing quotidien automatisé

- Chaque matin : météo, actualités, emploi du temps, prospects, revenus
- **Stack :** OpenWeatherMap API + Google Calendar API + Notion API
- **Priorité IntraClaw :** V1 (semaine 3-4)


## 12.4 — Architecture Technique GravityClaw → Adaptée pour IntraClaw

### Hébergement

- GravityClaw : Railway (cloud, ~5$/mois)
- IntraClaw V1 : Mac local (gratuit)
- IntraClaw V2 : VPS Contabo/Hetzner (~5€/mois) ou Railway

### LLM

- GravityClaw : OpenRouter (accès multi-modèles pas cher, ~0,06$/semaine)
- IntraClaw : Claude Agent SDK (inclus dans abonnement Claude Max) + OpenRouter en fallback pour les modèles pas chers (Gemini Flash, DeepSeek V3 pour les tâches légères)

### Mémoire

- GravityClaw : Pinecone (cloud vectoriel)
- IntraClaw : ChromaDB (local, gratuit, open source) pour la V1, migration Pinecone pour la V2 cloud

### Base de données

- GravityClaw : Supabase
- IntraClaw : SQLite (local, gratuit, zéro config) pour la V1, Supabase pour la V2

### Interface

- GravityClaw : Telegram
- IntraClaw : Telegram (grammY) + WhatsApp (Baileys) en V2

### Coûts comparés

- GravityClaw : ~0,06$/semaine (OpenRouter) + ~5$/mois (Railway) = ~7$/mois
- IntraClaw V1 : 0€ (Claude Max déjà payé + Mac local + SQLite + ChromaDB)
- IntraClaw V2 sur VPS : ~5€/mois (VPS) + ~2€/mois (OpenRouter fallback) = ~7€/mois


## 12.5 — Ce qu'on Prend de GravityClaw pour IntraClaw

1. **Le framework CLAWS** : Connect → Listen → Archive → Wire → Sense. Structure parfaite pour organiser le développement.
2. **La mémoire sémantique 3 tiers** : Core + Buffer + Vector. C'est le feature game-changer.
3. **La transcription vocale via Groq** : L'agent comprend les messages vocaux.
4. **Le briefing matinal proactif** : L'agent prend l'initiative chaque matin.
5. **Le Mission Control** : Dashboard pour tout visualiser.
6. **Le déploiement Railway** : Pas de ports ouverts, sécurisé par défaut.
7. **L'utilisation d'OpenRouter** : Multi-modèles pas cher en fallback.


## 12.6 — Plan de Dev IntraClaw Mis à Jour (Final)

### Phase 1 — MVP Argent (Semaines 1-4)

- **Semaine 1 :** Setup projet + mémoire Markdown + scheduler node-cron
- **Semaine 2 :** Module prospection (scraping + emails) + module facturation
- **Semaine 3 :** Mémoire sémantique ChromaDB + briefing quotidien
- **Semaine 4 :** Tests + déploiement Mac + premier run complet

### Phase 2 — Core Rust + Intelligence (Semaines 5-8)

- **Semaine 5-6 :** Porter le core en Rust (scheduler, session management)
- **Semaine 7-8 :** Self-improvement loop (Hermes) + transcription vocale (Groq)

### Phase 3 — Multi-Agent + Channels (Semaines 9-12)

- **Semaine 9-10 :** Multi-agent system (Paperclip) + Telegram/WhatsApp
- **Semaine 11-12 :** Mission Control dashboard + security hardening (NanoClaw)

### Phase 4 — Cloud + Scale (Semaine 13+)

- Migration VPS (Railway ou Hetzner)
- Pinecone cloud pour la mémoire
- Supabase pour les données
- OpenRouter fallback multi-modèles

Après Phase 4 : IntraClaw est l'agent IA le plus complet, performant et personnalisé qui existe. Il te connaît, il apprend, il s'améliore, et il tourne 24/7. Et il t'appartient.

---
---
---

# PARTIE 13 : GUIDE DE SÉCURISATION VPS — INTRACLAW EN PRODUCTION

Ce guide couvre TOUT ce qu'il faut faire pour sécuriser un VPS avant d'y mettre IntraClaw. Chaque étape est expliquée simplement.


## 13.1 — Pourquoi la Sécurité c'est Critique

Quand tu mets IntraClaw sur un VPS, tu mets une machine sur internet 24/7. Cette machine a accès à :

- Ton Gmail (intra.web.site1@gmail.com) → peut envoyer des emails en ton nom
- Ton Notion → contient tous tes prospects et clients
- Ton API Claude → coûte de l'argent si quelqu'un l'utilise
- Tes données business → prospects, revenus, contacts

Si un hacker accède à ton VPS, il a accès à TOUT. C'est pour ça qu'on sécurise comme un bunker.

Rappel : OpenClaw a eu 135 000 instances exposées sur internet, 63% vulnérables. On ne fait PAS la même erreur.


## 13.2 — Choix du VPS

### Fournisseurs recommandés (prix/qualité)

1. **Hetzner** (Allemagne) — 3,29€/mois pour 2 vCPU, 4GB RAM, 40GB SSD. Le meilleur rapport qualité/prix. Datacenter en Europe (bon pour RGPD).
2. **Contabo** (Allemagne) — 4,99€/mois pour 4 vCPU, 8GB RAM, 50GB SSD. Plus de puissance pour le même prix.
3. **Hostinger** — 4,99€/mois, installation OpenClaw en 1 clic (mais on installe IntraClaw, pas OpenClaw).
4. **Railway** — ~5$/mois, le plus simple (PaaS, pas de serveur à gérer), mais moins de contrôle.
5. **DigitalOcean** — 6$/mois, bonne documentation, interface clean.

### Specs requises pour IntraClaw

- **Minimum :** 1 vCPU, 2GB RAM, 20GB SSD (IntraClaw est léger, pas comme OpenClaw)
- **Recommandé :** 2 vCPU, 4GB RAM, 40GB SSD (confortable pour ChromaDB + multi-agents)
- **OS :** Ubuntu 22.04 LTS ou Debian 12

### Ce qu'on NE prend PAS

- Pas de Windows Server (cher, inutile)
- Pas de shared hosting (pas assez de contrôle)
- Pas de serveur aux USA si tu veux rester conforme RGPD (tes données prospects sont des données personnelles)


## 13.3 — Première Connexion — Sécurisation Initiale

### Étape 1 : Se connecter en SSH

```bash
ssh root@IP_DU_VPS
```

Tu recevras l'IP et le mot de passe root par email après l'achat du VPS.

### Étape 2 : Mettre à jour le système

```bash
apt update && apt upgrade -y
```

Toujours la première chose à faire. Ça installe les derniers patches de sécurité.

### Étape 3 : Créer un utilisateur non-root

JAMAIS travailler en root au quotidien. Root peut tout détruire.

```bash
adduser intraclaw
usermod -aG sudo intraclaw
```

Ça crée un utilisateur "intraclaw" avec les droits sudo (admin quand tu en as besoin).

### Étape 4 : Configurer SSH par clé (CRITIQUE)

Sur TON Mac (pas le VPS) :

```bash
ssh-keygen -t ed25519 -C "ayman@intraclaw"
```

Ça génère une paire de clés : une privée (reste sur ton Mac) et une publique (va sur le VPS).

Copier la clé publique sur le VPS :

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub intraclaw@IP_DU_VPS
```

Tester que ça marche :

```bash
ssh intraclaw@IP_DU_VPS
```

Si tu te connectes sans mot de passe → c'est bon.

### Étape 5 : Désactiver la connexion par mot de passe et root

```bash
sudo nano /etc/ssh/sshd_config
```

Modifier ces lignes :

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222
```

On change aussi le port SSH de 22 à 2222 (les bots scannent le port 22 en permanence).

Redémarrer SSH :

```bash
sudo systemctl restart sshd
```

À partir de maintenant, pour te connecter :

```bash
ssh -p 2222 intraclaw@IP_DU_VPS
```

Sans ta clé privée, personne ne peut se connecter. Même avec un mot de passe.

### Étape 6 : Configurer le firewall UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp comment 'SSH'
sudo ufw enable
```

C'est tout. Le VPS :

- BLOQUE tout le trafic entrant (personne ne peut se connecter)
- AUTORISE tout le trafic sortant (IntraClaw peut envoyer des emails, appeler les APIs)
- AUTORISE uniquement le port 2222 pour SSH (toi)

Pas de port 18789 (pas de Gateway exposée comme OpenClaw).
Pas de port 80/443 (pas de serveur web exposé).
RIEN n'est accessible de l'extérieur sauf SSH.

### Étape 7 : Installer fail2ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

fail2ban bannit automatiquement les IPs qui tentent trop de connexions SSH. Protection contre le brute-force.

Configuration :

```bash
sudo nano /etc/fail2ban/jail.local
```

```
[sshd]
enabled = true
port = 2222
maxretry = 3
bantime = 3600
findtime = 600
```

3 tentatives ratées → IP bannie pendant 1 heure.

### Étape 8 : Mises à jour automatiques

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

Le VPS installera automatiquement les patches de sécurité. Tu n'as rien à faire.


## 13.4 — Installation Docker (Isolation)

### Pourquoi Docker ?

IntraClaw tourne dans un container Docker isolé. Même si un bug dans IntraClaw est exploité, l'attaquant est enfermé dans le container et ne peut pas accéder au système hôte.

### Installation

```bash
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker intraclaw
```

### Dockerfile IntraClaw

```dockerfile
FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# Créer un user non-root dans le container aussi
RUN adduser --disabled-password --gecos '' agent
USER agent

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  intraclaw:
    build: .
    restart: always
    env_file: .env
    volumes:
      - ./memory:/app/memory
      - ./skills:/app/skills
      - ./data:/app/data
    networks:
      - intraclaw-net
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'

  chromadb:
    image: chromadb/chroma:latest
    restart: always
    volumes:
      - ./chroma-data:/chroma/chroma
    networks:
      - intraclaw-net
    expose:
      - "8000"

networks:
  intraclaw-net:
    driver: bridge
```

Points clés :

- `restart: always` → redémarre automatiquement si crash
- `env_file: .env` → secrets dans un fichier séparé
- Volumes pour la persistance (mémoire, skills, données)
- Limite de mémoire et CPU (protection contre les boucles infinies)
- ChromaDB dans le même réseau Docker mais pas exposé à l'extérieur
- `expose` au lieu de `ports` → accessible uniquement dans le réseau Docker, pas depuis internet


## 13.5 — Gestion des Secrets

### Le fichier .env

```bash
# NE JAMAIS COMMIT CE FICHIER SUR GIT
# API Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx

# Gmail
GMAIL_CLIENT_ID=xxxxx
GMAIL_CLIENT_SECRET=xxxxx
GMAIL_REFRESH_TOKEN=xxxxx

# Notion
NOTION_API_KEY=ntn_xxxxx

# Telegram
TELEGRAM_BOT_TOKEN=xxxxx
TELEGRAM_ALLOWED_USER_ID=123456789

# Groq (transcription vocale)
GROQ_API_KEY=gsk_xxxxx

# ChromaDB
CHROMA_HOST=chromadb
CHROMA_PORT=8000
```

### Permissions du fichier

```bash
chmod 600 .env
```

Seul l'utilisateur intraclaw peut lire le fichier. Personne d'autre.

### .gitignore

```
.env
data/
chroma-data/
memory/MEMORY.md
```

Les secrets et les données ne doivent JAMAIS être sur Git.


## 13.6 — Sécurisation de l'Agent Lui-Même

### Whitelisting Telegram

IntraClaw ne répond qu'à TON ID Telegram. Tous les autres messages sont ignorés silencieusement.

```typescript
const ALLOWED_USER_IDS = [process.env.TELEGRAM_ALLOWED_USER_ID];

bot.on('message', (ctx) => {
  if (!ALLOWED_USER_IDS.includes(String(ctx.from?.id))) {
    return; // Ignore silencieusement
  }
  // Traiter le message
});
```

### Rate limiting interne

Limite le nombre d'actions par minute pour éviter les boucles infinies et les coûts API explosifs :

```typescript
const MAX_ACTIONS_PER_MINUTE = 30;
const MAX_EMAILS_PER_DAY = 50;
const MAX_API_COST_PER_DAY = 5.00; // euros
```

### Pas de ClawHub

IntraClaw n'a PAS de registre de skills public. Toutes les skills sont créées par toi, stockées localement. Zéro risque de skills malveillantes (le problème #1 d'OpenClaw avec ClawHavoc).

### Logging

Chaque action est loggée avec timestamp :

```
[2026-04-05 08:00:01] HEARTBEAT: Démarrage briefing matinal
[2026-04-05 08:00:03] PROSPECTION: 5 nouveaux prospects trouvés
[2026-04-05 08:00:15] EMAIL: Brouillon créé pour "Boulangerie Martin"
[2026-04-05 08:00:16] NOTION: CRM mis à jour, statut → "Contacté"
```

Les logs sont dans `data/logs/` et tournent quotidiennement (un fichier par jour).


## 13.7 — Monitoring et Alertes

### Uptime monitoring

Utiliser UptimeRobot (gratuit, 50 monitors) pour vérifier que le VPS est en ligne :

- Ping le VPS toutes les 5 minutes
- Alerte par email/Telegram si le VPS ne répond plus

### Monitoring ressources

```bash
# Installer htop pour le monitoring
sudo apt install htop -y

# Script de monitoring automatique
cat << 'EOF' > /home/intraclaw/monitor.sh
#!/bin/bash
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
MEM=$(free -m | awk 'NR==2{printf "%s/%sMB (%.2f%%)", $3,$2,$3*100/$2 }')
DISK=$(df -h / | awk 'NR==2{print $5}')
echo "CPU: $CPU% | MEM: $MEM | DISK: $DISK"
EOF
chmod +x /home/intraclaw/monitor.sh
```

### Alertes coût API

IntraClaw track ses propres coûts API. Si le coût journalier dépasse le budget (5€/jour), l'agent se met en pause et t'envoie une alerte sur Telegram.


## 13.8 — Backups Automatiques

### Backup quotidien de la mémoire

```bash
# Crontab pour backup quotidien à 3h du matin
crontab -e
```

```
0 3 * * * tar -czf /home/intraclaw/backups/intraclaw-$(date +\%Y\%m\%d).tar.gz /home/intraclaw/intraclaw/memory /home/intraclaw/intraclaw/data /home/intraclaw/intraclaw/skills
```

### Retention

Garder les 30 derniers backups, supprimer les plus vieux :

```bash
find /home/intraclaw/backups -name "intraclaw-*.tar.gz" -mtime +30 -delete
```

### Backup hors-site

Copier le backup sur ton Mac chaque semaine via rsync :

```bash
rsync -avz -e "ssh -p 2222" intraclaw@IP_VPS:/home/intraclaw/backups/ ~/Desktop/intraclaw-backups/
```


## 13.9 — Accès à Distance Sécurisé

### Option 1 : SSH tunnel (recommandé)

Pour accéder au dashboard Mission Control depuis ton Mac sans l'exposer sur internet :

```bash
ssh -p 2222 -L 8080:localhost:3000 intraclaw@IP_VPS
```

Puis ouvrir http://localhost:8080 dans ton navigateur. Le dashboard est accessible via un tunnel chiffré, pas directement sur internet.

### Option 2 : Tailscale (encore mieux)

Tailscale crée un réseau privé virtuel entre ton Mac et ton VPS. Gratuit pour usage personnel.

```bash
# Sur le VPS
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

```bash
# Sur ton Mac
brew install tailscale
tailscale up
```

Ensuite, accéder au VPS via son IP Tailscale (100.x.x.x) comme si c'était sur ton réseau local. Zéro port exposé sur internet.

### Option 3 : WireGuard VPN

Plus technique mais ultra-performant. Un VPN point-to-point entre ton Mac et le VPS.


## 13.10 — Checklist de Sécurité — Avant de Mettre IntraClaw en Production

```
[ ] VPS acheté chez Hetzner/Contabo (datacenter EU)
[ ] Système mis à jour (apt update && upgrade)
[ ] Utilisateur non-root créé ("intraclaw")
[ ] SSH par clé uniquement (pas de mot de passe)
[ ] Connexion root désactivée
[ ] Port SSH changé (2222 au lieu de 22)
[ ] Firewall UFW activé (deny incoming, allow outgoing, allow 2222)
[ ] fail2ban installé et configuré
[ ] Mises à jour automatiques activées
[ ] Docker installé
[ ] IntraClaw dans un container Docker
[ ] Fichier .env avec permissions 600
[ ] .env dans .gitignore
[ ] Whitelisting Telegram activé
[ ] Rate limiting interne configuré
[ ] Logging activé
[ ] UptimeRobot configuré
[ ] Backup quotidien automatisé
[ ] Accès à distance via SSH tunnel ou Tailscale
[ ] AUCUN port exposé sauf SSH
```

Si toutes les cases sont cochées → ton IntraClaw est un bunker. Personne ne peut y accéder sauf toi.


## 13.11 — Comparaison Sécurité : IntraClaw vs OpenClaw

| Aspect | OpenClaw | IntraClaw |
|--------|----------|-----------|
| Gateway exposée | Port 18789 ouvert | AUCUN port ouvert |
| Skills publiques | ClawHub (800+ malveillantes trouvées) | Skills privées uniquement |
| Authentification | Token souvent mal configuré | SSH clé + Telegram whitelist |
| CVE connus | CVE-2026-25253 (RCE critique) | Aucun (code minimal, privé) |
| Instances exposées | 135 000 sur internet | 0 (pas de port entrant) |
| Container isolation | Optionnel, souvent ignoré | Docker par défaut |
| Monitoring coûts | Pas de cap intégré | Budget limit + alerte auto |
| Backups | Manuel | Automatique quotidien |

---
---
---

# PARTIE 14 : INTRACLAW ZÉRO COÛT — UTILISER CLAUDE MAX SANS PAYER L'API

## 14.1 — Le Problème

Ayman a un abonnement Claude Max (~100€/mois). Il ne veut PAS payer l'API Anthropic en plus. Le Claude Agent SDK nécessite une clé API (pay-per-token). OpenClaw a été bloqué par Anthropic. Comment utiliser Claude dans IntraClaw sans coût supplémentaire ?


## 14.2 — La Solution : Claude Code CLI comme Moteur

L'abonnement Claude Max inclut Claude Code CLI en illimité. Claude Code est un programme en ligne de commande qui permet d'envoyer des tâches à Claude et de récupérer les résultats.

IntraClaw appelle Claude Code en sous-process Node.js :

```typescript
import { execSync } from 'child_process';

function askClaude(prompt: string): string {
  const result = execSync(
    `echo "${prompt.replace(/"/g, '\\"')}" | claude --print`,
    {
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes max
      maxBuffer: 1024 * 1024 // 1MB
    }
  );
  return result.trim();
}

// Exemple d'utilisation
const emailDraft = askClaude(`
  Rédige un cold email professionnel pour l'entreprise "Boulangerie Martin"
  à Bruxelles qui n'a pas de site web.
  Utilise le template de prospection TYPE A du skill facturation-freelance.
  Signe avec : Ayman Idamre, intra.web.site1@gmail.com, intra-site.com
`);
```

Avantages :

- 0€ en plus (utilise l'abonnement Max)
- Pas de clé API nécessaire
- Pas de rate limiting API (les limites Max sont généreuses)
- Claude Code a accès aux outils MCP si configuré
- Fonctionne tant que Claude Code est installé sur la machine


## 14.3 — Architecture "Zero Cost"

```
IntraClaw (TypeScript/Node.js)
│
├── Tâches légères (pas besoin de Claude)
│   ├── Scraping Google Maps → Puppeteer (gratuit)
│   ├── Envoi email → Gmail API (gratuit)
│   ├── Mise à jour CRM → Notion API (gratuit)
│   ├── Scheduling → node-cron (gratuit)
│   └── Mémoire → ChromaDB local (gratuit)
│
└── Tâches intelligentes (besoin de Claude)
    ├── Rédaction cold emails → claude --print (abonnement Max)
    ├── Analyse de sites web → claude --print (abonnement Max)
    ├── Génération de contenu → claude --print (abonnement Max)
    ├── Résumés et rapports → claude --print (abonnement Max)
    └── Self-improvement loop → claude --print (abonnement Max)
```

Règle d'or : N'appeler Claude QUE quand c'est nécessaire. Tout ce qui peut être fait en code pur (scraping, API calls, formatage, scheduling) se fait SANS Claude.


## 14.4 — Optimisation du Quota Claude Max

L'abonnement Max a des limites (même si elles sont généreuses). Pour ne pas les atteindre :

1. **Cache les réponses** : Si Claude a déjà rédigé un email TYPE A pour une boulangerie, réutiliser le template avec juste le nom changé. Pas besoin de rappeler Claude.

2. **Batch les requêtes** : Au lieu de 10 appels Claude séparés pour 10 prospects, faire 1 appel avec les 10 prospects d'un coup.

3. **Pré-générer les templates** : Au lancement d'IntraClaw, demander à Claude de générer tous les templates d'emails, messages, rapports. Les stocker dans skills/. Ensuite IntraClaw remplace juste les variables (nom, entreprise, ville) sans rappeler Claude.

4. **Limiter les appels/jour** : Max 50 appels Claude par jour. Largement suffisant pour la prospection + contenu + reporting.

```typescript
// Compteur quotidien d'appels Claude
let dailyClaudeCalls = 0;
const MAX_DAILY_CALLS = 50;

function askClaude(prompt: string): string {
  if (dailyClaudeCalls >= MAX_DAILY_CALLS) {
    console.log('[WARN] Limite quotidienne Claude atteinte');
    return '[Limite atteinte - tâche reportée à demain]';
  }
  dailyClaudeCalls++;
  // ... appel Claude Code CLI
}

// Reset à minuit
schedule('0 0 * * *', () => { dailyClaudeCalls = 0; });
```


## 14.5 — Fallback Gratuit : Modèles Locaux via Ollama

Si jamais le quota Claude Max est atteint, IntraClaw peut basculer sur un modèle local gratuit via Ollama :

```bash
# Installer Ollama (gratuit)
curl -fsSL https://ollama.com/install.sh | sh

# Télécharger un modèle léger
ollama pull llama3.2:3b
```

```typescript
// Fallback Ollama quand Claude est indisponible
async function askOllama(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false
    })
  });
  const data = await response.json();
  return data.response;
}

// Provider intelligent
async function askAI(prompt: string): Promise<string> {
  try {
    return askClaude(prompt); // Essayer Claude d'abord
  } catch (error) {
    console.log('[INFO] Fallback vers Ollama');
    return askOllama(prompt); // Si Claude échoue, Ollama local
  }
}
```

Ollama tourne en local, 100% gratuit, pas besoin d'internet. La qualité est moindre que Claude mais suffisante pour les tâches basiques (résumés, formatage, classification).


## 14.6 — Récap des Coûts — DÉFINITIF

| Composant | Coût | Notes |
|-----------|------|-------|
| Claude (LLM) | 0€ | Via Claude Code CLI (abonnement Max) |
| Notion API | 0€ | Gratuit (integration API) |
| Gmail API | 0€ | Gratuit (OAuth) |
| ChromaDB | 0€ | Local, open source |
| node-cron | 0€ | Librairie npm gratuite |
| Puppeteer | 0€ | Librairie npm gratuite |
| Ollama (fallback) | 0€ | Local, open source |
| Hébergement V1 | 0€ | Mac local |
| Hébergement V2 | 3-5€/mois | VPS (quand tu as du cash) |
| **TOTAL V1** | **0€/mois** | |
| **TOTAL V2** | **3-5€/mois** | |

Ayman ne paie RIEN de plus que son abonnement Claude Max actuel. IntraClaw est gratuit.

---
---
---

# PARTIE 15 : ARSENAL D'APIs GRATUITES — BOOSTER INTRACLAW À 0€

Toutes les APIs listées ici sont soit 100% gratuites (pas de clé requise), soit ont un "free tier" (niveau gratuit avec des limites largement suffisantes pour IntraClaw).


## 15.1 — Prospection & Recherche de Prospects

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Google Maps (scraping Puppeteer) | Trouver des PME, adresses, téléphones, avis | 0€ | Non | Illimité (scraping) |
| Hunter.io | Trouver l'email d'une entreprise par son domaine | 0€ | Oui | 25 recherches/mois |
| Clearbit Logo API | Récupérer le logo d'une entreprise | 0€ | Non | Illimité |
| Abstract Email Validation | Vérifier si un email est valide | 0€ | Oui | 100 vérifications/mois |
| Mailboxlayer | Vérification d'emails (existe ou pas) | 0€ | Oui | 100/mois |
| NumVerify | Valider un numéro de téléphone | 0€ | Oui | 100/mois |
| OpenCorporates | Données d'entreprises (nom, adresse, statut) | 0€ | Non | Limité mais suffisant |
| KBO/BCE Open Data (Belgique) | Données entreprises belges officielles | 0€ | Non | Illimité (données ouvertes) |

**Usage dans IntraClaw :** L'agent scrape Google Maps pour trouver des PME → vérifie l'email avec Abstract/Mailboxlayer → valide le téléphone avec NumVerify → récupère le logo avec Clearbit → ajoute tout dans Notion CRM.


## 15.2 — Email

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Gmail API | Envoyer/lire des emails | 0€ | OAuth | Illimité (ton compte) |
| Brevo (ex-Sendinblue) | Email marketing, transactional | 0€ | Oui | 300 emails/jour |
| Resend | Emails transactionnels modernes | 0€ | Oui | 100 emails/jour |
| Mailgun | Envoi d'emails en masse | 0€ | Oui | 100 emails/jour pendant 3 mois |

**Usage dans IntraClaw :** Gmail API pour les cold emails individuels. Brevo/Resend en backup si Gmail rate-limit.


## 15.3 — Météo (Briefing Matinal)

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Open-Meteo | Météo mondiale, prévisions 7 jours | 0€ | Non | Illimité, open source |
| OpenWeatherMap | Météo actuelle + prévisions | 0€ | Oui | 1000 appels/jour |
| Visual Crossing | Météo historique + prévisions | 0€ | Oui | 1000 appels/jour |
| Weatherstack | Météo temps réel | 0€ | Oui | 250 appels/mois |

**Usage dans IntraClaw :** Open-Meteo (pas de clé, illimité) pour le briefing matinal. "Bonjour Ayman, il fait 14°C à Bruxelles, pluie prévue à 15h."


## 15.4 — Analyse de Sites Web

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| PageSpeed Insights (Google) | Score de performance, accessibilité, SEO | 0€ | Oui (gratuite) | Illimité |
| BuiltWith | Détecter les technologies d'un site (WordPress, Shopify, etc.) | 0€ | Oui | Limité |
| SecurityTrails | Infos DNS, WHOIS, sous-domaines | 0€ | Oui | 50 requêtes/mois |
| W3C Validator | Vérifier la validité HTML/CSS | 0€ | Non | Illimité |
| SSL Labs API | Vérifier le certificat SSL d'un site | 0€ | Non | Illimité |

**Usage dans IntraClaw :** Quand l'agent trouve un prospect avec un site web, il appelle PageSpeed pour obtenir le score de performance → intègre les résultats dans le cold email : "Votre site a un score de performance de 32/100, ce qui fait fuir 53% de vos visiteurs."


## 15.5 — SEO & Recherche

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Google Custom Search | Recherche Google programmable | 0€ | Oui | 100 recherches/jour |
| SerpApi | Scraping résultats Google | 0€ | Oui | 100 recherches/mois |
| DuckDuckGo Instant Answer | Recherche instantanée | 0€ | Non | Illimité |

**Usage dans IntraClaw :** Rechercher des PME à Bruxelles, vérifier leur présence en ligne, trouver des infos de contact.


## 15.6 — Voix & Audio

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Groq (Whisper) | Transcription vocale ultra-rapide | 0€ | Oui | 14 400 requêtes/jour (!!) |
| Edge TTS (Microsoft) | Text-to-speech, voix naturelles | 0€ | Non (librairie npm) | Illimité |
| Vosk (local) | Speech-to-text hors ligne | 0€ | Non | Illimité (local) |

**Usage dans IntraClaw :** Ayman envoie un vocal sur Telegram → Groq Whisper transcrit → IntraClaw comprend et exécute. Edge TTS pour les réponses vocales.


## 15.7 — Images

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Unsplash | Photos HD gratuites | 0€ | Oui | 50 requêtes/heure |
| Pexels | Photos et vidéos gratuites | 0€ | Oui | 200 requêtes/heure |
| Lorem Picsum | Placeholder images | 0€ | Non | Illimité |
| QR Code Generator | Générer des QR codes | 0€ | Non | Illimité |
| Favicon Grabber | Récupérer le favicon d'un site | 0€ | Non | Illimité |

**Usage dans IntraClaw :** Unsplash pour les images des posts HaiSkills. QR Code pour les cartes de visite ou propositions commerciales.


## 15.8 — Données & Géolocalisation

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| IP-API | Géolocalisation par adresse IP | 0€ | Non | 45 requêtes/minute |
| REST Countries | Infos sur les pays (devise, langue, population) | 0€ | Non | Illimité |
| Nominatim (OpenStreetMap) | Geocoding (adresse → coordonnées) | 0€ | Non | 1 requête/seconde |
| Exchange Rates API | Taux de change en temps réel | 0€ | Non | Illimité |

**Usage dans IntraClaw :** Nominatim pour localiser les PME sur la carte. Exchange Rates si un client est hors zone euro.


## 15.9 — Productivité & Calendrier

| API | Ce qu'elle fait | Coût | Clé requise | Limites free tier |
|-----|----------------|------|-------------|-------------------|
| Google Calendar API | Lire/créer des événements | 0€ | OAuth | Illimité (ton compte) |
| Notion API | CRM, bases de données, pages | 0€ | Oui | Illimité |
| Google Sheets API | Lire/écrire des spreadsheets | 0€ | OAuth | Illimité (ton compte) |

**Usage dans IntraClaw :** Déjà intégrés dans le plan. Google Calendar pour le briefing matinal ("Tu as un RDV à 14h").


## 15.10 — IA & Modèles Gratuits

| API/Outil | Ce qu'il fait | Coût | Limites |
|-----------|---------------|------|---------|
| Claude Code CLI | LLM principal (ton abonnement Max) | 0€ | Limites Max |
| Ollama (local) | LLM fallback (Llama 3.2, Mistral, etc.) | 0€ | Illimité (local) |
| Groq API | Inférence LLM ultra-rapide | 0€ | 30 requêtes/minute |
| Hugging Face Inference | Milliers de modèles gratuits | 0€ | Limité mais suffisant |
| ChromaDB | Base de données vectorielle | 0€ | Illimité (local) |

**Usage dans IntraClaw :** Claude pour les tâches intelligentes. Ollama en fallback. Groq pour la transcription. ChromaDB pour la mémoire sémantique.


## 15.11 — Comment IntraClaw Utilise ces APIs — Workflow Complet

```
CHAQUE JOUR à 8h (HEARTBEAT) :

1. Open-Meteo → météo Bruxelles
2. Google Calendar → événements du jour
3. Notion CRM → prospects à relancer
4. Notion Content → posts à publier
   → Compile tout → Envoie briefing sur Telegram

CHAQUE JOUR à 9h (PROSPECTION) :

1. Google Maps (Puppeteer) → scrape 5-10 PME
2. PageSpeed Insights → analyse leur site (si existant)
3. Hunter.io → cherche l'email
4. Abstract Email → vérifie l'email
5. Notion CRM → ajoute le prospect
6. Claude Code CLI → rédige le cold email personnalisé
7. Gmail API → crée le brouillon
   → Notifie Ayman sur Telegram : "5 nouveaux prospects, 3 emails prêts"

CHAQUE JOUR à 10h (CONTENU) :

1. Claude Code CLI → génère 1 post HaiSkills
2. Unsplash → trouve une image pertinente
3. Notion Content Pipeline → ajoute le post
   → Notifie Ayman : "Post du jour prêt dans Notion"

CHAQUE SOIR à 18h (RAPPORT) :

1. Notion CRM → stats pipeline
2. Notion Clients → revenus du mois
3. Gmail → emails reçus des prospects
4. Claude Code CLI → compile le rapport
   → Envoie sur Telegram : "Rapport du jour : 3 prospects contactés,
     1 réponse, 1 600€ encaissés ce mois"
```


## 15.12 — Coût Total avec Toutes les APIs

| Catégorie | APIs utilisées | Coût total |
|-----------|---------------|------------|
| LLM | Claude CLI + Ollama + Groq | 0€ |
| Email | Gmail + Abstract + Mailboxlayer | 0€ |
| Prospection | Google Maps + Hunter + NumVerify | 0€ |
| Météo | Open-Meteo | 0€ |
| Analyse web | PageSpeed + BuiltWith | 0€ |
| Voix | Groq Whisper + Edge TTS | 0€ |
| Images | Unsplash + Pexels | 0€ |
| Productivité | Notion + Gmail + Google Calendar | 0€ |
| Mémoire | ChromaDB local | 0€ |
| Hébergement | Mac local | 0€ |
| **TOTAL** | **25+ APIs** | **0€/mois** |

IntraClaw utilise 25+ APIs gratuites et ne coûte pas un centime en plus de l'abonnement Claude Max.

---


# PARTIE 16 : RESSOURCES STRATÉGIQUES — INTÉGRÉES DANS INTRACLAW

Ayman a collecté 7 documents stratégiques pendant ses recherches. Voici comment chacun s'intègre dans IntraClaw et le business.

## 16.1 — Méthodologie Lyra 4-D — Prompt Engineering Interne

Un framework de prompt optimization en 4 étapes : Deconstruct → Diagnose → Develop → Deliver.

**Intégration IntraClaw :** Ce framework est intégré dans le SOUL.md d'IntraClaw. Chaque fois que l'agent doit rédiger un cold email, générer du contenu, ou produire un rapport, il applique automatiquement la méthode 4-D :

1. **Deconstruct** : Extraire l'intention, les entités clés, et le contexte de la tâche
2. **Diagnose** : Vérifier la clarté, la spécificité, et la complétude
3. **Develop** : Choisir la technique optimale (créatif → multi-perspective, technique → contraintes, éducatif → exemples, complexe → chain-of-thought)
4. **Deliver** : Construire le prompt final optimisé et l'exécuter

Notes par plateforme (utile pour IntraClaw) :
- Claude : long contexte + reasoning frameworks → parfait pour les analyses détaillées
- GPT : sections structurées → pour les tâches de formatage
- Gemini : créatif + comparatif → pour la génération de contenu

## 16.2 — Audit SEO Gratuit comme Hook Commercial

Un business model sans capital : proposer des audits SEO gratuits aux PME avec Screaming Frog (gratuit) et Google PageSpeed (gratuit).

**Intégration dans le business d'Ayman :**
- L'Agent Prospection d'IntraClaw analyse AUTOMATIQUEMENT le site de chaque prospect avec PageSpeed Insights API (gratuit, illimité)
- Le score de performance est intégré dans le cold email : "Votre site a un score de 32/100, ce qui fait fuir 53% de vos visiteurs"
- Ça crée un audit gratuit personnalisé sans effort → le prospect voit qu'Ayman a VRAIMENT analysé son site
- Ça mène naturellement à la refonte complète du site

**Workflow IntraClaw mis à jour :**
```
Prospect trouvé → PageSpeed Insights analyse le site → Score + problèmes extraits
→ Cold email personnalisé avec les vrais problèmes + score
→ Prospect impressionné → Demande de devis → Ayman livre le site → Encaisse
```

## 16.3 — Tips de Démarchage — Adapter le Ton au Client

Règles de communication pour la prospection :
1. Analyser le ton du client (pressé vs ouvert) et adapter la réponse
2. TOUJOURS joindre un portfolio (haiskills.vercel.app et intra-site.com)
3. Proposer un échantillon gratuit (maquette, audit, 1-2 posts personnalisés)
4. Montrer qu'on comprend le problème du client AVANT de parler de soi
5. Proposer un appel/échange pour aller plus loin (mais par écrit pour Ayman)

**Intégration IntraClaw :**
- Le self-improvement loop analyse les réponses des prospects
- Si un prospect répond "pas intéressé" → l'agent ajuste le template pour les prochains
- Si un prospect répond positivement → l'agent note ce qui a marché
- Les cold emails commencent toujours par le problème du prospect, jamais par "je fais des sites"

## 16.4 — Post LinkedIn Viral — "Ton site ne te ramène aucun client"

Template de post LinkedIn à fort engagement avec CTA "Commente Analyse pour un audit gratuit".

4 raisons qu'un site ne convertit pas :
1. Message flou, promesse absente
2. Mauvais mots-clés SEO, trafic sans intention
3. Pas de preuve sociale (avis, portfolio)
4. CTA trop faible, pas d'urgence

**Intégration :**
- Ajouté dans le Content Pipeline Notion (prêt à publier demain)
- L'Agent Content d'IntraClaw peut générer des variantes de ce post chaque semaine
- Chaque post inclut le CTA vers intra-site.com

## 16.5 — Animation TikTok — Pipeline de Contenu Vidéo

Un guide complet pour créer des animations TikTok virales pour le business :

**Outils gratuits/pas chers :**
- CapCut (gratuit) — montage vidéo rapide
- Mootion (IA) — génération d'animations par IA
- ElevenLabs — voix off IA

**Comptes à étudier :**
- @nutshellanimations (rythme et mèmes)
- @king.science (storytelling scientifique)
- @ketnipz (minimalisme et sound design)

**Cas concret :** Un gars a installé OpenClaw sur un vieux PC, l'a nommé "Larry", et en 5 jours il a fait 500K vues et $714/mois en MRR en postant du contenu TikTok automatiquement.

**Intégration IntraClaw V3 (future) :**
- Agent Content peut générer des scripts TikTok
- Combiné avec Mootion pour les animations
- ElevenLabs pour la voix off
- Publication automatique (quand les APIs TikTok le permettent)

## 16.6 — Leçon Produit — Data-Driven

Le fondateur de Favel a appris que 80% des "améliorations" n'avaient aucun effet. Seule la data permet de savoir ce qui marche.

**Intégration IntraClaw :**
- Le self-improvement loop est DATA-DRIVEN, pas instinctif
- Chaque action est mesurée : taux d'ouverture des emails, taux de réponse, taux de conversion
- IntraClaw ne change ses templates que quand les données montrent un problème
- A/B testing intégré : l'agent envoie 2 variantes d'email et mesure laquelle performe mieux

## 16.7 — Impact sur le SOUL.md d'IntraClaw

Le fichier SOUL.md est mis à jour pour intégrer toutes ces leçons :

```markdown
# IntraClaw — SOUL.md

## Identité
Je suis IntraClaw, l'agent IA personnel d'Ayman Idamre.
Mon rôle : automatiser son agence de création de sites web à Bruxelles et sa plateforme HaiSkills.

## Principes fondamentaux
1. Je suis DATA-DRIVEN — je ne change mes méthodes que quand les données le justifient
2. J'applique la méthode 4-D (Lyra) pour chaque tâche de rédaction
3. Je commence TOUJOURS par le problème du prospect, jamais par ce qu'Ayman vend
4. Je joins TOUJOURS le portfolio (haiskills.vercel.app, intra-site.com)
5. Je propose TOUJOURS un échantillon gratuit (maquette, audit SEO)
6. J'adapte mon ton au prospect (formel pour les entreprises, direct pour les commerçants)
7. Je mesure TOUT et j'apprends de chaque interaction

## Règles halal
- Transparence totale (pas de manipulation, pas de fausses promesses)
- Valeur réelle échangée (site livré = argent reçu)
- Honnêteté dans les audits (pointer les vrais problèmes, pas inventer)
- Zéro riba (pas d'intérêts, pas de frais cachés)
```

---


# PARTIE 17 : DERNIÈRES DÉCOUVERTES — GEMMA 4, COMMANDES SECRÈTES CLAUDE, PAPERCLIP

## 17.1 — Gemma 4 de Google — Le Fallback Local Ultime (GRATUIT)

Google a sorti Gemma 4, un modèle IA open source (licence Apache 2) qui tourne en LOCAL. C'est le meilleur fallback gratuit pour IntraClaw.

**Caractéristiques :**
- 31 milliards de paramètres (31B)
- Multimodal : texte + image + audio
- 140+ langues supportées
- 256 000 tokens de contexte
- Open source Apache 2 (utiliser, modifier, vendre — tu fais ce que tu veux)
- Tourne sur ton Mac sans cloud, sans API, sans facture
- 3ème meilleur modèle open source au monde, bat des modèles 2x plus gros

**Installation via Ollama :**
```bash
ollama pull gemma4:31b
```

**Intégration IntraClaw — Provider mis à jour :**
```typescript
async function askAI(prompt: string): Promise<string> {
  try {
    // 1. Essayer Claude Code CLI (abonnement Max, gratuit)
    return askClaude(prompt);
  } catch (claudeError) {
    try {
      // 2. Fallback Gemma 4 local (gratuit, meilleur que Llama)
      return askOllama(prompt, 'gemma4:31b');
    } catch (ollamaError) {
      // 3. Dernier recours : Llama 3.2 local (plus léger)
      return askOllama(prompt, 'llama3.2:3b');
    }
  }
}
```

**Pourquoi Gemma 4 > Llama 3.2 pour IntraClaw :**
- Multimodal : peut analyser des SCREENSHOTS de sites web (utile pour l'audit SEO visuel)
- 256K tokens de contexte (vs 128K pour Llama) → peut lire des documents entiers
- Meilleur en français (140+ langues vs focus anglais de Llama)
- Plus précis pour les tâches business (rédaction, analyse, classification)

**Coût :** 0€. Tourne en local sur le Mac d'Ayman.

## 17.2 — Commandes Secrètes Claude — Intégrées dans le SOUL.md

7 techniques de prompting avancé à intégrer dans IntraClaw pour améliorer la qualité des réponses de Claude :

### 1. /premortem — Anticiper l'échec
Tu décris un projet, et Claude l'imagine échouer dans 6 mois pour identifier les points de rupture.
**Usage IntraClaw :** Avant de lancer une campagne cold email, IntraClaw fait un premortem : "Quels sont les 5 raisons pour lesquelles cette campagne pourrait échouer ?" → ajuste le plan en conséquence.

### 2. /blindspot — Trouver les angles morts
Au lieu de valider ton idée, Claude cherche activement ce que tu n'as pas pensé à demander.
**Usage IntraClaw :** Après chaque analyse de prospect, IntraClaw vérifie les angles morts : "Qu'est-ce que j'ai manqué dans mon évaluation de ce prospect ?"

### 3. L99 — Niveau expert
Force le niveau de réponse du généraliste vers celui d'un expert du domaine.
**Usage IntraClaw :** Tous les prompts de rédaction de cold emails incluent "Réponds au niveau d'un expert en web marketing B2B avec 15 ans d'expérience en prospection PME."

### 4. /chainlogic — Raisonnement transparent
Rend le raisonnement visible étape par étape. Utile pour les tâches analytiques.
**Usage IntraClaw :** Pour les rapports quotidiens et les analyses de pipeline.

### 5. OODA — Framework stratégique
Observer → Orienter → Décider → Agir. Framework militaire adapté au business.
**Usage IntraClaw :** Pour les décisions stratégiques automatiques : "Observer le pipeline → Orienter (quels prospects sont chauds) → Décider (qui relancer) → Agir (envoyer le follow-up)."

### 6. /wargame — Simulation concurrentielle
Claude simule comment les concurrents ou l'audience réagiraient à ton contenu/offre/positionnement.
**Usage IntraClaw :** Avant de publier un post LinkedIn, IntraClaw fait un wargame : "Comment l'audience va réagir à ce post ? Quelles objections vont surgir ?"

### 7. /deepsync — Raisonnement profond
Force un raisonnement couche par couche, du général vers le spécifique, en testant toutes les hypothèses.
**Usage IntraClaw :** Pour les tâches complexes comme l'architecture d'un site client ou l'analyse d'un marché.

### SOUL.md mis à jour avec les commandes :
```markdown
## Techniques de prompting internes

Pour chaque tâche, je sélectionne la technique appropriée :
- Rédaction cold email → L99 (niveau expert) + méthode 4-D (Lyra)
- Analyse prospect → /blindspot (angles morts) + /chainlogic (raisonnement)
- Stratégie business → OODA (observer-orienter-décider-agir)
- Lancement campagne → /premortem (anticiper l'échec)
- Création contenu → /wargame (simuler la réaction audience)
- Tâche complexe → /deepsync (raisonnement profond)
```

## 17.3 — Paperclip — Confirmations supplémentaires

La vidéo confirme ce qu'on a déjà dans la Partie 11, avec des détails supplémentaires :

**Nouvelles infos :**
- "Vibe Management" = piloter une entreprise entière avec des agents IA (c'est le concept d'IntraClaw)
- Clipmart = marketplace de templates d'entreprises pré-configurées (agence dev, agence marketing, etc.)
- Attribution atomique des tâches = chaque micro-tâche est assignée à un agent spécifique
- Rollback = si un agent fait n'importe quoi, on peut annuler ses actions automatiquement
- Session persistante = chaque agent garde sa mémoire entre les exécutions
- En 3 minutes, t'as un tableau de bord avec tes agents, leurs tâches, et ta facture en temps réel

**Intégration IntraClaw :**
- Le Coordinator d'IntraClaw implémente le rollback : si l'Agent Cold Email envoie un email à la mauvaise adresse, on peut annuler
- Les templates d'entreprises Clipmart inspirent les "presets IntraClaw" : un preset "Agence Web Bruxelles" pré-configuré avec tous les agents, skills, et mémoires adaptés au business d'Ayman
- L'attribution atomique est déjà prévue dans le multi-agent system (Partie 11)

## 17.4 — Récap des coûts — VRAIMENT DÉFINITIF

| Composant | Coût | Notes |
|-----------|------|-------|
| Claude (LLM principal) | 0€ | Via Claude Code CLI (abonnement Max) |
| Gemma 4 (fallback #1) | 0€ | Local via Ollama |
| Llama 3.2 (fallback #2) | 0€ | Local via Ollama |
| Notion API | 0€ | Gratuit |
| Gmail API | 0€ | Gratuit |
| ChromaDB | 0€ | Local |
| 25+ APIs gratuites | 0€ | Partie 15 |
| Hébergement V1 | 0€ | Mac local |
| **TOTAL** | **0€/mois** | **Tout est gratuit sauf l'abonnement Claude Max** |

---


# PARTIE 18 : STRESS TEST — PREMORTEM, BLINDSPOT, WARGAME SUR INTRACLAW

On applique les commandes secrètes Claude SUR le projet IntraClaw lui-même pour anticiper les problèmes.

## 18.1 — /PREMORTEM — IntraClaw a échoué dans 6 mois, pourquoi ?

### Scénario 1 : Ayman n'a jamais commencé à coder
**Cause :** Trop occupé à chercher l'outil parfait, à regarder des vidéos, à planifier au lieu d'exécuter.
**Prévention :** La règle est claire : on code IntraClaw APRÈS avoir signé 2-3 clients avec le système actuel (tâches programmées Claude). Les revenus donnent la motivation.

### Scénario 2 : Google bloque le scraping
**Cause :** Google Maps détecte les requêtes automatisées après 2 semaines.
**Prévention :** Rotation de user-agents, delays aléatoires (3-10 secondes entre chaque requête), proxies rotatifs si nécessaire, alterner avec PagesJaunes.be comme source secondaire.

### Scénario 3 : Cold emails en spam
**Cause :** Le domaine gmail.com n'a pas de warm-up, trop d'emails envoyés trop vite.
**Prévention :** Warm-up progressif : 5 emails/jour semaine 1, 10/jour semaine 2, 20/jour semaine 3, max 50/jour. Varier les objets. Ne jamais envoyer le même email à 2 prospects.

### Scénario 4 : Quota Claude Max atteint
**Cause :** Prompts trop longs, trop d'appels par jour.
**Prévention :** Cache des réponses, batch les requêtes, pré-générer les templates, max 50 appels Claude/jour, fallback Gemma 4 local.

### Scénario 5 : Aucun prospect ne répond
**Cause :** Les 8 premiers emails ne génèrent aucune réponse.
**Prévention :** C'est normal. Le taux de réponse cold email est de 3-8%. Sur 8 emails, 0-1 réponse est statistiquement normal. Il faut 50-100 emails pour voir des résultats. Diversifier : email + téléphone + LinkedIn.

### Scénario 6 : La mémoire ChromaDB ralentit le système
**Cause :** Trop de vecteurs accumulés sans nettoyage.
**Prévention :** Compaction automatique chaque dimanche. Supprimer les vecteurs de plus de 6 mois qui n'ont jamais été rappelés.

## 18.2 — /BLINDSPOT — Ce qu'on a pas pensé

### Angle mort 1 : Pas de workflow de closing
**Problème :** Si un prospect répond "intéressé", qui fait le suivi ? IntraClaw ne gère pas le closing.
**Solution :** Créer un workflow : prospect chaud → IntraClaw génère un devis automatique (skill facturation-freelance) → envoie par email → relance à J+5 si pas de réponse.

### Angle mort 2 : Pas de portfolio client convaincant
**Problème :** haiskills.vercel.app est une plateforme de formation, pas un site vitrine de client PME. Les prospects veulent voir un "avant/après" d'un commerce comme le leur.
**Solution :** Utiliser le site du 1er client (1 600€) comme référence. Faire une capture d'écran "avant" (si disponible) et "après". Créer 1-2 sites fictifs de démo (restaurant, coiffeur) avec le template agence.

### Angle mort 3 : RGPD non respecté
**Problème :** Les cold emails B2B en Belgique sont autorisés par le RGPD SI c'est pertinent au business du destinataire ET si tu donnes un moyen de se désinscrire. Nos emails n'avaient PAS de lien de désinscription.
**Solution :** FAIT — Ajout de "Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP" en bas de chaque email. L'automatisation auto-cold-email est mise à jour.

### Angle mort 4 : Pas de numéro pro
**Problème :** Un email sans numéro de téléphone professionnel donne moins confiance.
**Solution :** Ajouter le numéro de téléphone d'Ayman dans la signature des emails. Ou créer un numéro virtuel belge via Skype/Google Voice (gratuit).

### Angle mort 5 : Pas de suivi des ouvertures d'email
**Problème :** On ne sait pas si les prospects OUVRENT les emails ou les ignorent.
**Solution :** Utiliser un pixel de tracking (Mailtrack gratuit pour Gmail) ou Brevo (300 emails/jour gratuit avec tracking intégré) pour mesurer les taux d'ouverture. Le self-improvement loop a besoin de ces données.

## 18.3 — /WARGAME — Comment les prospects vont réagir

### Simulation sur 100 cold emails envoyés :
- 60 vont être ignorés (taux standard)
- 20 vont être ouverts mais pas de réponse (objet accrocheur mais pas assez convaincant)
- 10 vont répondre "pas intéressé" ou "j'ai déjà quelqu'un"
- 5 vont répondre "combien ça coûte ?" → CEUX-LÀ sont les leads chauds
- 3 vont visiter intra-site.com et haiskills.vercel.app pour vérifier la crédibilité
- 2 vont demander une maquette gratuite → 1 va signer

### Taux de conversion réaliste :
- 100 emails → 5 réponses intéressées → 2 demandes de devis → 1 client signé
- 1 client = 1 000-2 000€
- Pour 3 clients/mois, il faut ~300 emails/mois = ~15 emails/jour (faisable)

### Réaction des concurrents :
- Les agences web établies à Bruxelles ne font PAS de cold email (bouche-à-oreille + SEO)
- Elles facturent 5 000-15 000€ par site (vs 1 000-2 000€ pour Ayman)
- L'avantage compétitif d'Ayman : prix bas + rapidité (5-7 jours) + approche directe + IA

### Objections les plus fréquentes et réponses :
1. "C'est trop cher" → "Je comprends. Combien vous coûte un client perdu chaque mois parce qu'il ne vous trouve pas en ligne ? Un site se rentabilise en 2-3 clients."
2. "J'ai déjà un site" → "Je l'ai vu. Il y a quelques points qui pourraient être améliorés pour attirer plus de clients. Voulez-vous un audit gratuit ?"
3. "Je n'ai pas le temps" → "Justement, je m'occupe de tout. Vous me donnez les infos de base, et en 5-7 jours c'est en ligne."
4. "Je vais y réfléchir" → Relance à J+5 : "Je voulais juste faire un suivi. L'offre de maquette gratuite est toujours valable."

## 18.4 — Actions immédiates suite au stress test

1. ✅ RGPD : lien de désinscription ajouté dans l'automatisation auto-cold-email
2. À faire : Créer 1-2 sites de démo (restaurant + coiffeur) avec le template agence pour le portfolio
3. À faire : Ajouter le numéro de téléphone d'Ayman dans la signature des emails
4. À faire : Installer Mailtrack (gratuit) sur Gmail pour tracker les ouvertures
5. À faire : Préparer un template de devis automatique via le skill facturation-freelance
6. À faire : Augmenter le volume : passer de 8 à 50 emails la semaine prochaine

---


# PARTIE 19 : CODE RÉEL + FICHIERS MÉMOIRE + DAY 1 GUIDE + TEMPLATES

Cette partie finalise le plan avec tout ce qu'il faut pour LANCER IntraClaw le jour J sans perdre de temps.

## 19.1 — Structure du projet — Fichiers à créer

```
intraclaw/
├── package.json
├── tsconfig.json
├── .env                          # Secrets (JAMAIS sur Git)
├── .gitignore
├── src/
│   ├── index.ts                  # Point d'entrée principal
│   ├── scheduler.ts              # Heartbeat (node-cron)
│   ├── claude.ts                 # Provider Claude Code CLI
│   ├── ollama.ts                 # Provider Ollama fallback (Gemma 4)
│   ├── ai.ts                     # Provider intelligent (Claude → Gemma → Llama)
│   ├── agents/
│   │   ├── coordinator.ts        # Agent Coordinator (cerveau)
│   │   ├── prospection.ts        # Agent Prospection
│   │   ├── cold-email.ts         # Agent Cold Email
│   │   ├── content.ts            # Agent Content
│   │   ├── crm.ts                # Agent CRM Notion
│   │   └── reporting.ts          # Agent Reporting
│   ├── tools/
│   │   ├── gmail.ts              # Gmail API wrapper
│   │   ├── notion.ts             # Notion API wrapper
│   │   ├── scraper.ts            # Google Maps scraper (Puppeteer)
│   │   ├── pagespeed.ts          # PageSpeed Insights API
│   │   ├── weather.ts            # Open-Meteo API
│   │   └── email-verify.ts       # Abstract Email Validation
│   ├── memory/
│   │   ├── manager.ts            # Gestionnaire de mémoire 3 tiers
│   │   ├── core.ts               # Tier 1 : Core Memory (fichiers MD)
│   │   ├── buffer.ts             # Tier 2 : Conversation Buffer
│   │   └── semantic.ts           # Tier 3 : ChromaDB vectoriel
│   └── utils/
│       ├── logger.ts             # Logging avec timestamps
│       ├── rate-limiter.ts       # Rate limiting interne
│       └── cost-tracker.ts       # Suivi des coûts API
├── memory/                        # Fichiers mémoire persistants
│   ├── SOUL.md
│   ├── USER.md
│   ├── MEMORY.md
│   ├── HEARTBEAT.md
│   ├── AGENTS.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   └── BOOTSTRAP.md
├── skills/                        # Skills custom
│   ├── cold-email/SKILL.md
│   ├── prospect-scraper/SKILL.md
│   ├── content-generator/SKILL.md
│   └── invoice-creator/SKILL.md
├── data/
│   ├── logs/                      # Logs quotidiens
│   ├── cache/                     # Cache des réponses Claude
│   └── chroma/                    # ChromaDB data
├── Dockerfile
└── docker-compose.yml
```

## 19.2 — package.json

```json
{
  "name": "intraclaw",
  "version": "1.0.0",
  "description": "Agent IA autonome personnel d'Ayman - Agence Web + HaiSkills",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "tsx src/test.ts"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.0",
    "chromadb": "^1.8.0",
    "googleapis": "^130.0.0",
    "grammy": "^1.25.0",
    "node-cron": "^3.0.3",
    "puppeteer": "^22.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.11.0",
    "@types/node-cron": "^3.0.11"
  }
}
```

## 19.3 — Les 8 fichiers mémoire pré-remplis pour Ayman

### SOUL.md
```markdown
# IntraClaw — SOUL.md

## Identité
Je suis IntraClaw, l'agent IA personnel d'Ayman Idamre.
Mon rôle : automatiser son agence de création de sites web à Bruxelles et sa plateforme HaiSkills.

## Principes fondamentaux
1. Je suis DATA-DRIVEN — je ne change mes méthodes que quand les données le justifient
2. J'applique la méthode 4-D (Lyra) pour chaque tâche de rédaction
3. Je commence TOUJOURS par le problème du prospect, jamais par ce qu'Ayman vend
4. Je joins TOUJOURS le portfolio (haiskills.vercel.app, intra-site.com)
5. Je propose TOUJOURS un échantillon gratuit (maquette, audit SEO)
6. J'adapte mon ton au prospect (formel pour les entreprises, direct pour les commerçants)
7. Je mesure TOUT et j'apprends de chaque interaction

## Techniques de prompting internes
- Rédaction cold email → L99 (niveau expert) + méthode 4-D (Lyra)
- Analyse prospect → /blindspot (angles morts) + /chainlogic (raisonnement)
- Stratégie business → OODA (observer-orienter-décider-agir)
- Lancement campagne → /premortem (anticiper l'échec)
- Création contenu → /wargame (simuler la réaction audience)
- Tâche complexe → /deepsync (raisonnement profond)

## Règles halal
- Transparence totale (pas de manipulation, pas de fausses promesses)
- Valeur réelle échangée (site livré = argent reçu)
- Honnêteté dans les audits (pointer les vrais problèmes, pas inventer)
- Zéro riba (pas d'intérêts, pas de frais cachés)

## Limites
- Je ne touche JAMAIS aux mots de passe ou credentials directement
- Je ne supprime JAMAIS de données sans confirmation
- Je ne dépasse JAMAIS le budget API quotidien (5€/jour)
- Je m'arrête si quelque chose semble suspect ou dangereux
```

### USER.md
```markdown
# IntraClaw — USER.md

## Profil
- Nom : Ayman Idamre
- Âge : 20 ans
- Localisation : Bruxelles, Belgique
- Études : Informatique à Odisée
- Statut : Étudiant-indépendant belge

## Business
### Stream 1 — Agence Sites Web (cashflow)
- Création de sites pour PME à Bruxelles
- Prix : 1 000-2 000€ par site
- Livraison : 5-7 jours
- Stack : Next.js + Tailwind + Vercel
- Email pro : intra.web.site1@gmail.com
- Site : intra-site.com
- Portfolio : haiskills.vercel.app

### Stream 2 — HaiSkills (récurrent)
- SaaS formation cybersécurité, prompt engineering, vibe coding
- Abonnements récurrents
- URL : haiskills.vercel.app

## Préférences
- Zéro appels, zéro vidéos — tout par écrit
- Communication en français
- Respecte les principes halal dans le business
- Veut automatiser au maximum
- Ne veut PAS payer plus que son abonnement Claude Max

## Objectifs
- Mois 6 : 8 000-10 000€/mois combinés
- Court terme : signer 2-3 clients agence web
- Moyen terme : construire IntraClaw
- Long terme : liberté géographique
```

### HEARTBEAT.md
```markdown
# IntraClaw — HEARTBEAT.md

## Tâches quotidiennes (lundi-vendredi)

### 07:00 — Briefing matinal
- Météo Bruxelles (Open-Meteo)
- Événements du jour (Google Calendar)
- Prospects à relancer (Notion CRM)
- Posts à publier (Notion Content)
→ Envoyer résumé sur Telegram

### 08:00 — Prospection automatique
- Scraper 5-10 PME à Bruxelles (Google Maps)
- Analyser leur site (PageSpeed si existant)
- Trouver leur email (Hunter.io + scraping)
- Ajouter dans Notion CRM

### 09:00 — Génération contenu
- Générer 1 post HaiSkills
- Trouver une image (Unsplash)
- Ajouter dans Notion Content Pipeline

### 10:00 — Envoi cold emails
- Vérifier les prospects "Nouveau" avec email dans Notion
- Rédiger l'email personnalisé (Type A ou Type B)
- Ajouter lien RGPD désinscription
- Envoyer via Gmail
- Mettre à jour statut Notion → "Contacté"
- Envoyer relances J+3 et J+7

### 18:00 — Rapport du soir
- Stats pipeline (combien à chaque étape)
- Revenus du mois
- Paiements en attente
- Emails reçus des prospects
→ Envoyer résumé sur Telegram

## Tâches hebdomadaires

### Dimanche 03:00 — Maintenance
- Compaction mémoire ChromaDB
- Backup des fichiers mémoire
- Nettoyage des logs > 30 jours
- Self-improvement : analyser les résultats de la semaine
```

### MEMORY.md
```markdown
# IntraClaw — MEMORY.md (mémoire dynamique)

## Faits appris
- Premier client agence : 1 600€, site livré
- 18 prospects dans le CRM Notion au 05/04/2026
- 8 cold emails envoyés le 05/04/2026
- Emails trouvés : Beeshop, Elle M, Glams, Magic Vélos, Futon Design, Dolce Romance, Urbisco, Chien Vert
- 10 prospects sans email (à appeler)

## Leçons apprises
(Se remplit automatiquement via le self-improvement loop)

## Préférences détectées
(Se remplit automatiquement en analysant les interactions)
```

### AGENTS.md
```markdown
# IntraClaw — AGENTS.md (règles de workflow)

## Règle générale
- Avant chaque envoi d'email : vérifier l'adresse avec Abstract Email Validation
- Avant chaque scraping : attendre 3-10 secondes aléatoires entre requêtes
- Après chaque tâche : évaluer le résultat (succès/échec/partiel)
- Si échec : analyser pourquoi et mettre à jour MEMORY.md

## Cold Email
- Commencer par le PROBLÈME du prospect, pas par ce qu'Ayman fait
- Pointer 2-3 problèmes spécifiques SANS donner la solution
- Inclure le portfolio (haiskills.vercel.app)
- Inclure la signature avec intra-site.com
- Ajouter le lien RGPD "répondez STOP"
- Max 50 emails/jour

## Prospection
- Alterner les catégories chaque jour (restaurants lundi, boutiques mardi, etc.)
- Vérifier les doublons avant d'ajouter au CRM
- Scraper Google Maps + PagesJaunes.be en alternance

## Contenu
- Vérifier les posts existants pour ne pas répéter un sujet
- Alterner les plateformes (LinkedIn, X, Reddit)
- Alterner les thèmes (Cyber, Prompt, Vibe Coding, IA, Business)
- Terminer chaque post par un CTA vers HaiSkills
```

### TOOLS.md
```markdown
# IntraClaw — TOOLS.md

## Outils disponibles
- Claude Code CLI : LLM principal (abonnement Max)
- Ollama (Gemma 4) : LLM fallback local
- Gmail API : envoi/lecture emails
- Notion API : CRM, contenu, clients
- Puppeteer : scraping Google Maps
- PageSpeed Insights : analyse de sites
- Open-Meteo : météo
- Hunter.io : recherche emails
- Abstract Email : vérification emails
- ChromaDB : mémoire sémantique
- Groq Whisper : transcription vocale
- Edge TTS : synthèse vocale
- Unsplash : images gratuites
```

### IDENTITY.md
```markdown
# IntraClaw — IDENTITY.md

## Carte d'identité
- Nom : IntraClaw
- Créateur : Ayman Idamre
- Version : 1.0.0
- Rôle : Agent IA autonome pour agence web + HaiSkills
- Localisation : Bruxelles, Belgique
- Langue principale : Français
- LLM principal : Claude (via Claude Code CLI)
- Hébergement : Mac local (V1) / VPS Hetzner (V2)
```

### BOOTSTRAP.md
```markdown
# IntraClaw — BOOTSTRAP.md

## Instructions de démarrage
1. Lire SOUL.md pour connaître mes principes
2. Lire USER.md pour connaître Ayman
3. Lire MEMORY.md pour le contexte récent
4. Lire HEARTBEAT.md pour les tâches planifiées
5. Lire AGENTS.md pour les règles de workflow
6. Lire TOOLS.md pour les outils disponibles
7. Vérifier la connexion aux APIs (Gmail, Notion, Claude)
8. Lancer le scheduler
9. Exécuter la première tâche du HEARTBEAT
```

## 19.4 — Day 1 Guide — Lancer IntraClaw en 30 minutes

### Étape 1 : Cloner le projet (2 min)
```bash
mkdir ~/intraclaw && cd ~/intraclaw
npm init -y
```

### Étape 2 : Installer les dépendances (3 min)
```bash
npm install @notionhq/client chromadb googleapis grammy node-cron puppeteer dotenv
npm install -D typescript tsx @types/node @types/node-cron
npx tsc --init
```

### Étape 3 : Créer le fichier .env (5 min)
```bash
touch .env
```
Remplir avec les clés API (Notion, Gmail OAuth, Telegram bot token, etc.)

### Étape 4 : Créer les fichiers mémoire (2 min)
```bash
mkdir -p memory skills data/logs data/cache data/chroma src/agents src/tools src/memory src/utils
```
Copier les fichiers SOUL.md, USER.md, etc. depuis la Partie 19.3

### Étape 5 : Créer le fichier principal (5 min)
Créer `src/index.ts` avec le scheduler, le provider IA, et les agents basiques.

### Étape 6 : Tester (5 min)
```bash
npx tsx src/index.ts
```
Vérifier que le briefing matinal fonctionne, que la connexion Notion est OK, que Claude CLI répond.

### Étape 7 : Lancer en daemon (3 min)
```bash
# Sur Mac : créer un LaunchAgent pour auto-démarrage
# Ou simplement : nohup npx tsx src/index.ts &
```

### Étape 8 : Vérifier (5 min)
- Ouvrir Telegram → vérifier que le briefing arrive
- Ouvrir Notion → vérifier que les prospects sont ajoutés
- Ouvrir Gmail → vérifier que les brouillons/emails sont créés

## 19.5 — Checklist de tests — Vérifier qu'IntraClaw marche

```
[ ] Claude CLI répond (echo "test" | claude --print)
[ ] Ollama + Gemma 4 installé et répond
[ ] Notion API connecté (lire le CRM)
[ ] Gmail API connecté (lire la boîte de réception)
[ ] Puppeteer scrape Google Maps sans erreur
[ ] PageSpeed Insights retourne un score
[ ] ChromaDB stocke et récupère des vecteurs
[ ] node-cron déclenche les tâches à l'heure
[ ] Les fichiers mémoire sont lus au démarrage
[ ] Le briefing matinal compile les bonnes infos
[ ] Un cold email est généré correctement
[ ] Le CRM Notion est mis à jour après envoi
[ ] Le rapport du soir est compilé
[ ] Les logs sont écrits dans data/logs/
[ ] Le rate limiter bloque après 50 appels Claude/jour
[ ] Le fallback Gemma 4 s'active quand Claude échoue
```

## 19.6 — Templates d'emails de relance et closing

### Relance J+3 (prospect contacté, pas de réponse)
```
Objet : Re: [objet original]

Bonjour,

Je me permets de revenir vers vous. J'ai récemment créé le site d'un commerce à Bruxelles et les retours sont excellents — plus de visibilité, nouveaux clients via Google dès la première semaine.

Si vous avez 2 minutes, je peux vous envoyer un exemple concret. Toujours sans engagement.

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com

Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP.
```

### Relance J+7 (dernier message)
```
Objet : Re: [objet original]

Bonjour,

Dernier message de ma part — je ne veux pas vous déranger.

Si un site web n'est pas une priorité pour le moment, je comprends. N'hésitez pas à me recontacter quand vous voulez.

Belle continuation !

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com
```

### Réponse à "Combien ça coûte ?" (closing)
```
Objet : Re: [objet original]

Bonjour,

Merci pour votre intérêt !

Pour un site professionnel comme le vôtre, voici ce que je propose :

→ Site vitrine complet (5-8 pages) : à partir de 1 200€
→ Design moderne et adapté mobile
→ Référencement Google de base inclus
→ Formulaire de contact + Google Maps
→ Livré en 5-7 jours

Le process est simple :
1. Vous me donnez les infos de base (textes, photos, logo)
2. Je vous envoie une maquette en 48h
3. Vous validez → je développe → c'est en ligne en 5-7 jours

50% à la commande, 50% à la livraison.

Voulez-vous que je vous prépare une maquette gratuite pour voir le résultat ?

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com
```

### Réponse à "C'est trop cher"
```
Objet : Re: [objet original]

Bonjour,

Je comprends, le budget est important.

Pour mettre les choses en perspective : combien de clients vous trouvent actuellement via internet ? Un site professionnel bien référencé peut attirer 5-10 nouveaux clients par mois. À combien estimez-vous la valeur d'un seul nouveau client ?

Le site se rentabilise souvent en 2-3 clients seulement.

Je peux aussi vous proposer un paiement en 2 fois pour faciliter les choses.

Qu'en pensez-vous ?

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com
```

### Réponse à "J'ai déjà un site"
```
Objet : Re: [objet original]

Bonjour,

Oui, j'ai vu votre site. Et justement, il y a quelques points qui pourraient être améliorés pour attirer plus de clients.

Voulez-vous que je vous fasse un audit gratuit ? Je vous dirai exactement ce qui freine vos visiteurs et ce qui pourrait être optimisé. Sans engagement, c'est offert.

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com
```

---

**FIN DU DOCUMENT**

*IntraClaw — Plan Complet de Construction*
*Dernière mise à jour : 5 avril 2026*
*Statut : Prêt pour le développement*
