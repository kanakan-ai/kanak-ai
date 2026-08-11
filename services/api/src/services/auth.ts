/**
 * Auth service
 * M1-T2: Email OTP and magic link authentication
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../lib/db.js';
import { config } from '../config.js';
import type { OtpChallenge, IdentityChannel } from '../types/auth.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAGIC_LINK_EXPIRY_SECONDS = 900; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure magic link token
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash OTP code or magic token for storage
 */
export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

/**
 * Mock email delivery (M1 only - logs to console)
 */
export function sendEmailMock(email: string, code: string, isMagicLink: boolean): void {
  if (isMagicLink) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 MOCK EMAIL (AUTH_MODE=mock)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: ${email}
Subject: Sign in to Kanak AI

Click the link below to sign in:
http://localhost:3000/auth/verify?token=${code}

This link expires in 15 minutes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  } else {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 MOCK EMAIL (AUTH_MODE=mock)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: ${email}
Subject: Your Kanak AI verification code

Your verification code is: ${code}

This code expires in 5 minutes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }
}

/**
 * Start email OTP flow
 */
export async function startEmailOtp(
  email: string,
  preferMagicLink: boolean
): Promise<{ expiresInSeconds: number; devHint?: string }> {
  // Generate code (OTP or magic token)
  const code = config.auth.mode === 'mock' && !preferMagicLink
    ? '000000'
    : preferMagicLink
    ? generateMagicToken()
    : generateOtpCode();

  const codeHash = await hashCode(code);
  const expiresInSeconds = preferMagicLink ? MAGIC_LINK_EXPIRY_SECONDS : OTP_EXPIRY_SECONDS;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  // Store challenge
  await query(
    `
    INSERT INTO otp_challenges (channel, identifier, code_hash, expires_at, max_attempts)
    VALUES ($1, $2, $3, $4, $5)
    `,
    ['email', email.toLowerCase(), codeHash, expiresAt, MAX_ATTEMPTS]
  );

  // Send email (mock in M1)
  if (config.auth.mode === 'mock') {
    sendEmailMock(email, code, preferMagicLink);
    return {
      expiresInSeconds,
      devHint: preferMagicLink ? `Use magic token: ${code}` : 'Use code 000000',
    };
  }

  // In real mode, would call email service here
  sendEmailMock(email, code, preferMagicLink);

  return { expiresInSeconds };
}

/**
 * Verify email OTP or magic link token
 */
export async function verifyEmailOtp(
  email: string,
  code: string
): Promise<boolean> {
  // Find active challenge
  const result = await query<OtpChallenge>(
    `
    SELECT * FROM otp_challenges
    WHERE channel = 'email'
    AND identifier = $1
    AND expires_at > NOW()
    AND consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const challenge = result.rows[0];

  // Check max attempts
  if (challenge.attempts >= challenge.max_attempts) {
    return false;
  }

  // Verify code
  const isValid = await bcrypt.compare(code, challenge.code_hash);

  // Increment attempts
  await query(
    `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`,
    [challenge.id]
  );

  if (!isValid) {
    return false;
  }

  // Mark as consumed
  await query(
    `UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`,
    [challenge.id]
  );

  return true;
}

/**
 * Clean up expired challenges (background job)
 */
export async function cleanExpiredChallenges(): Promise<number> {
  const result = await query(
    `DELETE FROM otp_challenges WHERE expires_at < NOW() - INTERVAL '1 hour' RETURNING id`
  );
  return result.rowCount || 0;
}
