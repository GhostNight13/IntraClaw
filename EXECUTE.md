# VetTiers — EXECUTE.md (Plan $0)

> **Zéro argent dépensé pendant la validation.** Tu paies quelque chose SEULEMENT si Cherry accepte et que tu décides de signer un contrat.

---

## 🎯 RÈGLE D'OR

Ne dépense rien tant que tu n'as pas **une des deux preuves suivantes** :
1. **Cherry a dit OUI** au partenariat
2. **10 vets ont dit** "je paierais $X/mois pour ça" sans que tu aies demandé

Avant ça → tout est gratuit.

---

## 🆓 LE PLAN 100% GRATUIT

### Domaine → **Vercel subdomain**
Tu n'achètes PAS `vettiers.com` tout de suite. Tu utilises `vettiers.vercel.app` (gratuit à vie).

**Pourquoi ça marche pour valider** : Cherry va juger le produit + la thèse, pas le TLD. Même PetsApp a commencé sur un subdomain. Tu achètes le .com seulement quand tu as du signal.

**Coût : $0**

### Email → **Gmail avec alias**
Tu utilises `ayman.idamre+vettiers@gmail.com` ou tu crées un nouveau Gmail `vettiers.saas@gmail.com` (gratuit).

Dans les emails Cherry, signe avec ton vrai nom + ce Gmail. 100% légitime.

**Coût : $0**

### Hosting → **Vercel free tier**
- 100 GB bandwidth/mois
- Unlimited projects
- Auto HTTPS
- CI/CD GitHub intégré

**Coût : $0**

### Analytics → **PostHog free tier**
- 1 million events/mois
- Session recording inclus

**Coût : $0**

### Form → **Tally free tier**
- Unlimited submissions
- Logic jumps
- Webhook

**Coût : $0**

### Privacy/Terms → **Je te les écris direct**
Pas besoin d'iubenda. Je te génère un Privacy Policy + Terms basiques pour waitlist, suffisants légalement.

**Coût : $0**

### Notion → **Free tier**
Unlimited pages + databases pour usage solo.

**Coût : $0**

### Incentives interviews → **Aucun au début**
Tu vends la curiosité + la mission, pas l'argent.

Pet owners : "J'étudie pourquoi les gens disent non chez le vet, 15 min, je te partage les résultats quand fini"
Vets : "Research project sur le workflow estimate — je t'enverrai un résumé anonymisé"

**Taux de recrutement plus bas mais non-nul.** Tu vises 10 interviews chacun au lieu de 30/10, mais c'est suffisant pour détecter un signal clair.

**Coût : $0**

### Cherry outreach → **100% email + LinkedIn gratuit**
Envoyer un email ne coûte rien. LinkedIn DMs gratuits.

**Coût : $0**

### Stripe Atlas / DE C-Corp → **SEULEMENT si Cherry signe**
Tu ne crées la société US que si Cherry dit "on veut signer avec vous". Pas avant.

**Coût : $0 pour l'instant** (500$ plus tard, mais ce sera financé par Cherry volume)

---

## 💰 BUDGET RÉEL

| Phase | Dépense |
|---|---|
| Semaine 0-3 (validation) | **$0** |
| Si Cherry signe | $500 (DE C-Corp) |
| Si 10 vets LOI + Cherry OK | +$12 (domaine .com) |

**Total pour valider : $0.** Zéro.

---

## 📅 SEMAINE 0 — Setup gratuit (4 jours)

### LUNDI (3h) — Landing local + Vercel

- [ ] Ouvrir terminal :
  ```bash
  cd /Users/aymn_idm/Desktop/IntraClaw/vettiers-landing
  cp .env.example .env.local
  npm run dev
  ```
- [ ] Ouvrir `http://localhost:3000` → vérifier affichage
- [ ] Créer compte GitHub (si pas déjà) → `github.com`
- [ ] Créer repo `vettiers-landing` public (public = gratuit pour auto-deploy)
- [ ] Push le code :
  ```bash
  git init
  git add .
  git commit -m "Initial landing"
  git branch -M main
  git remote add origin https://github.com/Ayman-idamre/vettiers-landing.git
  git push -u origin main
  ```
- [ ] Créer compte Vercel (gratuit) avec GitHub login → `vercel.com`
- [ ] Import repo → Deploy → ton URL sera `vettiers-landing-[random].vercel.app`
- [ ] Dans Vercel Settings → Domain → rename to `vettiers.vercel.app` (si dispo)

### MARDI (2h) — Comptes gratuits

- [ ] **PostHog** (`posthog.com`, free) → créer project → copier `phc_...` key
- [ ] **Tally** (`tally.so`, free) → créer form avec 8 champs (liste ci-dessous)
- [ ] **Gmail** `vettiers.saas@gmail.com` si tu veux séparer du perso
- [ ] Dans Vercel → Settings → Environment Variables :
  ```
  NEXT_PUBLIC_POSTHOG_KEY=phc_...
  NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
  TALLY_WEBHOOK_URL=https://api.tally.so/webhook/...
  NEXT_PUBLIC_SITE_URL=https://vettiers.vercel.app
  ```
