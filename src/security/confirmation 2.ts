// src/security/confirmation.ts
// Human-in-the-loop confirmation for dangerous agent actions.
//
// When universal-executor is about to run a `terminal` or `file_write` step,
// it asks via this module. The channel layer (telegram.ts, discord.ts…)
// renders the prompt, the user replies /yes <code> or /no, and this module
// resolves the pending promise. Timeout defaults to 60s → DENY.
//
// Turned on by default in dev; can be disabled globally via
// CONFIRMATION_ENABLED=false. Disable specific actions via
// CONFIRMATION_SKIP="terminal,file_write".
import { randomInt } from 'crypto';
import { logger } from '../utils/logger';

export type ConfirmationKind = 'terminal' | 'file_write' | 'shell_exec' | 'evolve';

export interface PendingConfirmation {
  id: string;
  code: string;
  kind: ConfirmationKind;
  description: string;
  details: string;
  createdAt: number;
  expiresAt: number;
  resolve: (approved: boolean) => void;
}

const TIMEOUT_MS = 60_000;
const MAX_PENDING = 16;

const pending = new Map<string, PendingConfirmation>();

// ─── Config ─────────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return (process.env.CONFIRMATION_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function shouldSkip(kind: ConfirmationKind): boolean {
  const skip = (process.env.CONFIRMATION_SKIP ?? '').split(',').map(s => s.trim());
  return skip.includes(kind);
}

// ─── Notifier — set by the channel layer ────────────────────────────────────

export type Notifier = (message: string) => Promise<void> | void;
let notifier: Notifier | null = null;

export function setConfirmationNotifier(fn: Notifier): void {
  notifier = fn;
}

// ─── Main API ───────────────────────────────────────────────────────────────

export async function requestConfirmation(
  kind: ConfirmationKind,
  description: string,
  details: string,
): Promise<boolean> {
  if (!isEnabled() || shouldSkip(kind)) {
    return true; // auto-approve when disabled
  }
  if (!notifier) {
    // No notifier registered (e.g. API-only mode) → fail-close: deny.
    logger.warn('Confirmation', `No notifier registered — denying "${kind}" action`);
    return false;
  }

  // Prevent memory leak / DoS if caller never resolves
  if (pending.size >= MAX_PENDING) {
    logger.warn('Confirmation', `Too many pending (${pending.size}) — denying`);
    return false;
  }

  const id = randomInt(0, 1_000_000_000).toString(36);
  const code = randomInt(100_000, 999_999).toString(); // 6-digit

  return new Promise<boolean>(resolve => {
    const entry: PendingConfirmation = {
      id, code, kind, description, details,
      createdAt: Date.now(),
      expiresAt: Date.now() + TIMEOUT_MS,
      resolve,
    };
    pending.set(id, entry);

    // Render prompt — locale-aware. Keeps the channel layer dumb.
    const lang = (process.env.USER_LANGUAGE ?? 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    const prompt = lang === 'fr'
      ? `⚠️ *Confirmation requise*\n\nType : \`${kind}\`\nAction : ${description}\n\n\`\`\`\n${details.slice(0, 500)}\n\`\`\`\n\nApprouver : \`/yes ${code}\`\nRefuser  : \`/no ${code}\`\n\nExpire dans 60s.`
      : `⚠️ *Confirmation required*\n\nType: \`${kind}\`\nAction: ${description}\n\n\`\`\`\n${details.slice(0, 500)}\n\`\`\`\n\nApprove: \`/yes ${code}\`\nReject:  \`/no ${code}\`\n\nExpires in 60s.`;

    Promise.resolve(notifier!(prompt)).catch(err => {
      logger.warn('Confirmation', 'Notifier failed', err instanceof Error ? err.message : err);
    });

    // Timeout
    setTimeout(() => {
      const still = pending.get(id);
      if (still) {
        pending.delete(id);
        logger.info('Confirmation', `Timed out: ${kind} "${description.slice(0, 60)}"`);
        resolve(false);
      }
    }, TIMEOUT_MS);
  });
}

// ─── Channel layer calls these on /yes <code> or /no <code> ────────────────

export function approveByCode(code: string): { ok: boolean; message: string } {
  for (const [id, entry] of pending.entries()) {
    if (entry.code === code) {
      pending.delete(id);
      entry.resolve(true);
      return { ok: true, message: `✅ Action "${entry.kind}" approuvée.` };
    }
  }
  return { ok: false, message: `❌ Code inconnu ou expiré.` };
}

export function rejectByCode(code: string): { ok: boolean; message: string } {
  for (const [id, entry] of pending.entries()) {
    if (entry.code === code) {
      pending.delete(id);
      entry.resolve(false);
      return { ok: true, message: `🚫 Action "${entry.kind}" refusée.` };
    }
  }
  return { ok: false, message: `❌ Code inconnu ou expiré.` };
}

export function listPending(): Array<Pick<PendingConfirmation, 'id' | 'code' | 'kind' | 'description' | 'expiresAt'>> {
  return Array.from(pending.values()).map(p => ({
    id: p.id, code: p.code, kind: p.kind, description: p.description, expiresAt: p.expiresAt,
  }));
}
