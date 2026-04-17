// src/config/profile.ts
// Single source of truth for user identity. NO hardcoded personal data
// anywhere else in src/. Populated from env vars with generic defaults.
//
// When this repo is forked/cloned:
//   - Defaults produce an anonymous "IntraClaw user" persona
//   - Users customise via .env (USER_NAME, USER_EMAIL, USER_BIO, …)

export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  location: string;
  timezone: string;
  language: string;
  businessContext: string;
  signatureUrl: string;
  githubRepoOwner: string;
}

export function getProfile(): UserProfile {
  return {
    name:             process.env.USER_NAME            ?? 'IntraClaw User',
    email:            process.env.USER_EMAIL           ?? 'user@example.com',
    bio:              process.env.USER_BIO             ?? 'Developer using IntraClaw.',
    location:         process.env.USER_LOCATION        ?? '',
    timezone:         process.env.USER_TIMEZONE        ?? 'UTC',
    language:         process.env.USER_LANGUAGE        ?? 'en',
    businessContext:  process.env.USER_BUSINESS        ?? '',
    signatureUrl:     process.env.USER_WEBSITE         ?? '',
    githubRepoOwner:  process.env.GITHUB_REPO_OWNER    ?? 'intraclaw',
  };
}

// Convenience getters (shorter import sites)
export function userName():       string { return getProfile().name; }
export function userEmail():      string { return getProfile().email; }
export function userBio():        string { return getProfile().bio; }
export function userBusiness():   string { return getProfile().businessContext; }
export function userWebsite():    string { return getProfile().signatureUrl; }
export function userLocation():   string { return getProfile().location; }
export function userTimezone():   string { return getProfile().timezone; }
export function userLanguage():   string { return getProfile().language; }
export function githubRepoOwner():string { return getProfile().githubRepoOwner; }

/**
 * Composed string for LLM system prompts — describes the user identity
 * in a way prompts can inject directly. Returns empty string if no context
 * is configured (generic deployment).
 */
export function userContextPrompt(): string {
  const p = getProfile();
  const parts: string[] = [];
  if (p.name && p.name !== 'IntraClaw User') parts.push(`The user is ${p.name}`);
  if (p.bio)             parts.push(p.bio);
  if (p.businessContext) parts.push(p.businessContext);
  if (p.location)        parts.push(`Based in ${p.location}.`);
  return parts.join(' ');
}
