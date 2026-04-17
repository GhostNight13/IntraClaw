/**
 * scripts/stripe-setup.ts
 * ────────────────────────
 * Idempotent provisioning of IntraClaw's Stripe products and recurring prices.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx ts-node scripts/stripe-setup.ts
 *
 * The script:
 *   1. Creates (or reuses, by lookup_key) the Pro and Agency products.
 *   2. Creates monthly EUR recurring prices for each.
 *   3. Prints the price IDs to copy into your .env.
 *
 * Re-running is safe: existing products/prices are reused based on
 * `metadata.intraclaw_tier` for products and `lookup_key` for prices.
 */
import 'dotenv/config';
import Stripe from 'stripe';

interface TierSpec {
  tier: 'pro' | 'agency';
  name: string;
  description: string;
  amountEurCents: number;
  priceLookupKey: string;
  envVar: string;
}

const TIERS: TierSpec[] = [
  {
    tier: 'pro',
    name: 'IntraClaw Pro',
    description: 'Unlimited loop ticks, vector memory, Stripe tool access, priority queue.',
    amountEurCents: 1500, // 15.00 EUR
    priceLookupKey: 'intraclaw_pro_monthly_eur',
    envVar: 'STRIPE_PRICE_PRO',
  },
  {
    tier: 'agency',
    name: 'IntraClaw Agency',
    description: 'Multi-agent (up to 5), custom skills, white-label.',
    amountEurCents: 4900, // 49.00 EUR
    priceLookupKey: 'intraclaw_agency_monthly_eur',
    envVar: 'STRIPE_PRICE_AGENCY',
  },
];

async function findProductByTier(stripe: Stripe, tier: string): Promise<Stripe.Product | null> {
  // Search API isn't always enabled on test mode; fall back to listing.
  try {
    const search = await stripe.products.search({
      query: `metadata['intraclaw_tier']:'${tier}' AND active:'true'`,
      limit: 1,
    });
    if (search.data.length > 0) return search.data[0]!;
  } catch {
    // ignore — search not available, fall through to list
  }

  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.['intraclaw_tier'] === tier) return product;
  }
  return null;
}

async function findPriceByLookupKey(stripe: Stripe, lookupKey: string): Promise<Stripe.Price | null> {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return list.data[0] ?? null;
}

async function ensureProduct(stripe: Stripe, spec: TierSpec): Promise<Stripe.Product> {
  const existing = await findProductByTier(stripe, spec.tier);
  if (existing) {
    console.log(`✓ Product exists: ${existing.id} (${spec.name})`);
    return existing;
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { intraclaw_tier: spec.tier },
  });
  console.log(`+ Created product: ${created.id} (${spec.name})`);
  return created;
}

async function ensurePrice(
  stripe: Stripe,
  product: Stripe.Product,
  spec: TierSpec,
): Promise<Stripe.Price> {
  const existing = await findPriceByLookupKey(stripe, spec.priceLookupKey);
  if (existing) {
    if (existing.unit_amount === spec.amountEurCents && existing.product === product.id) {
      console.log(`✓ Price exists: ${existing.id} (${spec.priceLookupKey})`);
      return existing;
    }
    // Amount changed — deactivate old, create new with the same lookup key.
    console.log(`⚠ Price ${existing.id} amount/product mismatch, replacing`);
    await stripe.prices.update(existing.id, { active: false, lookup_key: undefined });
  }

  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.amountEurCents,
    currency: 'eur',
    recurring: { interval: 'month' },
    lookup_key: spec.priceLookupKey,
    transfer_lookup_key: true,
    metadata: { intraclaw_tier: spec.tier },
  });
  console.log(`+ Created price: ${created.id} (${spec.priceLookupKey})`);
  return created;
}

async function main(): Promise<void> {
  const secret = process.env['STRIPE_SECRET_KEY'];
  if (!secret) {
    console.error('ERROR: STRIPE_SECRET_KEY not set in environment.');
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: '2026-03-25.dahlia' as Stripe.LatestApiVersion });

  console.log('IntraClaw — Stripe product provisioning\n');

  const results: { envVar: string; priceId: string }[] = [];
  for (const spec of TIERS) {
    const product = await ensureProduct(stripe, spec);
    const price = await ensurePrice(stripe, product, spec);
    results.push({ envVar: spec.envVar, priceId: price.id });
  }

  console.log('\n────────────────────────────────────────');
  console.log('Copy these into your .env file:\n');
  for (const r of results) {
    console.log(`${r.envVar}=${r.priceId}`);
  }
  console.log('────────────────────────────────────────\n');
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error('stripe-setup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
