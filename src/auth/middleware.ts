/**
 * INTRACLAW — Auth Middleware
 * Supporte : Bearer JWT token OU API key (ic_xxx)
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from './jwt';
import { findUserById, findUserByApiKey } from '../users/user-store';
import type { User } from '../users/user-store';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password'>;
      authMethod?: 'jwt' | 'api_key';
    }
  }
}

/**
 * Middleware qui exige une authentification.
 * Accepte :
 *   Authorization: Bearer <jwt_token>
 *   Authorization: ic_<api_key>
 *   X-API-Key: ic_<api_key>
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  try {
    // 1. Bearer JWT
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      const user = findUserById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'Utilisateur introuvable' });
        return;
      }
      const { password: _, ...safeUser } = user;
      req.user = safeUser;
      req.authMethod = 'jwt';
      next();
      return;
    }

    // 2. API Key dans Authorization header
    if (authHeader.startsWith('ic_')) {
      const user = findUserByApiKey(authHeader);
      if (!user) {
        res.status(401).json({ error: 'Cle API invalide' });
        return;
      }
      const { password: _, ...safeUser } = user;
      req.user = safeUser;
      req.authMethod = 'api_key';
      next();
      return;
    }

    // 3. API Key dans X-API-Key header
    if (apiKeyHeader?.startsWith('ic_')) {
      const user = findUserByApiKey(apiKeyHeader);
      if (!user) {
        res.status(401).json({ error: 'Cle API invalide' });
        return;
      }
      const { password: _, ...safeUser } = user;
      req.user = safeUser;
      req.authMethod = 'api_key';
      next();
      return;
    }

    res.status(401).json({ error: 'Authentification requise (Bearer token ou API key)' });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expire' });
      return;
    }
    res.status(401).json({ error: 'Token invalide' });
  }
}

/**
 * Middleware optionnel : attache l'utilisateur si un token est present, sinon continue
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';

  try {
    if (authHeader.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7));
      const user = findUserById(payload.userId);
      if (user) {
        const { password: _, ...safeUser } = user;
        req.user = safeUser;
        req.authMethod = 'jwt';
      }
    } else if (authHeader.startsWith('ic_')) {
      const user = findUserByApiKey(authHeader);
      if (user) {
        const { password: _, ...safeUser } = user;
        req.user = safeUser;
        req.authMethod = 'api_key';
      }
    }
  } catch {
    // Ignore errors in optional auth
  }

  next();
}

/**
 * Middleware : verifie que l'user a le role admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acces admin requis' });
    return;
  }
  next();
}

/**
 * Middleware : verifie le plan de l'utilisateur
 */
export function requirePlan(...plans: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !plans.includes(req.user.plan)) {
      res.status(403).json({ error: `Plan ${plans.join(' ou ')} requis` });
      return;
    }
    next();
  };
}
