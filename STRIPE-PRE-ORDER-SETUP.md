# VetTiers — Stripe Pre-Order Setup ($0)

> Guide pour créer un Payment Link Stripe gratuit et ajouter un bouton "Pre-order $99" sur la landing.

---

## 🎯 Objectif

Avant de construire, tu pré-vends 20 "Founding Clinic" places à $99 dépôt remboursable.

**Si 5+ cliniques paient → tu construis avec preuve de demande + cash.**
**Si 0-1 paient → tu kill, tu économises 3 mois.**

---

## 📋 L'offre (à annoncer)

```
FOUNDING CLINIC — Pre-order exclusif

Dépôt : $99 (100% remboursable si on ne livre pas d'ici octobre 2026)

Ce que tu obtiens à vie :
✓ Beta access privée (avant général availability)
✓ Prix locked : $99/mo à vie (normal launch : $299/mo)
✓ 1h call mensuel avec Ayman (founder)
✓ Tes 3 features prioritaires dans le backlog
✓ Logo dans le hall of fame VetTiers

Conditions :
• Max 20 places. First come, first served.
• Tu es clinique vétérinaire US (ou y exerce).
• Si VetTiers ne livre pas d'ici 6 mois → refund automatique 100%.
• Le dépôt est crédit sur les 2 premiers mois de service.
```

---

## 🛠️ Setup Stripe (15 min, gratuit)

### Étape 1 — Compte Stripe

1. Aller sur `stripe.com` → "Start now"
2. Email : `ayman.idamre@gmail.com` (ou alias dédié)
3. Country : Belgium
4. Business type : **Individual / Sole proprietor** (pas besoin de société)
5. Bank account : ton IBAN belge personnel
6. Compléter KYC (ID belge + selfie) — validation 24-48h

**Pourquoi individual sans société ?**
- Légal en Belgique pour transactions &lt;€25,000/an
- Tu déclares comme revenus en annexe fiscale
- Au-delà → créer une SRL ($600-800 à Bruxelles), pas maintenant

### Étape 2 — Test Mode first

Pendant que Stripe vérifie ton KYC, tu peux setup en **test mode** :
- Dashboard Stripe → toggle "Test mode" (coin haut droit)
- Tu crées le Payment Link avec cartes de test (`4242 4242 4242 4242`)
- Tu bascules en Live mode quand KYC approuvé

### Étape 3 — Créer le Payment Link

1. Dashboard Stripe → "Products" → "Add product"
2. Fill :
   - **Name** : `VetTiers Founding Clinic Pre-Order`
   - **Description** : `$99 refundable deposit. Locks lifetime pricing at $99/mo. Max 20 spots. 100% refund if we don't ship by October 2026.`
   - **Image** : upload ton OG image (1200×630)
   - **Pricing** : One-time, $99.00 USD
3. Save product
4. Click "Create payment link" next to product
5. Options :
   - ☑️ Collect customer's billing address
   - ☑️ Collect customer's phone number
   - ☑️ Add custom field : `Clinic name` (text, required)
   - ☑️ Add custom field : `Your role` (dropdown: DVM / Practice Manager / Owner / Other)
   - ☑️ Add custom field : `Clinic size` (dropdown: 1 vet / 2-3 / 4-10 / 11+)
   - ☑️ Add custom field : `Current PIMS` (text)
   - ☑️ Add custom field : `State` (text)
   - ☑️ Limit quantity to 20 (inventory tracking)
   - **After payment** : redirect to `https://vettiers.vercel.app/founding-clinic-welcome`
   - **Terms of service URL** : `https://vettiers.vercel.app/terms`
6. Copy the Payment Link → sauvegarder dans `.env.local`

### Étape 4 — Env variable

Ajoute dans `/Users/aymn_idm/Desktop/IntraClaw/vettiers-landing/.env.local` :

```
NEXT_PUBLIC_STRIPE_PREORDER_LINK=https://buy.stripe.com/xxxxxxxxxxxxx
```

Et dans Vercel → Settings → Environment Variables → même variable.

---

