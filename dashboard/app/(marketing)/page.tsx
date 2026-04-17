'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight, PlayCircle, Check, X, Zap, Lock, Brain,
  Store, Infinity as InfinityIcon, Code2, Sparkles,
} from 'lucide-react';

/* ─────────────────────────  HERO  ───────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.15) 35%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-3xl -z-10 opacity-30"
        style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
      />

      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-2xl">🐾</span>
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            IntraClaw
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#compare" className="hover:text-white transition-colors">Compare</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/login"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 mb-8">
          <Sparkles size={12} className="text-pink-400" />
          Ouroboros AI · self-improving on every loop
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
          The AI agent that{' '}
          <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            improves itself
          </span>{' '}
          while you sleep
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
          IntraClaw observes its own behavior, rewrites its strategies and runs an
          autonomous loop on your inbox, calendar, CRM and content — so your business
          compounds even when you&apos;re offline.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/login"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-medium hover:shadow-lg hover:shadow-pink-500/30 transition-all"
          >
            Start free
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors font-medium"
          >
            <PlayCircle size={18} />
            Watch demo
          </a>
        </div>
        <p className="mt-6 text-xs text-white/40">
          Free forever · No credit card · Self-host on day one
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────  OUROBOROS  ───────────────────────── */
const STAGES = [
  { label: 'Perceive',     desc: 'Reads inbox, calendar, signals' },
  { label: 'Think',        desc: 'Plans next action with Claude' },
  { label: 'Act',          desc: 'Sends, schedules, posts, codes' },
  { label: 'Observe',      desc: 'Logs outcome + side-effects' },
  { label: 'Self-improve', desc: 'Rewrites its own strategies' },
  { label: 'REM',          desc: 'Consolidates memory at night' },
];

