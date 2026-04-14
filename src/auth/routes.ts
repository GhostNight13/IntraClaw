/**
 * INTRACLAW — Auth Routes
 * POST /auth/register, /auth/login, /auth/refresh, /auth/me
 */
import { Router, Request, Response } from 'express';
import { signToken, signRefreshToken, verifyToken } from './jwt';
import { authenticate } from './middleware';
import {
  createUser, findUserByEmail, findUserById, verifyPassword, recordLogin,
  regenerateApiKey, updateUser,
} from '../users/user-store';

const router = Router();

// -- POST /auth/register ---------------------------------------------------
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, password, locale, timezone } = req.body as {
      email?: string; name?: string; password?: string; locale?: string; timezone?: string;
    };

    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, password requis' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Mot de passe : 8 caracteres minimum' });
      return;
    }

    const user = await createUser({ email, name, password, locale, timezone });

    const token        = signToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan });
    const refreshToken = signRefreshToken({ userId: user.id });

    res.status(201).json({
      user,
      token,
      refreshToken,
      apiKey: user.apiKey,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Email deja utilise') {
      res.status(409).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

// -- POST /auth/login -------------------------------------------------------
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'email et password requis' });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Identifiants incorrects' });
      return;
    }

    const valid = await verifyPassword(user, password);
    if (!valid) {
      res.status(401).json({ error: 'Identifiants incorrects' });
      return;
    }

    recordLogin(user.id);

    const token        = signToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan });
    const refreshToken = signRefreshToken({ userId: user.id });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token, refreshToken });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// -- POST /auth/refresh -----------------------------------------------------
router.post('/refresh', (req: Request, res: Response): void => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken requis' });
      return;
    }

    const payload = verifyToken(refreshToken);
    const user    = findUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable' });
      return;
    }

    const token        = signToken({ userId: user.id, email: user.email, role: user.role, plan: user.plan });
    const newRefresh   = signRefreshToken({ userId: user.id });

    res.json({ token, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Refresh token invalide ou expire' });
  }
});

// -- GET /auth/me -----------------------------------------------------------
router.get('/me', authenticate, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

// -- PATCH /auth/me ---------------------------------------------------------
router.patch('/me', authenticate, (req: Request, res: Response): void => {
  const { name, locale, timezone } = req.body as {
    name?: string; locale?: string; timezone?: string;
  };
  const updates: Record<string, string> = {};
  if (name)     updates.name     = name;
  if (locale)   updates.locale   = locale;
  if (timezone) updates.timezone = timezone;

  const updated = updateUser(req.user!.id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const { password: _, ...safe } = updated;
  res.json({ user: safe });
});

// -- POST /auth/regenerate-api-key ------------------------------------------
router.post('/regenerate-api-key', authenticate, (req: Request, res: Response): void => {
  const newKey = regenerateApiKey(req.user!.id);
  if (!newKey) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ apiKey: newKey });
});

export { router as authRouter };
