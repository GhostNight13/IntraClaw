/**
 * INTRACLAW — TOTP Two-Factor Authentication
 * Uses otplib for TOTP generation and verification
 */
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { getDb } from '../db';
import { logger } from '../utils/logger';

export interface TOTPSetup {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface TOTPStatus {
  enabled: boolean;
  hasSecret: boolean;
}

export function generateTOTPSecret(): string {
  return authenticator.generateSecret(20);
}

export async function generateQRCodeDataUrl(secret: string, email: string): Promise<string> {
  const otpauth = authenticator.keyuri(email, 'IntraClaw', secret);
  return QRCode.toDataURL(otpauth);
}

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export async function setup2FA(userId: string, email: string): Promise<TOTPSetup> {
  const secret = generateTOTPSecret();
  const backupCodes = generateBackupCodes();
  const qrCodeDataUrl = await generateQRCodeDataUrl(secret, email);

  const db = getDb();
  db.prepare(`
    INSERT INTO user_2fa (user_id, totp_secret, totp_enabled, backup_codes)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(user_id) DO UPDATE SET totp_secret = excluded.totp_secret, totp_enabled = 0, backup_codes = excluded.backup_codes
  `).run(userId, secret, JSON.stringify(backupCodes));

  logger.info('2FA', `Setup initiated for user ${userId}`);
  return { secret, qrCodeDataUrl, backupCodes };
}

export function verify2FASetup(userId: string, token: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT totp_secret FROM user_2fa WHERE user_id = ?').get(userId) as { totp_secret: string } | undefined;
  if (!row) return false;

  const valid = verifyTOTP(token, row.totp_secret);
  if (valid) {
    db.prepare('UPDATE user_2fa SET totp_enabled = 1 WHERE user_id = ?').run(userId);
    logger.info('2FA', `Enabled for user ${userId}`);
  }
  return valid;
}

export function verifyUserTOTP(userId: string, token: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT totp_secret, totp_enabled, backup_codes FROM user_2fa WHERE user_id = ?').get(userId) as { totp_secret: string; totp_enabled: number; backup_codes: string } | undefined;
  if (!row || !row.totp_enabled) return true; // 2FA not enabled = pass

  // Check TOTP token
  if (verifyTOTP(token, row.totp_secret)) return true;

  // Check backup codes
  const codes: string[] = JSON.parse(row.backup_codes || '[]');
  const codeIndex = codes.indexOf(token.toUpperCase());
  if (codeIndex !== -1) {
    // Consume backup code (one-time use)
    codes.splice(codeIndex, 1);
    db.prepare('UPDATE user_2fa SET backup_codes = ? WHERE user_id = ?').run(JSON.stringify(codes), userId);
    logger.info('2FA', `Backup code used by ${userId}`);
    return true;
  }

  return false;
}

export function disable2FA(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE user_2fa SET totp_enabled = 0 WHERE user_id = ?').run(userId);
  logger.info('2FA', `Disabled for user ${userId}`);
}

export function get2FAStatus(userId: string): TOTPStatus {
  const db = getDb();
  const row = db.prepare('SELECT totp_enabled FROM user_2fa WHERE user_id = ?').get(userId) as { totp_enabled: number } | undefined;
  return { enabled: !!(row?.totp_enabled), hasSecret: !!row };
}
