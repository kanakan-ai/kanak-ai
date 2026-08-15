/**
 * Auth service
 * M1-T2: Email OTP and magic link authentication
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../lib/db.js';
import { config } from '../config.js';
import { getEmailProvider } from '../email/index.js';
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
 * Send the OTP/magic-link email via the configured provider
 * (console in AUTH_MODE=mock; AWS SES in AUTH_MODE=live — see services/api/src/email/).
 */
async function sendOtpEmail(email: string, code: string, isMagicLink: boolean): Promise<void> {
  const provider = getEmailProvider();
  if (isMagicLink) {
    await provider.send({
      to: email,
      subject: 'Sign in to Kanak AI',
      text: `Click the link below to sign in:\nhttp://localhost:3000/auth/verify?token=${code}\n\nThis link expires in 15 minutes.`,
    });
  } else {
    await provider.send({
      to: email,
      subject: 'Your Kanak AI verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.`,
    });
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

  await sendOtpEmail(email, code, preferMagicLink);

  if (config.auth.mode === 'mock') {
    return {
      expiresInSeconds,
      devHint: preferMagicLink ? `Use magic token: ${code}` : 'Use code 000000',
    };
  }

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

/** Start phone OTP flow. SMS delivery remains a local mock in M1. */
export async function startPhoneOtp(phone: string): Promise<{ expiresInSeconds: number; devHint?: string }> {
  const code = config.auth.mode === 'mock' ? '000000' : generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
  await query(
    `INSERT INTO otp_challenges (channel, identifier, code_hash, expires_at, max_attempts) VALUES ($1, $2, $3, $4, $5)`,
    ['phone', phone, await hashCode(code), expiresAt, MAX_ATTEMPTS]
  );
  if (config.auth.mode === 'mock') {
    console.log(`MOCK SMS (AUTH_MODE=mock) to ${phone}: Kanak AI code ${code}`);
    return { expiresInSeconds: OTP_EXPIRY_SECONDS, devHint: 'Use code 000000' };
  }
  return { expiresInSeconds: OTP_EXPIRY_SECONDS };
}

/** Verify an OTP for any passwordless channel. */
export async function verifyOtp(channel: 'email' | 'phone', identifier: string, code: string): Promise<boolean> {
  const result = await query<OtpChallenge>(
    `SELECT * FROM otp_challenges WHERE channel = $1 AND identifier = $2 AND expires_at > NOW() AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [channel, identifier]
  );
  const challenge = result.rows[0];
  if (!challenge || challenge.attempts >= challenge.max_attempts) return false;
  const isValid = await bcrypt.compare(code, challenge.code_hash);
  await query(`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`, [challenge.id]);
  if (isValid) await query(`UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`, [challenge.id]);
  return isValid;
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
