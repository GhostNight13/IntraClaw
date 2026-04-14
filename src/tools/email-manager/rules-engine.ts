/**
 * INTRACLAW — Email Rules Engine
 * Règles custom pour le triage automatique
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { EmailRule, EmailCategory, SuggestedAction } from './types';

const RULES_FILE = path.join(process.cwd(), 'data', 'email-rules.json');

function loadRules(): EmailRule[] {
  if (!fs.existsSync(RULES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveRules(rules: EmailRule[]): void {
  const dir = path.dirname(RULES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
}

export function getRules(): EmailRule[] {
  return loadRules();
}

export function addRule(rule: Omit<EmailRule, 'id'>): EmailRule {
  const rules = loadRules();
  const newRule: EmailRule = { ...rule, id: crypto.randomUUID() };
  rules.push(newRule);
  saveRules(rules);
  return newRule;
}

export function deleteRule(id: string): boolean {
  const rules = loadRules();
  const filtered = rules.filter(r => r.id !== id);
  if (filtered.length === rules.length) return false;
  saveRules(filtered);
  return true;
}

export function toggleRule(id: string): boolean {
  const rules = loadRules();
  const rule = rules.find(r => r.id === id);
  if (!rule) return false;
  rule.enabled = !rule.enabled;
  saveRules(rules);
  return true;
}

/**
 * Applique les règles à un email, retourne la première qui match
 */
export function matchRule(email: { from: string; subject: string; body: string }):
  { category: EmailCategory; action: SuggestedAction } | null {

  const rules = loadRules().filter(r => r.enabled);

  for (const rule of rules) {
    const fieldValue = email[rule.condition.field] || '';
    let match = false;

    switch (rule.condition.operator) {
      case 'contains':
        match = fieldValue.toLowerCase().includes(rule.condition.value.toLowerCase());
        break;
      case 'equals':
        match = fieldValue.toLowerCase() === rule.condition.value.toLowerCase();
        break;
      case 'startsWith':
        match = fieldValue.toLowerCase().startsWith(rule.condition.value.toLowerCase());
        break;
      case 'endsWith':
        match = fieldValue.toLowerCase().endsWith(rule.condition.value.toLowerCase());
        break;
      case 'regex':
        try { match = new RegExp(rule.condition.value, 'i').test(fieldValue); } catch { match = false; }
        break;
    }

    if (match) {
      return { category: rule.category, action: rule.action };
    }
  }

  return null;
}