function Ouroboros() {
  return (
    <section id="how" className="py-32 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <div className="inline-block text-xs text-pink-400 font-semibold tracking-wider uppercase mb-4">
          The Ouroboros loop
        </div>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          A mind that{' '}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            eats its own tail
          </span>
        </h2>
        <p className="text-white/60 max-w-2xl mx-auto mb-16">
          Most AI tools wait for prompts. IntraClaw runs a continuous six-stage loop —
          and rewrites the loop itself based on what works.
        </p>

        <div className="relative mx-auto" style={{ width: 'min(560px, 90vw)', aspectRatio: '1' }}>
          {/* rotating ring */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 w-full h-full animate-[spin_24s_linear_infinite]"
            aria-hidden
          >
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
              </marker>
            </defs>
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="url(#ring)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              markerEnd="url(#arrow)"
            />
          </svg>

          {/* center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-2">🐾</div>
              <div className="text-xs text-white/40 uppercase tracking-widest">Self-loop</div>
            </div>
          </div>

          {/* stage nodes */}
          {STAGES.map((s, i) => {
            const angle = (i / STAGES.length) * 2 * Math.PI - Math.PI / 2;
            const r = 46; // % of container
            const x = 50 + r * Math.cos(angle);
            const y = 50 + r * Math.sin(angle);
            return (
              <div
                key={s.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-white/20 flex items-center justify-center text-xs font-bold backdrop-blur-sm group-hover:scale-110 transition-transform">
                  {i + 1}
                </div>
                <div className="absolute top-14 left-1/2 -translate-x-1/2 text-center w-32">
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-white/50 mt-0.5">{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  FEATURES  ───────────────────────── */
const FEATURES = [
  {
    icon: Zap,
    title: 'Multi-channel',
    desc: 'Email, Telegram, Slack, voice, web. One brain, every surface.',
  },
  {
    icon: Brain,
    title: 'Self-improving',
    desc: 'The agent reviews its own logs, A/B tests new prompts, and ships winners.',
  },
  {
    icon: Lock,
    title: 'Private memory',
    desc: 'Your data stays on your infra. SQLite + optional vector store, encrypted at rest.',
  },
  {
    icon: Store,
    title: 'Skills marketplace',
    desc: 'Drop-in skills for prospecting, content, finance. Publish your own.',
  },
  {
    icon: InfinityIcon,
    title: 'Autonomous loop',
    desc: 'Runs 24/7 with hard budget limits and human-in-the-loop escalations.',
  },
  {
    icon: Code2,
    title: 'Open-source core',
    desc: 'MIT-licensed engine. Fork it, audit it, self-host it. No vendor trap.',
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block text-xs text-pink-400 font-semibold tracking-wider uppercase mb-4">
            What&apos;s inside
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">Built for operators</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-pink-500/30 hover:bg-white/[0.05] transition-all"
            >
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2))' }}
              />
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center mb-4">
                <f.icon size={18} className="text-pink-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  COMPARISON  ───────────────────────── */
type Cell = boolean | string;
const COMPARE: { feature: string; intra: Cell; open: Cell; hermes: Cell }[] = [
  { feature: 'Self-improving (auto prompt evolution)', intra: true,  open: false, hermes: 'Limited' },
  { feature: 'Open-source core',                       intra: 'MIT', open: false, hermes: false     },
  { feature: 'Self-hosted option',                     intra: true,  open: false, hermes: false     },
  { feature: 'Private memory (no training on data)',   intra: true,  open: 'Opt-out', hermes: false },
  { feature: 'Multi-channel (email/voice/Slack/...)',  intra: true,  open: true,  hermes: true      },
  { feature: 'Hard budget caps + escalation',          intra: true,  open: false, hermes: false     },
  { feature: '2FA + audit log + GDPR',                 intra: true,  open: 'Pro+', hermes: 'Add-on' },
  { feature: 'Skills marketplace',                     intra: true,  open: false, hermes: false     },
];

function CellView({ v }: { v: Cell }) {
  if (v === true)  return <Check size={18} className="text-emerald-400 mx-auto" />;
  if (v === false) return <X size={18} className="text-white/30 mx-auto" />;
  return <span className="text-xs text-white/70">{v}</span>;
}

function Comparison() {
  return (
    <section id="compare" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block text-xs text-pink-400 font-semibold tracking-wider uppercase mb-4">
            Honest comparison
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Why teams switch from{' '}
            <span className="text-white/40 line-through decoration-pink-500/60">closed</span>{' '}
            agents
          </h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left py-4 px-6 font-medium text-white/70">Feature</th>
                  <th className="py-4 px-4 text-center font-semibold">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      IntraClaw
                    </span>
                  </th>
                  <th className="py-4 px-4 text-center font-medium text-white/60">OpenClaw</th>
                  <th className="py-4 px-4 text-center font-medium text-white/60">HermesAgent</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5 last:border-0">
                    <td className="py-4 px-6 text-white/80">{row.feature}</td>
                    <td className="py-4 px-4 text-center bg-gradient-to-b from-purple-500/[0.04] to-pink-500/[0.04]">
                      <CellView v={row.intra} />
                    </td>
                    <td className="py-4 px-4 text-center"><CellView v={row.open} /></td>
                    <td className="py-4 px-4 text-center"><CellView v={row.hermes} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  PRICING  ───────────────────────── */
const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    cta: 'Start free',
    href: '/auth/login',
    highlight: false,
    features: [
      '1 user, 1 workspace',
      '100 agent actions / month',
      'Email + Telegram channels',
      'Self-host or hosted',
      'Community Discord',
    ],
  },
  {
    name: 'Pro',
    price: '15',
    period: '/ month',
    cta: 'Start Pro',
    href: '/auth/login',
    highlight: true,
    features: [
      'Unlimited actions',
      'All channels (voice, Slack, web)',
      'Self-improvement loop ON',
      'Skills marketplace access',
      'Private memory + 2FA',
      'Email support',
    ],
  },
  {
    name: 'Agency',
    price: '49',
    period: '/ month',
    cta: 'Start Agency',
    href: '/auth/login',
    highlight: false,
    features: [
      'Everything in Pro',
      'Up to 10 client workspaces',
      'White-label dashboard',
      'Audit log + SSO/SAML',
      'Priority support',
      'Publish skills for revenue share',
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block text-xs text-pink-400 font-semibold tracking-wider uppercase mb-4">
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-3">Pay for outcomes, not seats</h2>
          <p className="text-white/60">Cancel anytime · 14-day Pro trial · Free plan never expires</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative p-8 rounded-2xl border transition-all ${
                p.highlight
                  ? 'border-pink-500/50 bg-gradient-to-b from-purple-500/10 to-pink-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold">{p.price}€</span>
                <span className="text-white/50 text-sm">{p.period}</span>
              </div>
              <Link
                href={p.href}
                className={`block text-center py-2.5 rounded-lg text-sm font-medium mb-6 transition-all ${
                  p.highlight
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-pink-500/30'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {p.cta}
              </Link>
              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  WAITLIST  ───────────────────────── */
function SocialWaitlist() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState<string>('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed');
      }
      setState('ok');
      setEmail('');
    } catch (err) {
      setState('err');
      setErrMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        {/* social proof placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 opacity-60">
          {['Indie Hacker', 'TechCrunch', 'Product Hunt', 'Hacker News'].map((n) => (
            <div key={n} className="text-center text-white/40 text-sm font-medium tracking-wider">
              {n}
            </div>
          ))}
        </div>

        <div className="relative rounded-3xl p-10 md:p-14 text-center overflow-hidden border border-white/10 bg-white/[0.02]">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-50"
            style={{
              background:
                'radial-gradient(80% 60% at 50% 0%, rgba(168,85,247,0.25), transparent 70%)',
            }}
          />
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Join the waitlist for{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              v2 features
            </span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">
            Be the first to try the new self-evolution engine, voice JARVIS, and the
            agency white-label suite.
          </p>
          <form
            onSubmit={onSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-sm placeholder:text-white/30"
              disabled={state === 'loading' || state === 'ok'}
            />
            <button
              type="submit"
              disabled={state === 'loading' || state === 'ok'}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-medium hover:shadow-lg hover:shadow-pink-500/30 transition-all disabled:opacity-50"
            >
              {state === 'loading' ? '...' : state === 'ok' ? 'You\'re in ✓' : 'Notify me'}
            </button>
          </form>
          {state === 'err' && (
            <p className="mt-3 text-xs text-red-400">{errMsg || 'Something went wrong'}</p>
          )}
          {state === 'ok' && (
            <p className="mt-3 text-xs text-emerald-400">Thanks — we&apos;ll be in touch.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  FOOTER  ───────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-12">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-3">
            <span className="text-2xl">🐾</span>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              IntraClaw
            </span>
          </Link>
          <p className="text-sm text-white/50 max-w-xs">
            The self-improving autonomous AI agent. Built in Brussels.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Product</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="#features" className="hover:text-white">Features</a></li>
            <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
            <li><a href="#compare" className="hover:text-white">Compare</a></li>
            <li><Link href="/auth/login" className="hover:text-white">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="#" className="hover:text-white">About</a></li>
            <li><a href="#" className="hover:text-white">Privacy</a></li>
            <li><a href="#" className="hover:text-white">Terms</a></li>
            <li><a href="https://github.com" className="hover:text-white">GitHub</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
        <span>© {new Date().getFullYear()} IntraClaw. MIT-licensed core.</span>
        <span>Made with claws 🐾 in Brussels</span>
      </div>
    </footer>
  );
}

/* ─────────────────────────  PAGE  ───────────────────────── */
export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Ouroboros />
      <Features />
      <Comparison />
      <Pricing />
      <SocialWaitlist />
      <Footer />
    </>
  );
}