## 🎨 Ajouter le bouton sur la landing

Je te prépare le composant dans le prochain commit :
- Nouvelle section "Founding Clinic" entre Pricing et FounderNote
- Bouton CTA `NEXT_PUBLIC_STRIPE_PREORDER_LINK`
- Counter "X / 20 spots remaining" (mise à jour manuelle au début)
- Post-purchase page `/founding-clinic-welcome`

---

## 📧 Post-purchase flow

Stripe envoie automatiquement le reçu. Tu dois envoyer :

### Email immédiat (template à copier dans Gmail)

```
Subject: Welcome to the VetTiers Founding Clinic circle 🎯

Dr. [First Name],

Thanks for putting skin in the game. You're officially one of the first 20.

Here's what happens next:

Week 1 — I'll email you a short intake form (7 questions) to understand your
clinic's current estimate workflow.

Weeks 2-3 — We'll schedule a 45-minute Zoom for your Founding Clinic kickoff.
You'll meet me, we'll walk through the product thinking, and you'll tell me
which 3 features should ship first.

Month 2 — You get beta access. I'll train you and one team member.

October 2026 — If VetTiers hasn't launched, you get your $99 back automatically.
No questions. I'm keeping this simple on purpose.

For now: reply to this email with two things —
1. Your best phone number
2. The #1 thing you want this product to solve for your clinic

Thanks again for the trust. Let's build.

Ayman
```

### Calendly gratuit pour bookings

- `cal.com` (free) → créer event type `VetTiers Founding Clinic Kickoff` (45 min)
- Coller le lien dans l'email

---

## 📊 Tracker Notion

Ajoute une vue dans ta DB `Contacts` :
- Filter : Status = "Pre-ordered"
- Properties visibles : Name, Email, Clinic, State, PIMS, Payment date, Payment amount
- Sort : Payment date DESC

---

## 🚨 Règles absolues

1. **Tu dis OUI au refund, toujours, sans question.** Ta réputation vaut plus que $99.
2. **Tu ne dépenses PAS le cash collecté** avant d'avoir livré. Tu le gardes sur Stripe jusqu'au ship.
3. **Si tu réalises que tu ne peux pas livrer** → refund TOUS immédiatement, écris un email honnête, tu fermes. C'est dur mais c'est la seule option éthique.
4. **Si 0 achats après 3 semaines** → ton offre est wrong OU ton prix wrong OU ton problème wrong. Pivot, ne pas forcer.

---

## 🎯 Signal à détecter

| Ventes en 3 sem | Interprétation | Action |
|---|---|---|
| 10+ | 🟢 Product-market fit détecté | BUILD ASAP |
| 5-9 | 🟡 Bon signal, pricing à ajuster | Interviews les acheteurs pour comprendre |
| 2-4 | 🟠 Signal faible | Repenser offre / audience |
| 0-1 | 🔴 Échec validation | KILL ou pivot radical |

---

## 💰 Coût total de cette étape

**$0.**

- Stripe : gratuit (2.9% + $0.30 par transaction, déduit du montant)
- Stripe Payment Link : gratuit
- Cal.com : gratuit
- Email : Gmail gratuit
- Notion tracker : gratuit

**Si 5 cliniques paient $99 = $485 dans ta poche** (après frais Stripe ~$15).
Ça finance les domaines, incentives interviews, coûts légaux.

**C'est le moment où la validation devient auto-financée.**

---

## ⏰ Timeline

```
Jour 1  : Créer compte Stripe, KYC submitted
Jour 2  : Test mode setup Payment Link
Jour 3  : KYC approved → Live mode
Jour 4  : Bouton intégré sur landing (je le fais)
Jour 5  : Poste LinkedIn #3 annonce pre-order
Jour 6+ : Outreach ciblé vers les 10 vets interviews qui ont montré intérêt
```

---

**Prochaine action de ma part** : ajouter le composant "Founding Clinic Pre-Order" sur la landing page dès que tu as ton Stripe Payment Link. Pour l'instant, le bouton pointera vers un placeholder.
