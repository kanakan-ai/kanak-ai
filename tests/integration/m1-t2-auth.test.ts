/**
 * M1-T2: Sign-in Flow Integration Tests
 * Tests email OTP authentication, session management, and protected endpoints
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';

interface SessionResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: {
    id: string;
    email: string;
    appleLinked: boolean;
    plan: string;
    role: string;
    darkMode: boolean;
    pushEnabled: boolean;
    weeklyDigest: boolean;
    createdAt: string;
  };
}

describe('M1-T2: Email Authentication Flow', () => {
  let testEmail: string;
  let accessToken: string;

  beforeEach(() => {
    // Generate unique email for each test
    testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  });

  test('POST /v1/auth/email/start - should initiate email OTP challenge', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      status: 'mock',
      channel: 'email',
      expiresInSeconds: 300,
      devHint: 'Use code 000000',
    });
  });

  test('POST /v1/auth/email/start - should reject invalid email format', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    expect(response.status).toBe(400);
  });

  test('POST /v1/auth/email/verify - should create session with valid OTP', async () => {
    // Start OTP challenge
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    // Verify with mock code
    const response = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    expect(response.status).toBe(200);

    const data: SessionResponse = await response.json();
    expect(data).toMatchObject({
      tokenType: 'Bearer',
      expiresInSeconds: 86400,
    });
    expect(data.accessToken).toBeTruthy();
    expect(data.user).toMatchObject({
      email: testEmail,
      plan: 'free',
      role: 'customer',
      appleLinked: false,
    });
    expect(data.user.id).toBeTruthy();

    // Save token for subsequent tests
    accessToken = data.accessToken;
  });

  test('POST /v1/auth/email/verify - should reject invalid OTP code', async () => {
    // Start OTP challenge
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    // Try with wrong code
    const response = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '999999' }),
    });

    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('POST /v1/auth/email/verify - should reject expired email address', async () => {
    // Try to verify without starting challenge
    const response = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    expect(response.status).toBe(401);
  });

  test('GET /v1/me - should return user profile with valid token', async () => {
    // First authenticate
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const authResponse = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    const { accessToken } = await authResponse.json();

    // Get profile
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);

    const user = await response.json();
    expect(user).toMatchObject({
      email: testEmail,
      plan: 'free',
      role: 'customer',
    });
  });

  test('GET /v1/me - should reject request without token', async () => {
    const response = await fetch(`${API_BASE_URL}/me`);
    expect(response.status).toBe(401);
  });

  test('GET /v1/me - should reject request with invalid token', async () => {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': 'Bearer invalid-token-12345' },
    });

    expect(response.status).toBe(401);
  });

  test('POST /v1/auth/logout - should revoke session', async () => {
    // First authenticate
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const authResponse = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    const { accessToken } = await authResponse.json();

    // Verify token works
    const meResponse1 = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(meResponse1.status).toBe(200);

    // Logout
    const logoutResponse = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(logoutResponse.status).toBe(204);

    // Verify token no longer works
    const meResponse2 = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(meResponse2.status).toBe(401);
  });

  test('Magic link preference - should set preferMagicLink flag', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, preferMagicLink: true }),
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('mock');
    // In mock mode, both OTP and magic link work the same way
  });

  test('Returning user - should reuse existing user account', async () => {
    // First sign-in
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const response1 = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    const data1 = await response1.json();
    const userId1 = data1.user.id;

    // Second sign-in (same email)
    await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const response2 = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    const data2 = await response2.json();
    const userId2 = data2.user.id;

    // Should be the same user
    expect(userId1).toBe(userId2);
    // But different session tokens
    expect(data1.accessToken).not.toBe(data2.accessToken);
  });
});
