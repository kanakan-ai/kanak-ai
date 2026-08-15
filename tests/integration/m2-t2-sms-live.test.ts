/**
 * M2-T2: Live phone OTP delivery (AWS SNS) — opt-in only.
 *
 * Per design/m2-capabilities.md and design/TECH_STACK.md, "Mock = CI-only" —
 * this suite makes a real AWS SNS Publish call and is skipped unless the
 * runner has explicitly opted in with a real phone number. It never
 * hardcodes a personal phone number into the repo.
 *
 * Run with:
 *   AUTH_MODE=live (in the running stack's .env) and
 *   LIVE_PHONE_TEST_RECIPIENT=+15551234567 npm test -- m2-t2-sms-live
 *
 * This does not (and cannot) read the delivered SMS's code — that part of
 * verification stays manual (docs/M2-T2-verification.md Part 2). What this
 * proves automatically: the live path accepts a well-formed E.164 number
 * with no mock devHint leak.
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';
const LIVE_RECIPIENT = process.env.LIVE_PHONE_TEST_RECIPIENT;

describe.skipIf(!LIVE_RECIPIENT)('M2-T2: live AWS SNS SMS delivery', () => {
  test('accepts a real phone number with no devHint (proves live, not mock, path)', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/phone/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: LIVE_RECIPIENT }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('sent');
    expect(data.devHint).toBeUndefined();
  });

  test('a malformed number is rejected before reaching the SMS provider', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/phone/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'not-a-phone-number' }),
    });

    expect(response.status).toBe(400);
  });
});