- [ ] Redeploy (Vercel → Deployments → Redeploy)

### Champs Tally form à créer :
1. `email` — email type, required
2. `first_name` — text, required
3. `clinic_name` — text, required
4. `role` — dropdown : DVM / Practice Manager / Owner non-DVM / Other
5. `clinic_size` — dropdown : 1 vet / 2-3 vets / 4-10 vets / 11+ vets
6. `pims` — dropdown : Cornerstone / ezyVet / AVImark / Provet Cloud / IDEXX Neo / Paper / Other
7. `state` — dropdown : 50 US states + "Not US"
8. `interview_willing` — radio : Yes this week / Yes later / No

### MERCREDI (2h) — Notion gratuit

- [ ] Notion account gratuit
- [ ] Suivre `/interview-tracker/01-notion-setup-guide.md`
- [ ] Importer CSV `03-contacts.csv` dans Contacts DB

### JEUDI (3h) — Cherry outreach (GRATUIT)

- [ ] Ouvrir `/cherry-outreach/01-partnership-email.md`
- [ ] Remplacer placeholders :
  - `[TODO: vettiers.com URL]` → `https://vettiers.vercel.app`
  - `[TODO: nombre waitlist]` → "just launched, building"
  - `[TODO: interviews]` → "10 scheduled for next 2 weeks"
- [ ] Envoyer depuis Gmail à `partnerships@withcherry.com`
- [ ] LinkedIn DMs (3, gratuits) :
  - Andy Cahoy CRO → DM `/cherry-outreach/02-linkedin-vp-partnerships.md`
  - Felix Steinmeyer CEO → `/cherry-outreach/03-linkedin-head-of-bd.md`
  - Pramod Thammaiah CPO → `/cherry-outreach/04-linkedin-product-lead.md`

### VENDREDI (3h) — Recrutement interviews

- [ ] Post LinkedIn personnel (GRATUIT, annonce waitlist)
- [ ] Post Twitter thread (GRATUIT)
- [ ] DM modérateurs Reddit (r/pets, r/AskVet, r/veterinary)
  - Attendre approval avant de poster
- [ ] Poster dans Reddit après approval
- [ ] LinkedIn Sales Navigator : **1 mois gratuit trial** si jamais utilisé → 50 DMs vets

---

## 📅 SEMAINES 1-3 — Recrutement ($0)

**Objectif ajusté (sans incentives) : 10 pet owners + 5 vets en 3 semaines.**

Canaux gratuits :
- Reddit (après mod DM)
- Facebook groups (après admin DM)
- LinkedIn (free tier = 5 InMails/mois, utilise aussi commentaires publics)
- Twitter DMs
- Cold email via state VMAs (gratuit)
- Forums AAHA publics

**Technique qui marche sans argent** : proposer de leur envoyer le **résumé anonymisé des findings**. Curiosité intellectuelle > gift card.

---

## 🎯 DÉCISION (fin semaine 3)

Ratio pink/yellow dans les quotes :
- **Pink > Yellow** → pivot (problème émotionnel, pas économique)
- **Yellow dominant + 3+ WTP spontanés** → Build VetTiers
- **Zéro signal** → kill ou retour HaiSkills

---

## 🚨 QUAND TU DÉPENSES DE L'ARGENT (et pas avant)

### Cherry dit OUI → dépense $500 DE C-Corp
Raison : contrat requiert entité US.

### 10 vets LOI signées → dépense $12 domaine
Raison : tu peux alors annoncer publiquement + pitch investors si tu veux.

### 100 cliniques payantes → dépense $1K/mois marketing
Raison : tu as du revenu qui paie le CAC.

**Jamais avant.**

---

## 📂 Fichiers utiles

```
/Users/aymn_idm/Desktop/IntraClaw/
├── VetTiers-veto-saas.md         ← explication simple
├── EXECUTE.md                    ← ce fichier ($0 plan)
├── vettiers-landing/             ← code Next.js prêt ✅ (build OK)
├── cherry-outreach/              ← emails + DMs verified contacts
├── cherry-pitch-deck/            ← si Cherry dit oui Zoom
└── interview-tracker/            ← Notion 4 DBs + CSV
```

---

## ✅ Progrès

```
Semaine 0  ░░░░░ [ ] Vercel deploy [ ] PostHog+Tally [ ] Cherry envoyé
Semaine 1  ░░░░░ [ ] 5 waitlist [ ] 2 interviews
Semaine 2  ░░░░░ [ ] 15 waitlist [ ] 7 interviews [ ] Cherry bump
Semaine 3  ░░░░░ [ ] 15 interviews [ ] Synthèse [ ] Decision
```

---

**Dépense actuelle : $0.**
**Dépense max avant validation : $0.**

Tu démarres quand tu veux. Pas d'excuse financière.
