import { describe, expect, test } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';

describe('M1-T5: Phone OTP and Apple authentication', () => {
  test('phone OTP creates a reusable passwordless session', async () => {
    const phone = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
    const start = await fetch(`${API_BASE_URL}/auth/phone/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    expect(start.status).toBe(200);
    expect(await start.json()).toMatchObject({ status: 'mock', channel: 'sms', devHint: 'Use code 000000' });
    const verify = await fetch(`${API_BASE_URL}/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code: '000000' }) });
    expect(verify.status).toBe(200);
    const session = await verify.json();
    expect(session.user.phone).toBe(phone);
    const me = await fetch(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).phone).toBe(phone);
  });

  test('phone start rejects a non-E.164 number and verification rejects a bad code', async () => {
    const invalid = await fetch(`${API_BASE_URL}/auth/phone/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '555-123-4567' }) });
    expect(invalid.status).toBe(400);
    const phone = '+15551234567';
    await fetch(`${API_BASE_URL}/auth/phone/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    const verify = await fetch(`${API_BASE_URL}/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code: '999999' }) });
    expect(verify.status).toBe(401);
  });

  test('explicit mock Apple identity creates a session and rejects unconfigured tokens', async () => {
    const accepted = await fetch(`${API_BASE_URL}/auth/apple`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identityToken: 'mock-apple-integration-user' }) });
    expect(accepted.status).toBe(200);
    const session = await accepted.json();
    expect(session.user.appleLinked).toBe(true);
    const rejected = await fetch(`${API_BASE_URL}/auth/apple`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identityToken: 'not-a-verified-apple-token' }) });
    expect(rejected.status).toBe(401);
  });
});
