/**
 * INTRACLAW — User Store
 * Stockage JSON simple dans data/users.json
 * Migration vers PostgreSQL/Prisma prevue en Phase E.2
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

export type UserRole = 'admin' | 'user';
export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface User {
  id:        string;
  email:     string;
  name:      string;
  password:  string;           // bcrypt hash
  role:      UserRole;
  plan:      UserPlan;
  apiKey:    string;            // ic_xxx pour acces API
  locale:    string;            // fr, en, nl, ...
  timezone:  string;            // Europe/Brussels
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  actionsToday: number;
  lastActionDate: string;      // YYYY-MM-DD pour reset quotidien
}

// Limites par plan
export const PLAN_LIMITS: Record<UserPlan, { actionsPerDay: number; channels: number; skills: number }> = {
  free:       { actionsPerDay: 50,    channels: 2,  skills: 5  },
  pro:        { actionsPerDay: 10_000, channels: 10, skills: -1 },  // -1 = illimite
  enterprise: { actionsPerDay: -1,    channels: -1, skills: -1 },
};

function ensureFile(): User[] {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function generateApiKey(): string {
  return `ic_${crypto.randomBytes(24).toString('hex')}`;
}

// -- CRUD -----------------------------------------------------------------

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  plan?: UserPlan;
  locale?: string;
  timezone?: string;
}): Promise<Omit<User, 'password'>> {
  const users = ensureFile();

  // Email unique
  if (users.find(u => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error('Email deja utilise');
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(input.password, salt);

  const now = new Date().toISOString();
  const user: User = {
    id:            crypto.randomUUID(),
    email:         input.email.toLowerCase().trim(),
    name:          input.name.trim(),
    password:      hashedPassword,
    role:          input.role ?? 'user',
    plan:          input.plan ?? 'free',
    apiKey:        generateApiKey(),
    locale:        input.locale ?? 'fr',
    timezone:      input.timezone ?? 'Europe/Brussels',
    createdAt:     now,
    updatedAt:     now,
    actionsToday:  0,
    lastActionDate: new Date().toISOString().split('T')[0],
  };

  users.push(user);
  saveUsers(users);

  const { password: _, ...safe } = user;
  return safe;
}

export function findUserByEmail(email: string): User | undefined {
  return ensureFile().find(u => u.email === email.toLowerCase().trim());
}

export function findUserById(id: string): User | undefined {
  return ensureFile().find(u => u.id === id);
}

export function findUserByApiKey(apiKey: string): User | undefined {
  return ensureFile().find(u => u.apiKey === apiKey);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

export function updateUser(id: string, updates: Partial<Pick<User, 'name' | 'plan' | 'locale' | 'timezone' | 'role'>>): User | null {
  const users = ensureFile();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return null;

  users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return users[idx];
}

export function recordLogin(id: string): void {
  const users = ensureFile();
  const idx = users.findIndex(u => u.id === id);
  if (idx >= 0) {
    users[idx].lastLoginAt = new Date().toISOString();
    saveUsers(users);
  }
}

export function incrementActions(id: string): { allowed: boolean; remaining: number } {
  const users = ensureFile();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return { allowed: false, remaining: 0 };

  const user = users[idx];
  const today = new Date().toISOString().split('T')[0];

  // Reset si nouveau jour
  if (user.lastActionDate !== today) {
    user.actionsToday = 0;
    user.lastActionDate = today;
  }

  const limit = PLAN_LIMITS[user.plan].actionsPerDay;
  if (limit !== -1 && user.actionsToday >= limit) {
    return { allowed: false, remaining: 0 };
  }

  user.actionsToday++;
  saveUsers(users);

  const remaining = limit === -1 ? Infinity : limit - user.actionsToday;
  return { allowed: true, remaining };
}

export function listUsers(): Omit<User, 'password'>[] {
  return ensureFile().map(({ password, ...u }) => u);
}

export function regenerateApiKey(id: string): string | null {
  const users = ensureFile();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return null;

  users[idx].apiKey = generateApiKey();
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);
  return users[idx].apiKey;
}
