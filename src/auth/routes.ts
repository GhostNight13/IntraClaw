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
import { setup2FA, verify2FASetup, disable2FA, get2FAStatus } from './totp';
import { handleOAuthCallback, getLinkedAccounts, unlinkOAuthAccount, OAuthProvider } from './oauth';

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

// ─── 2FA Routes ───────────────────────────────────────────────────────────────

router.get('/2fa/status', authenticate, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  res.json(get2FAStatus(userId));
});

router.post('/2fa/setup', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const email = req.user!.email;
  try {
    const setup = await setup2FA(userId, email);
    res.json({ secret: setup.secret, qrCodeDataUrl: setup.qrCodeDataUrl, backupCodes: setup.backupCodes });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '2FA setup failed' });
  }
});

router.post('/2fa/verify', authenticate, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: 'token required' }); return; }
  const ok = verify2FASetup(userId, token);
  if (ok) res.json({ ok: true, message: '2FA enabled' });
  else res.status(401).json({ error: 'Invalid TOTP token' });
});

router.post('/2fa/disable', authenticate, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  disable2FA(userId);
  res.json({ ok: true, message: '2FA disabled' });
});

// ─── OAuth Routes ─────────────────────────────────────────────────────────────

router.get('/oauth/accounts', authenticate, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  res.json(getLinkedAccounts(userId));
});

router.delete('/oauth/:provider', authenticate, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const provider = req.params.provider as OAuthProvider;
  unlinkOAuthAccount(userId, provider);
  res.json({ ok: true });
});

// Google OAuth — requires GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET
router.get('/oauth/google', (_req: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID' }); return; }
  const redirectUri = `${process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3001'}/auth/oauth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+email+profile`;
  res.redirect(url);
});

router.get('/oauth/google/callback', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query as { code?: string };
  if (!code) { res.status(400).json({ error: 'No code' }); return; }
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
    const redirectUri = `${process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3001'}/auth/oauth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) { res.status(401).json({ error: 'Token exchange failed' }); return; }
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json() as { sub: string; email: string; name: string };
    const { token } = await handleOAuthCallback({ providerId: userInfo.sub, email: userInfo.email, name: userInfo.name, provider: 'google' });
    res.redirect(`${process.env.DASHBOARD_URL ?? 'http://localhost:3000'}?token=${token}`);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OAuth failed' });
  }
});

// GitHub OAuth — requires GITHUB_OAUTH_CLIENT_ID + GITHUB_OAUTH_CLIENT_SECRET
router.get('/oauth/github', (_req: Request, res: Response): void => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'GitHub OAuth not configured' }); return; }
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email`;
  res.redirect(url);
});

router.get('/oauth/github/callback', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query as { code?: string };
  if (!code) { res.status(400).json({ error: 'No code' }); return; }
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_OAUTH_CLIENT_ID, client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET, code }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) { res.status(401).json({ error: 'Token exchange failed' }); return; }
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github.v3+json' },
    });
    const userInfo = await userRes.json() as { id: number; email?: string; name?: string; login: string };
    const email = userInfo.email ?? `${userInfo.login}@github.noemail`;
    const { token } = await handleOAuthCallback({ providerId: String(userInfo.id), email, name: userInfo.name ?? userInfo.login, provider: 'github' });
    res.redirect(`${process.env.DASHBOARD_URL ?? 'http://localhost:3000'}?token=${token}`);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OAuth failed' });
  }
});

// Microsoft OAuth — requires MICROSOFT_OAUTH_CLIENT_ID + MICROSOFT_OAUTH_CLIENT_SECRET
router.get('/oauth/microsoft', (_req: Request, res: Response): void => {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'Microsoft OAuth not configured' }); return; }
  const redirectUri = `${process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3001'}/auth/oauth/microsoft/callback`;
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+email+profile`;
  res.redirect(url);
});

router.get('/oauth/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query as { code?: string };
  if (!code) { res.status(400).json({ error: 'No code' }); return; }
  try {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET!;
    const redirectUri = `${process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3001'}/auth/oauth/microsoft/callback`;
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) { res.status(401).json({ error: 'Token exchange failed' }); return; }
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json() as { id: string; mail?: string; displayName?: string; userPrincipalName?: string };
    const email = userInfo.mail ?? userInfo.userPrincipalName ?? `${userInfo.id}@microsoft.noemail`;
    const { token } = await handleOAuthCallback({ providerId: userInfo.id, email, name: userInfo.displayName ?? email, provider: 'microsoft' });
    res.redirect(`${process.env.DASHBOARD_URL ?? 'http://localhost:3000'}?token=${token}`);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OAuth failed' });
  }
});

export { router as authRouter };
