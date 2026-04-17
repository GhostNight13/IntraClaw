'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Lang = 'fr' | 'en' | 'es';
type BusinessType = 'agency' | 'solo' | 'creator' | 'other';

interface ChannelsState {
  telegram: { enabled: boolean; chatId: string };
  email: { enabled: boolean; gmailConnected: boolean };
  voice: { enabled: boolean };
  web: { enabled: boolean };
}

interface ToolsState {
  notion: boolean;
  calendar: boolean;
  weather: boolean;
  stripe: boolean;
}

const STEP_TITLES = ['Identity', 'Business', 'Channels', 'Tools', 'Ouroboros'];

export default function OnboardingPage() {
  const router = useRouter();

  // List of timezones — Intl.supportedValuesOf when available, with fallback.
  const timezones = useMemo<string[]>(() => {
    type IntlWithTZ = typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    const intl = Intl as IntlWithTZ;
    if (typeof intl.supportedValuesOf === 'function') {
      try { return intl.supportedValuesOf('timeZone'); } catch { /* fallthrough */ }
    }
    return ['UTC', 'Europe/Brussels', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
  }, []);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState<Lang>('fr');
  const [timezone, setTimezone] = useState('Europe/Brussels');

  // Step 2
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('agency');
  const [defaultStrategy, setDefaultStrategy] = useState('');

  // Step 3
  const [channels, setChannels] = useState<ChannelsState>({
    telegram: { enabled: false, chatId: '' },
    email: { enabled: false, gmailConnected: false },
    voice: { enabled: false },
    web: { enabled: true },
  });

  // Step 4
  const [tools, setTools] = useState<ToolsState>({
    notion: true,
    calendar: true,
    weather: true,
    stripe: false,
  });

  // Step 5
  const [intervalMin, setIntervalMin] = useState(15);

  function next() {
    setError(null);
    if (step === 0 && (!firstName.trim() || !fullName.trim())) {
      setError('First name and full name are required.');
      return;
    }
    if (step === 1 && !businessName.trim()) {
      setError('Business name is required.');
      return;
    }
    setStep(s => Math.min(s + 1, STEP_TITLES.length - 1));
  }

  function back() {
    setError(null);
    setStep(s => Math.max(s - 1, 0));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const profile = {
        firstName, fullName, language, timezone,
        businessName, businessType, defaultStrategy,
        channels, tools,
        loopIntervalMs: intervalMin * 60_000,
      };
      const r1 = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!r1.ok) throw new Error(`Profile save failed (${r1.status})`);

      const r2 = await fetch('/api/loop/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: intervalMin * 60_000 }),
      });
      if (!r2.ok) throw new Error(`Loop start failed (${r2.status})`);

      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const progress = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-[#0a0612] via-[#1a0a2e] to-[#2a0a3a]">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
            🐾
          </div>
          <div>
            <div className="text-xl font-semibold text-white">IntraClaw</div>
            <div className="text-xs text-purple-200/70">Set up your autonomous agent</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2 flex items-center justify-between text-xs text-purple-200/70">
          <span>Step {step + 1} of {STEP_TITLES.length} — {STEP_TITLES[step]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl">
          {step === 0 && (
            <Section title="Tell us who you are" subtitle="Basic identity for your agent.">
              <Field label="First name">
                <Input value={firstName} onChange={setFirstName} placeholder="Ayman" />
              </Field>
              <Field label="Full name">
                <Input value={fullName} onChange={setFullName} placeholder="Ayman Idamre" />
              </Field>
              <Field label="Language">
                <Select value={language} onChange={v => setLanguage(v as Lang)}
                        options={[['fr','Français'],['en','English'],['es','Español']]} />
              </Field>
              <Field label="Timezone">
                <Select value={timezone} onChange={setTimezone}
                        options={timezones.map(tz => [tz, tz] as [string, string])} />
              </Field>
            </Section>
          )}

          {step === 1 && (
            <Section title="Your business" subtitle="What should the agent focus on?">
              <Field label="Business name">
                <Input value={businessName} onChange={setBusinessName} placeholder="HaiSkills" />
              </Field>
              <Field label="Type">
                <div className="grid grid-cols-2 gap-2">
                  {(['agency','solo','creator','other'] as BusinessType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBusinessType(t)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all capitalize ${
                        businessType === t
                          ? 'border-purple-400 bg-purple-500/20 text-white'
                          : 'border-white/10 bg-white/[0.02] text-purple-200/70 hover:border-white/20'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Default strategy" hint="What should the agent prioritize? (free text)">
                <textarea
                  value={defaultStrategy}
                  onChange={e => setDefaultStrategy(e.target.value)}
                  rows={4}
                  placeholder="Find local SMBs without websites in Brussels and qualify them..."
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400 transition-colors resize-none"
                />
              </Field>
            </Section>
          )}

          {step === 2 && (
            <Section title="Channels" subtitle="How does your agent communicate with you and the world?">
              <ChannelToggle
                label="Telegram"
                desc="Push notifications and chat with your agent"
                enabled={channels.telegram.enabled}
                onToggle={v => setChannels(c => ({ ...c, telegram: { ...c.telegram, enabled: v } }))}
              >
                {channels.telegram.enabled && (
                  <Input
                    value={channels.telegram.chatId}
                    onChange={v => setChannels(c => ({ ...c, telegram: { ...c.telegram, chatId: v } }))}
                    placeholder="Telegram chat ID (e.g. 123456789)"
                  />
                )}
              </ChannelToggle>

              <ChannelToggle
                label="Email"
                desc="Triage, draft and send emails on your behalf"
                enabled={channels.email.enabled}
                onToggle={v => setChannels(c => ({ ...c, email: { ...c.email, enabled: v } }))}
              >
                {channels.email.enabled && (
                  <button
                    type="button"
                    onClick={() => setChannels(c => ({ ...c, email: { ...c.email, gmailConnected: true } }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:border-purple-400 hover:bg-purple-500/10 transition-all"
                  >
                    {channels.email.gmailConnected ? 'Gmail connected (placeholder)' : 'Connect Gmail'}
                  </button>
                )}
              </ChannelToggle>

              <ChannelToggle
                label="Voice"
                desc="Talk to your agent — STT/TTS pipeline"
                enabled={channels.voice.enabled}
                onToggle={v => setChannels(c => ({ ...c, voice: { enabled: v } }))}
              />

              <ChannelToggle
                label="Web"
                desc="The dashboard you're using right now"
                enabled={channels.web.enabled}
                onToggle={v => setChannels(c => ({ ...c, web: { enabled: v } }))}
              />
            </Section>
          )}

          {step === 3 && (
            <Section title="Tools" subtitle="External integrations your agent can call.">
              <ToolToggle label="Notion" desc="CRM, content calendar, knowledge base"
                          enabled={tools.notion} onToggle={v => setTools(t => ({ ...t, notion: v }))} />
              <ToolToggle label="Calendar" desc="Google Calendar — events, free slots, agenda"
                          enabled={tools.calendar} onToggle={v => setTools(t => ({ ...t, calendar: v }))} />
              <ToolToggle label="Weather" desc="Forecasts and location-aware suggestions"
                          enabled={tools.weather} onToggle={v => setTools(t => ({ ...t, weather: v }))} />
              <ToolToggle label="Stripe" desc="Payments, invoices, subscriptions"
                          enabled={tools.stripe} onToggle={() => { /* locked */ }}
                          locked badge="Pro" />
            </Section>
          )}

          {step === 4 && (
            <Section title="Start the Ouroboros loop" subtitle="The autonomous cycle that powers your agent.">
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-5 mb-5">
                <p className="text-sm text-purple-100 leading-relaxed">
                  Every interval, your agent runs a complete cycle:
                </p>
                <ol className="mt-3 space-y-1.5 text-sm text-purple-100/90">
                  <li><span className="text-purple-300">1.</span> <b>Perceive</b> — observe inboxes, calendar, KPIs</li>
                  <li><span className="text-purple-300">2.</span> <b>Think</b> — reason about what matters now</li>
                  <li><span className="text-purple-300">3.</span> <b>Act</b> — execute tasks via tools and channels</li>
                  <li><span className="text-purple-300">4.</span> <b>Observe</b> — measure outcomes and feedback</li>
                  <li><span className="text-purple-300">5.</span> <b>Self-improve</b> — refine strategy for next iteration</li>
                </ol>
              </div>

              <Field label={`Interval — every ${intervalMin} minute${intervalMin > 1 ? 's' : ''}`}
                     hint="How often the loop should tick. Faster = more responsive, more cost.">
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={intervalMin}
                  onChange={e => setIntervalMin(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-purple-200/50 mt-1">
                  <span>5 min</span><span>30 min</span><span>1 hour</span>
                </div>
              </Field>
            </Section>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || submitting}
              className="px-5 py-2.5 rounded-lg text-sm text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >← Back</button>

            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-medium text-white shadow-lg shadow-purple-500/30 hover:from-purple-400 hover:to-pink-400 transition-all"
              >Next →</button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-medium text-white shadow-lg shadow-purple-500/30 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 transition-all"
              >{submitting ? 'Starting…' : 'Start my agent'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-purple-200/60 mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-4 pt-2">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/90 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-purple-200/50 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400 transition-colors"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 transition-colors"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-[#1a0a2e] text-white">{l}</option>
      ))}
    </select>
  );
}

function ChannelToggle({ label, desc, enabled, onToggle, children }: {
  label: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      enabled ? 'border-purple-400/50 bg-purple-500/5' : 'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-xs text-purple-200/60 mt-0.5">{desc}</div>
        </div>
        <Switch checked={enabled} onChange={onToggle} />
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function ToolToggle({ label, desc, enabled, onToggle, locked, badge }: {
  label: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void;
  locked?: boolean; badge?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-all ${
      enabled ? 'border-purple-400/50 bg-purple-500/5' : 'border-white/10 bg-white/[0.02]'
    } ${locked ? 'opacity-70' : ''}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{label}</span>
          {badge && (
            <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-pink-400 text-black">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-purple-200/60 mt-0.5">{desc}</div>
      </div>
      <Switch checked={enabled} onChange={onToggle} disabled={locked} />
    </div>
  );
}

function Switch({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
        checked ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
