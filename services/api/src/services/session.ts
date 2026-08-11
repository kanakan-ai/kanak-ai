/**
 * Session service
 * M1-T2: Session token generation and validation
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../lib/db.js';
import type { Session } from '../types/auth.js';

const SESSION_DURATION_SECONDS = 86400; // 24 hours

/**
 * Generate a cryptographically secure session token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash token for database storage
 */
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verify token against hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

/**
 * Create a new session for user
 */
export async function createSession(
  userId: string,
  userAgent?: string
): Promise<{ token: string; expiresInSeconds: number }> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await query(
    `
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
    VALUES ($1, $2, $3, $4)
    `,
    [userId, tokenHash, expiresAt, userAgent || null]
  );

  return {
    token,
    expiresInSeconds: SESSION_DURATION_SECONDS,
  };
}

/**
 * Find and validate session by token
 * Returns userId if valid, null otherwise
 */
export async function validateSession(token: string): Promise<string | null> {
  // Get all non-revoked, non-expired sessions
  const result = await query<Session>(
    `
    SELECT * FROM sessions
    WHERE expires_at > NOW()
    AND revoked_at IS NULL
    ORDER BY created_at DESC
    `
  );

  // Check each session hash (bcrypt is slow, but we need to check all)
  for (const session of result.rows) {
    const isValid = await verifyToken(token, session.token_hash);
    if (isValid) {
      return session.user_id;
    }
  }

  return null;
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession(token: string): Promise<boolean> {
  const result = await query<Session>(
    `
    SELECT * FROM sessions
    WHERE expires_at > NOW()
    AND revoked_at IS NULL
    `
  );

  // Find and revoke the matching session
  for (const session of result.rows) {
    const isValid = await verifyToken(token, session.token_hash);
    if (isValid) {
      await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE id = $1`,
        [session.id]
      );
      return true;
    }
  }

  return false;
}

/**
 * Clean up expired sessions (background job)
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM sessions WHERE expires_at < NOW() RETURNING id`
  );
  return result.rowCount || 0;
}
