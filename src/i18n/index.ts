import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import * as path from 'path';

const DEFAULT_LNG = (process.env.USER_LANGUAGE ?? 'en').toLowerCase();

export async function initI18n(): Promise<void> {
  await i18next.use(Backend).init({
    lng: DEFAULT_LNG,
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(process.cwd(), 'src/i18n/locales/{{lng}}/{{ns}}.json'),
    },
    ns: ['common', 'errors', 'agents', 'telegram'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options as any) as string;
}

export function setLanguage(lng: string): void {
  i18next.changeLanguage(lng);
}

export function getCurrentLanguage(): string {
  return i18next.language;
}
