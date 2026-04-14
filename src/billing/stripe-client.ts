// Stripe v22 uses ESM-first. For CJS/TS, we use the class from the core module.
import StripeLib from 'stripe';
import type { Stripe as StripeClass } from 'stripe/esm/stripe.core.js';
import type { Subscription as StripeSubscription } from 'stripe/esm/resources/Subscriptions.js';
import type { Session as CheckoutSession } from 'stripe/esm/resources/Checkout/Sessions.js';
import type { Customer as StripeCustomer } from 'stripe/esm/resources/Customers.js';
import { getDb } from '../db';
import { getOrCreateSubscription, updateSubscription } from './subscription';
import type { SubscriptionPlan, SubscriptionStatus } from './types';

function getStripe(): StripeClass | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new StripeLib(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  }) as unknown as StripeClass;
}

function getPriceId(plan: 'pro' | 'team'): string {
  const envKey = plan === 'pro' ? 'STRIPE_PRICE_ID_PRO' : 'STRIPE_PRICE_ID_TEAM';
  const priceId = process.env[envKey];
  if (!priceId) throw new Error(`Missing env var ${envKey}`);
  return priceId;
}

export async function createCheckoutSession(
  userId: string,
  plan: 'pro' | 'team',
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const priceId = getPriceId(plan);
  const sub = getOrCreateSubscription(userId);

  const sessionParams: Parameters<StripeClass['checkout']['sessions']['create']>[0] = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, plan },
  };

  if (sub.stripeCustomerId) {
    (sessionParams as Record<string, unknown>)['customer'] = sub.stripeCustomerId;
  } else {
    (sessionParams as Record<string, unknown>)['customer_creation'] = 'always';
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  const url = (session as unknown as { url?: string }).url;
  if (!url) throw new Error('No checkout URL returned');
  return url;
}

export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return (session as unknown as { url: string }).url;
}

function stripeStatusToLocal(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':             return 'active';
    case 'canceled':           return 'canceled';
    case 'past_due':           return 'past_due';
    case 'trialing':           return 'trialing';
    case 'unpaid':             return 'past_due';
    case 'incomplete':         return 'inactive';
    case 'incomplete_expired': return 'inactive';
    case 'paused':             return 'inactive';
    default:                   return 'inactive';
  }
}

function extractPeriodEnd(stripeSub: StripeSubscription): string | null {
  // In API v2026 current_period_end moved to items. Fall back to trial_end.
  const raw = stripeSub as unknown as Record<string, unknown>;
  if (typeof raw['current_period_end'] === 'number') {
    return new Date((raw['current_period_end'] as number) * 1000).toISOString();
  }
  if (typeof stripeSub.trial_end === 'number') {
    return new Date(stripeSub.trial_end * 1000).toISOString();
  }
  return null;
}

function getCustomerId(customer: StripeSubscription['customer'] | CheckoutSession['customer']): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  const c = customer as StripeCustomer | { id: string };
  return c.id ?? null;
}

async function handleCheckoutCompleted(session: CheckoutSession): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const customerId = getCustomerId(session.customer);
  const plan = (session.metadata?.plan ?? 'pro') as SubscriptionPlan;

  let subscriptionId: string | null = null;
  let periodEnd: string | null = null;
  let status: SubscriptionStatus = 'active';

  if (session.subscription) {
    const stripe = getStripe()!;
    const subId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as { id: string }).id;

    const stripeSub = await stripe.subscriptions.retrieve(subId) as unknown as StripeSubscription;
    subscriptionId = stripeSub.id;
    status = stripeStatusToLocal(String(stripeSub.status));
    periodEnd = extractPeriodEnd(stripeSub);
  }

  updateSubscription(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    status,
    currentPeriodEnd: periodEnd,
  });
}

async function handleSubscriptionUpdated(stripeSub: StripeSubscription): Promise<void> {
  const db = getDb();
  const customerId = getCustomerId(stripeSub.customer);
  if (!customerId) return;

  const row = db
    .prepare('SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?')
    .get(customerId) as { user_id: string } | undefined;

  if (!row) return;

  const status = stripeStatusToLocal(String(stripeSub.status));
  const periodEnd = extractPeriodEnd(stripeSub);

  updateSubscription(row.user_id, {
    stripeSubscriptionId: stripeSub.id,
    status,
    currentPeriodEnd: periodEnd,
  });
}

async function handleSubscriptionDeleted(stripeSub: StripeSubscription): Promise<void> {
  const db = getDb();
  const customerId = getCustomerId(stripeSub.customer);
  if (!customerId) return;

  const row = db
    .prepare('SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?')
    .get(customerId) as { user_id: string } | undefined;

  if (!row) return;

  updateSubscription(row.user_id, {
    plan: 'free',
    status: 'canceled',
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as unknown as CheckoutSession);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as unknown as StripeSubscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as unknown as StripeSubscription);
      break;
    default:
      break;
  }
}
