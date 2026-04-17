"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { posthog } from "@/app/providers";

type Role = "Veterinarian (DVM)" | "Practice manager" | "Clinic owner" | "Technician" | "Other";
type ClinicSize = "1 vet" | "2–4 vets" | "5–10 vets" | "10+ vets";
type Pims = "Cornerstone" | "ezyVet" | "AVImark" | "Provet Cloud" | "Other" | "None";

interface FormState {
  email: string;
  name: string;
  clinic: string;
  role: Role | "";
  size: ClinicSize | "";
  pims: Pims | "";
  state: string;
  interview: "yes" | "maybe" | "no" | "";
}

const initial: FormState = {
  email: "",
  name: "",
  clinic: "",
  role: "",
  size: "",
  pims: "",
  state: "",
  interview: "",
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","Outside US",
] as const;

export function Waitlist() {
  const [values, setValues] = useState<FormState>(initial);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const update =
    <K extends keyof FormState>(key: K) =>
    (v: FormState[K]): void =>
      setValues((prev) => ({ ...prev, [key]: v }));

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong — try again or email hello@vettiers.com");
      }
      setStatus("success");
      posthog?.capture?.("waitlist_submit", {
        role: values.role,
        size: values.size,
        pims: values.pims,
        state: values.state,
        interview: values.interview,
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (status === "success") {
    return (
      <section id="waitlist" className="py-24 md:py-32 border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand)]/40">
            <Check className="h-6 w-6 text-[var(--color-brand)]" />
          </div>
          <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            You&apos;re on the list.
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] leading-relaxed">
            We&apos;ll email you before launch with your founding price locked in. If you checked &quot;willing to interview,&quot; expect a short note from Ayman this week.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="waitlist" className="py-24 md:py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">Founding clinic waitlist</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            Be one of the first 50 clinics.
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)]">Takes 45 seconds. No credit card, no obligation.</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8"
          noValidate
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Work email" required>
              <input
                type="email"
                required
                autoComplete="email"
                value={values.email}
                onChange={(e) => update("email")(e.target.value)}
                className={inputStyles}
                placeholder="you@clinic.com"
              />
            </Field>
            <Field label="Full name" required>
              <input
                type="text"
                required
                autoComplete="name"
                value={values.name}
                onChange={(e) => update("name")(e.target.value)}
                className={inputStyles}
                placeholder="Dr. Jane Chen"
              />
            </Field>
          </div>

          <Field label="Clinic name" required>
            <input
              type="text"
              required
              value={values.clinic}
              onChange={(e) => update("clinic")(e.target.value)}
              className={inputStyles}
              placeholder="Acme Veterinary Hospital"
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Your role" required>
              <select
                required
                value={values.role}
                onChange={(e) => update("role")(e.target.value as Role)}
                className={inputStyles}
              >
                <option value="" disabled>Select…</option>
                <option>Veterinarian (DVM)</option>
                <option>Practice manager</option>
                <option>Clinic owner</option>
                <option>Technician</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Clinic size" required>
              <select
                required
                value={values.size}
                onChange={(e) => update("size")(e.target.value as ClinicSize)}
                className={inputStyles}
              >
                <option value="" disabled>Select…</option>
                <option>1 vet</option>
                <option>2–4 vets</option>
                <option>5–10 vets</option>
                <option>10+ vets</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Current PIMS" required>
              <select
                required
                value={values.pims}
                onChange={(e) => update("pims")(e.target.value as Pims)}
                className={inputStyles}
              >
                <option value="" disabled>Select…</option>
                <option>Cornerstone</option>
                <option>ezyVet</option>
                <option>AVImark</option>
                <option>Provet Cloud</option>
                <option>Other</option>
                <option>None</option>
              </select>
            </Field>
            <Field label="State / region" required>
              <select
                required
                value={values.state}
                onChange={(e) => update("state")(e.target.value)}
                className={inputStyles}
              >
                <option value="" disabled>Select…</option>
                {US_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-[var(--color-text)]">
              Willing to do a 20-min interview with the founder?
            </legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {(["yes", "maybe", "no"] as const).map((v) => (
                <label
                  key={v}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${
                    values.interview === v
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-text)]"
                      : "border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:border-[var(--color-brand)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="interview"
                    value={v}
                    checked={values.interview === v}
                    onChange={() => update("interview")(v)}
                    className="sr-only"
                    required
                  />
                  {v === "yes" ? "Yes, happy to" : v === "maybe" ? "Maybe — send details" : "Not right now"}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
            {status === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Claim my spot"
            )}
          </Button>

          <p className="text-xs text-[var(--color-text-dim)] text-center">
            By submitting, you agree to our{" "}
            <a href="/privacy" className="underline hover:text-[var(--color-brand)]">Privacy Policy</a>{" "}
            and{" "}
            <a href="/terms" className="underline hover:text-[var(--color-brand)]">Terms</a>.
          </p>
        </form>
      </div>
    </section>
  );
}

const inputStyles =
  "w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ring)] transition-colors appearance-none";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--color-text)]">
        {label} {required && <span className="text-[var(--color-brand)]">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
