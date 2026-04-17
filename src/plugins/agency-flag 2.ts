// src/plugins/agency-flag.ts
// Single source of truth for the agency plugin toggle.
// See plugins/agency/README.md for scope.

export function isAgencyEnabled(): boolean {
  // Default: false (opt-in). The agency plugin is only useful to freelancers
  // running prospection + cold-email agents. Set ENABLE_AGENCY_AGENTS=true
  // to expose /prospect, /email, and the CRM intents.
  const v = (process.env.ENABLE_AGENCY_AGENTS ?? 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
