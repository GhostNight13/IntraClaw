/**
 * UserProfile — Central user configuration object.
 * Loaded once at startup from environment variables.
 * Passed through the entire Ouroboros loop instead of hardcoded strings.
 */

export interface UserProfile {
  // Identity
  fullName: string;
  firstName: string;
  jobTitle: string;

  // Business
  businessName: string;
  businessEmail: string;
  businessWebsite: string;
  portfolioUrl: string;
  sideProjectName?: string;
  sideProjectUrl?: string;

  // Location
  timezone: string;
  city: string;
  country: string;
  language: 'fr' | 'en' | 'nl' | string;

  // Strategy defaults (can be overridden by strategy-evolver)
  defaultStrategy: {
    sectors: string[];
    regions: string[];
    language: string;
    weeklyGoal: string;
    priorityAction: string;
  };

  // Content
  linkedinTopics: string[];
  brandMentions: string[];

  // Integrations (runtime, loaded from env)
  notion: {
    dbCrm: string;
    dbContent: string;
    dbClients: string;
  };

  // Email signature builder
  emailSignature: (locale: 'fr' | 'nl' | 'en') => string;
  gdprText: (locale: 'fr' | 'nl' | 'en') => string;
}

/**
 * Load UserProfile from environment variables.
 * Call once at startup. Throws if required vars missing.
 */
export function loadUserProfile(): UserProfile {
  const optional = (key: string, fallback = ''): string =>
    process.env[key] ?? fallback;

  const fullName = optional('OWNER_NAME', 'Agent User');
  const firstName = optional('OWNER_FIRST_NAME', fullName.split(' ')[0]);
  const businessName = optional('BUSINESS_NAME', 'My Business');
  const businessEmail = optional('BUSINESS_EMAIL', '');
  const businessWebsite = optional('BUSINESS_WEBSITE', '');
  const portfolioUrl = optional('PORTFOLIO_URL', businessWebsite);
  const jobTitle = optional('JOB_TITLE', 'Professional');

  const sectors = optional('STRATEGY_DEFAULT_SECTORS', 'retail,services')
    .split(',').map(s => s.trim()).filter(Boolean);
  const regions = optional('STRATEGY_DEFAULT_REGIONS', 'Local')
    .split(',').map(s => s.trim()).filter(Boolean);
  const linkedinTopics = optional('LINKEDIN_TOPICS', 'business,tech')
    .split(',').map(s => s.trim()).filter(Boolean);
  const brandMentions = optional('CONTENT_BRAND_MENTIONS', businessWebsite)
    .split(',').map(s => s.trim()).filter(Boolean);

  return {
    fullName,
    firstName,
    jobTitle,
    businessName,
    businessEmail,
    businessWebsite,
    portfolioUrl,
    sideProjectName: optional('SIDE_PROJECT_NAME') || undefined,
    sideProjectUrl: optional('SIDE_PROJECT_URL') || undefined,

    timezone: optional('USER_TIMEZONE', 'UTC'),
    city: optional('USER_CITY', 'Your City'),
    country: optional('USER_COUNTRY', 'Your Country'),
    language: optional('USER_LANGUAGE', 'en'),

    defaultStrategy: {
      sectors,
      regions,
      language: optional('STRATEGY_DEFAULT_LANGUAGE', 'en'),
      weeklyGoal: optional('STRATEGY_WEEKLY_GOAL', '10 prospects contacted'),
      priorityAction: optional('STRATEGY_PRIORITY_ACTION', 'Increase outreach volume'),
    },

    linkedinTopics,
    brandMentions,

    notion: {
      dbCrm: optional('NOTION_DB_CRM'),
      dbContent: optional('NOTION_DB_CONTENT'),
      dbClients: optional('NOTION_DB_CLIENTS'),
    },

    emailSignature: (locale) => {
      switch (locale) {
        case 'nl':
          return `${fullName}\n${jobTitle}\n${businessWebsite}${businessEmail ? ' · ' + businessEmail : ''}`;
        case 'fr':
        default:
          return `${fullName}\n${jobTitle}\n${businessWebsite}${businessEmail ? ' · ' + businessEmail : ''}`;
      }
    },

    gdprText: (locale) => {
      switch (locale) {
        case 'nl':
          return 'Wenst u geen berichten meer? Antwoord STOP.';
        case 'fr':
        default:
          return 'Si vous ne souhaitez plus recevoir nos messages, répondez STOP.';
      }
    },
  };
}

/** Singleton — loaded once at startup */
let _profile: UserProfile | null = null;

export function getUserProfile(): UserProfile {
  if (!_profile) {
    _profile = loadUserProfile();
  }
  return _profile;
}

/** For testing — reset singleton */
export function resetUserProfile(): void {
  _profile = null;
}
