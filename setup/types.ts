export interface WizardAnswers {
  // AI
  ANTHROPIC_API_KEY: string;

  // Channels
  ENABLE_TELEGRAM: boolean;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ENABLE_WHATSAPP: boolean;
  ENABLE_DISCORD: boolean;
  DISCORD_TOKEN?: string;
  ENABLE_SLACK: boolean;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_APP_TOKEN?: string;

  // Integrations
  ENABLE_GMAIL: boolean;
  ENABLE_GOOGLE_CALENDAR: boolean;
  ENABLE_NOTION: boolean;
  NOTION_TOKEN?: string;

  // User profile
  USER_NAME: string;
  USER_TIMEZONE: string;
  USER_LANGUAGE: 'fr' | 'en' | 'nl' | 'es';

  // Security
  DB_PASSWORD: string;
  REDIS_PASSWORD: string;
  JWT_SECRET: string;
}
