/**
 * M2-T1: Live email OTP delivery (AWS SES) — opt-in only.
 *
 * Per design/m2-capabilities.md and design/TECH_STACK.md, "Mock = CI-only" —
 * this suite makes a real AWS SES call and is skipped unless the runner has
 * explicitly opted in with a real, SES-verified recipient address. It never
 * hardcodes a personal email into the repo.
 *
 * Run with:
 *   AUTH_MODE=live (in the running stack's .env) and
 *   LIVE_EMAIL_TEST_RECIPIENT=you@yourdomain.com npm test -- m2-t1-email-live
 *
 * This does not (and cannot) read the delivered email's code — that part of
 * verification stays manual (docs/M2-T1-verification.md Part 2). What this
 * proves automatically: the live path accepts a verified recipient with no
 * mock devHint leak, and correctly classifies/reports a rejected recipient.
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';
const LIVE_RECIPIENT = process.env.LIVE_EMAIL_TEST_RECIPIENT;

describe.skipIf(!LIVE_RECIPIENT)('M2-T1: live AWS SES email delivery', () => {
  test('accepts a verified recipient with no devHint (proves live, not mock, path)', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LIVE_RECIPIENT }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('sent');
    expect(data.devHint).toBeUndefined();
  });

  test('an unverified/rejected recipient gets a clear, non-vendor-leaking error', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `definitely-unverified-${Date.now()}@example.com` }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.message).toContain('Failed to send verification email');
  });
});
