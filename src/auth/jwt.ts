/**
 * INTRACLAW — JWT Token Management
 */
import jwt from 'jsonwebtoken';

const SECRET     = process.env.JWT_SECRET || 'intraclaw-default-secret-change-me';
const EXPIRES_IN = '7d';
const REFRESH_EXPIRES_IN = '30d';

export interface JWTPayload {
  userId: string;
  email:  string;
  role:   string;
  plan:   string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function signRefreshToken(payload: Pick<JWTPayload, 'userId'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
