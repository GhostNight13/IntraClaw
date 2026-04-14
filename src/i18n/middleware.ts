import { Request, Response, NextFunction } from 'express';
import { setLanguage } from './index';
import { findUserById } from '../users/user-store';

export async function i18nMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check user locale from JWT/API-Key context if available
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) {
    const user = findUserById(userId);
    if (user?.locale) {
      setLanguage(user.locale);
    }
  } else {
    // Fallback to Accept-Language header
    const acceptLang = req.headers['accept-language'];
    if (acceptLang) {
      const lang = acceptLang.split(',')[0].split('-')[0].toLowerCase();
      const supported = ['en', 'fr', 'nl', 'es', 'de', 'ar', 'pt', 'it', 'zh', 'ja'];
      if (supported.includes(lang)) setLanguage(lang);
    }
  }
  next();
}
