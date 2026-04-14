/**
 * INTRACLAW — Email Manager
 * Point d'entrée du système de gestion email
 */
export { triageEmail, triageEmails } from './triage';
export { generateEmailDigest, formatDigestForTelegram } from './digest';
export { getRules, addRule, deleteRule, toggleRule, matchRule } from './rules-engine';
export type { EmailCategory, SuggestedAction, TriageResult, EmailDigest, TriagedEmail, EmailRule } from './types';
