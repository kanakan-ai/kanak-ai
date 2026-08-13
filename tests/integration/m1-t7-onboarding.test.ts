/**
 * M1-T7: First-run experience integration tests
 *
 * The onboarding explainer is client-only (localStorage-backed, since
 * PATCH /v1/me is not implemented — see docs/M1-T7-verification.md), so
 * there is no new server route to exercise. What IS a server contract is
 * that the Journey A step-A1 event the explainer emits (metrics.md:
 * `onboarding_completed`, fired once per account the first time the empty
 * vault is shown) is accepted by the existing POST /v1/events pipeline
 * built in M1-T6.
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';

async function createTestUser(): Promise<string> {
  const email = `test-onboarding-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await fetch(`${API_BASE_URL}/auth/email/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const verifyResponse = await fetch(`${API_BASE_URL}/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: '000000' }),
  });
  const data = await verifyResponse.json();
  return data.accessToken;
}

describe('M1-T7: onboarding_completed accepted by POST /v1/events', () => {
  test('onboarding_completed is accepted', async () => {
    const token = await createTestUser();
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [{ event: 'onboarding_completed', client: 'web' }] }),
    });
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.accepted).toBe(1);
  });
});
