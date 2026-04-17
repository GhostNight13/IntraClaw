# IntraClaw — Agency Plugin

Opt-in plugin for **web agency / indie freelancer** use cases.

Includes:
- **Prospection agent** — searches for small businesses without a modern website, adds them to the Notion CRM
- **Cold email agent** — generates personalised outreach emails and follow-ups via Gmail
- **Content agent** — drafts LinkedIn posts, blog articles, and newsletters from the agent's memory

## Enable / Disable

Controlled via the `ENABLE_AGENCY_AGENTS` environment variable:

```bash
# In .env
ENABLE_AGENCY_AGENTS=true   # Default: true (for backward compat)
ENABLE_AGENCY_AGENTS=false  # Hide prospection/cold-email/content from Telegram, dashboard, scheduler
```

When disabled:
- The `/prospects`, `/prospect`, `/email` Telegram commands are removed
- Cron jobs for prospection + cold-email + content are skipped
- The universal executor won't route "cherche des prospects" / "envoie des cold emails" intents

## Required env vars (when enabled)

- `NOTION_TOKEN` + `NOTION_PROSPECTS_DATABASE_ID`
- `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN`

## File layout

The agent implementations currently live under `src/agents/` (historical) but
are guarded by the `ENABLE_AGENCY_AGENTS` flag. A full physical extraction to
`plugins/agency/src/` is planned for v0.2 once a plugin API is stable.

See `src/agents/prospection.ts`, `cold-email.ts`, `content.ts`.
