'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Zap, Briefcase, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const API = 'http://localhost:3001';

type Tier = 'free' | 'pro' | 'team' | 'agency';

interface PlanFeatures {
  name: string;
  priceEur: number;
  tasksPerMonth: number;
  channels: number;
  loopTicksPerDay: number;
  maxAgents: number;
  vectorMemory: boolean;
  stripeToolAccess: boolean;
  priorityQueue: boolean;
  customSkills: boolean;
  whiteLabel: boolean;
}

interface SubscriptionData {
  subscription: {
    id: number;
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: Tier;
    status: string;
    currentPeriodEnd: string | null;
  };
  plan: Tier;
  features: PlanFeatures;
  canDoTask: boolean;
  tasksThisMonth: number;
  ticksToday: number;
  ticksLimit: number; // -1 = unlimited
}

const PLAN_DETAILS: Record<Tier, {
  icon: React.ReactNode;
  color: string;
  badge: string;
  priceLabel: string;
  features: string[];
}> = {
  free: {
    icon: <Zap className="w-6 h-6" />,
    color: 'from-slate-600 to-slate-700',
    badge: 'border-slate-500',
    priceLabel: '€0',
    features: [
      '1 agent',
      '10 loop ticks / day',
      'Markdown memory only',
      'Community support',
    ],
  },
  pro: {
    icon: <CreditCard className="w-6 h-6" />,
    color: 'from-violet-600 to-indigo-700',
    badge: 'border-violet-500',
    priceLabel: '€15',
    features: [
      'Unlimited loop ticks',
      'Vector memory',
      'Stripe tool access',
      'Priority queue',
      'Email support',
    ],
  },
  agency: {
    icon: <Briefcase className="w-6 h-6" />,
    color: 'from-amber-600 to-orange-700',
    badge: 'border-amber-500',
    priceLabel: '€49',
    features: [
      'Everything in Pro',
      'Up to 5 agents',
      'Custom skills',
      'White-label',
      'Priority support',
    ],
  },
  team: {
    icon: <Briefcase className="w-6 h-6" />,
    color: 'from-emerald-600 to-teal-700',
    badge: 'border-emerald-500',
    priceLabel: '€79',
    features: ['Legacy team plan'],
  },
};

const VISIBLE_TIERS: Tier[] = ['free', 'pro', 'agency'];

export default function BillingPage(): React.ReactElement {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<Tier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchStatus();
  }, []);

  async function fetchStatus(): Promise<void> {
    try {
      const res = await fetch(`${API}/api/billing/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as SubscriptionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing status');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(tier: Tier): Promise<void> {
    if (tier === 'free' || tier === 'team') return;
    setUpgrading(tier);
    setError(null);
    try {
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Failed to create checkout session');
      }
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setUpgrading(null);
    }
  }

  async function handlePortal(): Promise<void> {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/billing/portal`, { method: 'POST' });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Failed to open billing portal');
      }
      window.open(json.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portal failed');
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = data?.plan ?? 'free';
  const ticksUsed = data?.ticksToday ?? 0;
  const ticksLimit = data?.ticksLimit ?? 10;
  const ticksUnlimited = ticksLimit === -1;
  const ticksPct = ticksUnlimited ? 0 : Math.min(100, Math.round((ticksUsed / Math.max(ticksLimit, 1)) * 100));
  const hasStripeCustomer = !!data?.subscription?.stripeCustomerId;
  const paymentProblem = data?.subscription?.status === 'payment_failed' || data?.subscription?.status === 'past_due';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and usage</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {paymentProblem && (
        <div className="flex items-center gap-3 bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Your last payment failed. Open the billing portal to update your card.</span>
        </div>
      )}

      {loading ? (
        <div className="bg-slate-800 rounded-xl p-6 animate-pulse h-32" />
      ) : data && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-slate-400 text-sm">Current tier</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white text-xl font-bold capitalize">{currentPlan}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_DETAILS[currentPlan].badge} text-slate-300`}>
                  {data.subscription.status}
                </span>
              </div>
              {data.subscription.currentPeriodEnd && (
                <p className="text-slate-500 text-xs mt-1">
                  Renews {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="w-full sm:w-72">
              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>Loop ticks today</span>
                <span>
                  {ticksUsed}
                  {ticksUnlimited ? ' (unlimited)' : ` / ${ticksLimit}`}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    ticksUnlimited
                      ? 'bg-emerald-500'
                      : ticksPct >= 90 ? 'bg-red-500'
                      : ticksPct >= 70 ? 'bg-amber-500'
                      : 'bg-violet-500'
                  }`}
                  style={{ width: `${ticksUnlimited ? 100 : ticksPct}%` }}
                />
              </div>
              {!ticksUnlimited && ticksPct >= 90 && (
                <p className="text-red-400 text-xs mt-1">Approaching daily limit — upgrade for unlimited ticks</p>
              )}
            </div>

            {hasStripeCustomer && (
              <button
                onClick={() => void handlePortal()}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {portalLoading ? 'Opening…' : 'Manage Subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {VISIBLE_TIERS.map((tier) => {
          const details = PLAN_DETAILS[tier];
          const isCurrent = currentPlan === tier;
          const period = tier === 'free' ? '' : '/mo';

          return (
            <div
              key={tier}
              className={`relative rounded-xl border p-6 flex flex-col gap-4 transition-all ${
                isCurrent
                  ? 'border-violet-500 bg-slate-800/80 ring-1 ring-violet-500/40'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs px-3 py-0.5 rounded-full">
                  Current
                </div>
              )}

              <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${details.color} w-fit`}>
                {details.icon}
              </div>

              <div>
                <h2 className="text-white font-bold text-lg capitalize">{tier}</h2>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{details.priceLabel}</span>
                  <span className="text-slate-400 text-sm">{period}</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1">
                {details.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {tier !== 'free' && !isCurrent && (
                <button
                  onClick={() => void handleUpgrade(tier)}
                  disabled={upgrading !== null}
                  className={`mt-2 w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                    tier === 'pro'
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {upgrading === tier ? 'Redirecting…' : `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`}
                </button>
              )}

              {isCurrent && tier !== 'free' && hasStripeCustomer && (
                <button
                  onClick={() => void handlePortal()}
                  disabled={portalLoading}
                  className="mt-2 w-full py-2 px-4 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Opening…' : 'Manage Subscription'}
                </button>
              )}

              {isCurrent && tier === 'free' && (
                <div className="mt-2 text-center text-slate-500 text-xs">Active — no charge</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
