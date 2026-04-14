'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Zap, Users, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const API = 'http://localhost:3001';

interface PlanFeatures {
  name: string;
  priceEur: number;
  tasksPerMonth: number;
  channels: number;
}

interface SubscriptionData {
  subscription: {
    id: number;
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: 'free' | 'pro' | 'team';
    status: string;
    currentPeriodEnd: string | null;
  };
  plan: 'free' | 'pro' | 'team';
  features: PlanFeatures;
  canDoTask: boolean;
  tasksThisMonth: number;
}

const PLAN_DETAILS = {
  free: {
    icon: <Zap className="w-6 h-6" />,
    color: 'from-slate-600 to-slate-700',
    badge: 'border-slate-500',
    features: [
      '50 tasks / month',
      '1 channel',
      'Basic agents',
      'Community support',
    ],
  },
  pro: {
    icon: <CreditCard className="w-6 h-6" />,
    color: 'from-violet-600 to-indigo-700',
    badge: 'border-violet-500',
    features: [
      'Unlimited tasks',
      'All channels',
      'All agents',
      'Priority support',
      'Workflow automation',
      'API access',
    ],
  },
  team: {
    icon: <Users className="w-6 h-6" />,
    color: 'from-amber-600 to-orange-700',
    badge: 'border-amber-500',
    features: [
      'Everything in Pro',
      'Team management',
      'Shared memory',
      'Advanced analytics',
      'Custom integrations',
      'Dedicated support',
    ],
  },
};

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<'pro' | 'team' | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/api/billing/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing status');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: 'pro' | 'team') {
    setUpgrading(plan);
    setError(null);
    try {
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
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

  async function handlePortal() {
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
  const tasksUsed = data?.tasksThisMonth ?? 0;
  const usagePct = Math.min(100, Math.round((tasksUsed / 50) * 100));
  const hasStripeCustomer = !!data?.subscription?.stripeCustomerId;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and usage</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Plan Summary */}
      {loading ? (
        <div className="bg-slate-800 rounded-xl p-6 animate-pulse h-32" />
      ) : data && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-slate-400 text-sm">Current plan</p>
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

            {/* Usage meter — free plan only */}
            {currentPlan === 'free' && (
              <div className="w-full sm:w-64">
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Tasks this month</span>
                  <span>{tasksUsed} / 50</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                {usagePct >= 90 && (
                  <p className="text-red-400 text-xs mt-1">Approaching limit — upgrade for unlimited tasks</p>
                )}
              </div>
            )}

            {/* Manage billing button for subscribers */}
            {hasStripeCustomer && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {portalLoading ? 'Opening…' : 'Manage Billing'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {(['free', 'pro', 'team'] as const).map((plan) => {
          const details = PLAN_DETAILS[plan];
          const isCurrent = currentPlan === plan;
          const price = plan === 'free' ? '€0' : plan === 'pro' ? '€19' : '€79';
          const period = plan === 'free' ? '' : '/mo';

          return (
            <div
              key={plan}
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
                <h2 className="text-white font-bold text-lg capitalize">{plan}</h2>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{price}</span>
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

              {plan !== 'free' && !isCurrent && (
                <button
                  onClick={() => void handleUpgrade(plan)}
                  disabled={upgrading !== null}
                  className={`mt-2 w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                    plan === 'pro'
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {upgrading === plan ? 'Redirecting…' : `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
                </button>
              )}

              {isCurrent && plan !== 'free' && hasStripeCustomer && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="mt-2 w-full py-2 px-4 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Opening…' : 'Manage Subscription'}
                </button>
              )}

              {isCurrent && plan === 'free' && (
                <div className="mt-2 text-center text-slate-500 text-xs">Active — no charge</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-700">
          <h2 className="text-white font-semibold">Feature comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-slate-400 font-medium">Feature</th>
              <th className="text-center p-4 text-slate-400 font-medium">Free</th>
              <th className="text-center p-4 text-violet-400 font-medium">Pro</th>
              <th className="text-center p-4 text-amber-400 font-medium">Team</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[
              { label: 'Tasks per month', free: '50', pro: 'Unlimited', team: 'Unlimited' },
              { label: 'Channels', free: '1', pro: 'All', team: 'All' },
              { label: 'Agent types', free: 'Basic', pro: 'All', team: 'All' },
              { label: 'Workflow automation', free: '—', pro: <Check className="w-4 h-4 text-emerald-400 mx-auto" />, team: <Check className="w-4 h-4 text-emerald-400 mx-auto" /> },
              { label: 'Team management', free: '—', pro: '—', team: <Check className="w-4 h-4 text-emerald-400 mx-auto" /> },
              { label: 'Shared memory', free: '—', pro: '—', team: <Check className="w-4 h-4 text-emerald-400 mx-auto" /> },
              { label: 'Support', free: 'Community', pro: 'Priority', team: 'Dedicated' },
            ].map((row) => (
              <tr key={row.label} className="hover:bg-slate-700/20">
                <td className="p-4 text-slate-300">{row.label}</td>
                <td className="p-4 text-center text-slate-400">{row.free}</td>
                <td className="p-4 text-center text-slate-300">{row.pro}</td>
                <td className="p-4 text-center text-slate-300">{row.team}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
