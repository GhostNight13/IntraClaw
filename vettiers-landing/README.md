# VetTiers — Landing Page

Marketing site + waitlist for VetTiers. Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · PostHog analytics. Deploys as a static-ish SSR app on Vercel free tier.

---

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open <http://localhost:3000>.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run type-check` | TypeScript strict check, no emit |

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | No (recommended) | PostHog project API key. Get one free at <https://posthog.com>. Without it, analytics silently no-op. |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Defaults to `https://us.i.posthog.com`. Requests are reverse-proxied via `/ingest` (see `next.config.ts`) to bypass ad-blockers. |
| `NEXT_PUBLIC_TALLY_FORM_ID` | No | If you prefer to embed a Tally form instead of the native one, paste the form ID here. Not wired by default — the native form is the primary path. |
| `TALLY_WEBHOOK_URL` | No (recommended for prod) | Full webhook URL from Tally → Integrations → Webhook. The `/api/waitlist` route POSTs the form submission here. Without it, submissions are accepted and logged to Vercel logs but not persisted anywhere. |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL. Defaults to `https://vettiers.com`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Public contact email. Defaults to `hello@vettiers.com`. |

All `NEXT_PUBLIC_*` values ship to the browser — never put secrets there.

---

## Deployment (Vercel free tier)

1. Push this folder to GitHub (new repo `vettiers-landing`).
2. Go to <https://vercel.com/new>, import the repo.
3. Framework: **Next.js** (auto-detected). Root directory: `.` Build command: default.
4. Add the env vars from `.env.example` under **Settings → Environment Variables** (Production + Preview).
5. Click **Deploy**. First build takes ~60 seconds.

### Custom domain — vettiers.com

1. In Vercel: **Settings → Domains → Add** → `vettiers.com` (and `www.vettiers.com`).
2. At your registrar (Namecheap / Cloudflare / etc.), point DNS:
   - `A` record for `vettiers.com` → `76.76.21.21`
   - `CNAME` for `www` → `cname.vercel-dns.com`
3. Vercel auto-issues a Let&apos;s Encrypt cert. Enforce HTTPS is on by default.

---

## Waitlist flow

1. User submits the native form (`components/site/Waitlist.tsx`).
2. Client POSTs to `/api/waitlist` (edge runtime, see `app/api/waitlist/route.ts`).
3. Server validates minimally and forwards to `TALLY_WEBHOOK_URL`.
4. Tally stores the submission and triggers anything you&apos;ve wired on their side (Google Sheet, Slack, email).

### Setting up Tally

1. Create an account at <https://tally.so>.
2. Create a blank form (the native UI is on our side; Tally is only the storage layer).
3. Add fields matching the client payload (`email`, `name`, `clinic`, `role`, `size`, `pims`, `state`, `interview`).
4. **Integrations → Webhook** → copy the URL → paste into `TALLY_WEBHOOK_URL` in Vercel.
5. Redeploy (or just save env — Vercel rebuilds automatically).

If you&apos;d rather embed Tally&apos;s UI directly, drop their embed script in `Waitlist.tsx` and remove the native form — but the native form has better conversion + styling consistency.

---

## Analytics — PostHog

Initialized in `app/providers.tsx` (client component, wraps the tree).

Tracked automatically:
- `$pageview` on every route change
- `$pageleave` on tab close
- `scroll_depth` at 25 / 50 / 75 / 100%
- `cta_click` with `location` prop on every major button
- `waitlist_submit` on successful form submission, with role/size/pims/state/interview dimensions

The PostHog requests are reverse-proxied via `/ingest/*` (`next.config.ts` rewrites) so ad-blockers don&apos;t eat your data.

---

## How to update content

| What | Where |
|---|---|
| Hero headline / CTA | `components/site/Hero.tsx` |
| Problem stats | `components/site/Problem.tsx` (`stats` array) |
| 3-step solution | `components/site/Solution.tsx` (`steps` array) |
| Product mockups | `components/site/ProductPreview.tsx` |
| PIMS / financing partners | `components/site/Compatibility.tsx` |
| Pricing copy | `components/site/Pricing.tsx` |
| Founder note | `components/site/FounderNote.tsx` |
| FAQ items | `components/site/FAQ.tsx` (`faqs` array) |
| Form fields / options | `components/site/Waitlist.tsx` |
| Footer links | `components/site/Footer.tsx` |
| SEO tags / Open Graph | `app/layout.tsx` |
| Theme tokens (colors, radius) | `app/globals.css` (`@theme` block) |
| Privacy / Terms | `app/privacy/page.tsx`, `app/terms/page.tsx` |

---

## Assets to replace

- `public/favicon.ico` — currently a placeholder text file. Export a real `.ico` (RealFaviconGenerator works well).
- `public/og.png` — 1200×630 Open Graph image. Current file is a placeholder note. Referenced by `app/layout.tsx` and used by every social preview.

---

## Project structure

```
vettiers-landing/
├── app/
│   ├── api/waitlist/route.ts  # Edge POST handler → Tally webhook
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── globals.css            # Tailwind v4 + theme tokens
│   ├── layout.tsx             # SEO, Inter, JSON-LD, PostHog provider mount
│   ├── page.tsx               # Landing composition
│   └── providers.tsx          # PostHog client init + event tracking
├── components/
│   ├── site/                  # Section components
│   └── ui/                    # Button, Accordion (shadcn-style)
├── lib/
│   ├── cn.ts                  # tailwind-merge helper
│   └── site.ts                # Site constants
├── public/                    # Favicon + OG (placeholders)
├── .env.example
├── next.config.ts             # Headers, PostHog rewrites
├── tailwind.config.ts         # Minimal — tokens live in globals.css
├── postcss.config.js          # @tailwindcss/postcss
└── tsconfig.json              # strict + noUncheckedIndexedAccess
```

---

## License

Private. © VetTiers.
