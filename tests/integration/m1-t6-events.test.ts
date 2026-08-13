/**
 * M1-T6: Analytics events + Ops dashboard integration tests
 * Covers POST /v1/events ingestion, server-emitted trust-path events
 * (auth_sign_in_success, document_upload_accepted), and the admin-only
 * GET /v1/admin/ops-summary read model.
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || 'admin@example.com';

async function createTestUser(email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`): Promise<{ token: string; email: string }> {
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
  expect(verifyResponse.status).toBe(200);
  const data = await verifyResponse.json();
  return { token: data.accessToken, email };
}

function createTestPDF(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
}

async function uploadDocument(token: string, documentType: string): Promise<Response> {
  const formData = new FormData();
  formData.append('file', new Blob([createTestPDF()], { type: 'application/pdf' }), 'test.pdf');
  formData.append('documentType', documentType);
  return fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

async function getOpsSummary(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/admin/ops-summary`, { headers: { Authorization: `Bearer ${token}` } });
}

describe('M1-T6: POST /v1/events', () => {
  test('rejects requests without a session', async () => {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ event: 'vault_list_viewed' }] }),
    });
    expect(response.status).toBe(401);
  });

  test('rejects an empty events array', async () => {
    const { token } = await createTestUser();
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [] }),
    });
    expect(response.status).toBe(400);
  });

  test('rejects an event with an invalid client', async () => {
    const { token } = await createTestUser();
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [{ event: 'vault_list_viewed', client: 'desktop' }] }),
    });
    expect(response.status).toBe(400);
  });

  test('rejects a batch larger than 50 events', async () => {
    const { token } = await createTestUser();
    const events = Array.from({ length: 51 }, () => ({ event: 'vault_list_viewed' }));
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    });
    expect(response.status).toBe(400);
  });

  test('accepts a valid event batch', async () => {
    const { token } = await createTestUser();
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        events: [
          { event: 'vault_list_viewed', client: 'web', properties: { document_count: 3 } },
          { event: 'document_detail_viewed', client: 'web' },
        ],
      }),
    });
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.accepted).toBe(2);
  });
});

describe('M1-T6: GET /v1/admin/ops-summary access control', () => {
  test('rejects requests without a session', async () => {
    const response = await getOpsSummary('not-a-real-token');
    expect(response.status).toBe(401);
  });

  test('rejects a non-admin customer', async () => {
    const { token } = await createTestUser();
    const response = await getOpsSummary(token);
    expect(response.status).toBe(403);
  });
});

describe('M1-T6: Server-emitted trust-path events and ops summary', () => {
  test('auth_sign_in_success is recorded on sign-in and visible to admin', async () => {
    const { token: adminToken } = await createTestUser(ADMIN_EMAIL);
    const adminCheck = await fetch(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const adminProfile = await adminCheck.json();
    expect(adminProfile.role).toBe('admin');

    const { email: newUserEmail } = await createTestUser();

    const summaryResponse = await getOpsSummary(adminToken);
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json();

    expect(summary.api.status).toBe('ok');
    expect(summary.database.status).toBe('ok');
    expect(summary.latency.sampleCount).toBeGreaterThan(0);
    expect(summary.events.authSignInSuccess.last24h).toBeGreaterThanOrEqual(2); // admin + new user
    const identifiers = summary.events.authSignInSuccess.recent.map((e: { userIdentifier: string }) => e.userIdentifier);
    expect(identifiers).toContain(newUserEmail);
  });

  test('document_upload_accepted is recorded on upload and visible to admin', async () => {
    const { token: adminToken } = await createTestUser(ADMIN_EMAIL);
    const { token: uploaderToken, email: uploaderEmail } = await createTestUser();

    const uploadResponse = await uploadDocument(uploaderToken, 'auto_policy');
    expect(uploadResponse.status).toBe(202);

    const summaryResponse = await getOpsSummary(adminToken);
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json();

    expect(summary.events.documentUploadAccepted.last24h).toBeGreaterThanOrEqual(1);
    const upload = summary.events.documentUploadAccepted.recent.find(
      (e: { userIdentifier: string }) => e.userIdentifier === uploaderEmail
    );
    expect(upload).toBeDefined();
    expect(upload.properties.document_type).toBe('auto_policy');
  });
});
