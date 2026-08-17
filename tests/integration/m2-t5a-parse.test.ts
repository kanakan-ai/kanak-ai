/**
 * M2-T5a: ParseProvider abstraction + document-type modules
 * Covers the 4 new document types (not exercised by m1-t4-vault.test.ts) end-to-end
 * through the real registry-driven mock adapter, and confirms extracted fields match
 * each type's real design/schemas/*.v1.json field keys.
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';

async function createTestUser(): Promise<string> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
  return data.accessToken;
}

function createTestPDF(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n' +
    '0 4\n' +
    '0000000000 65535 f\n' +
    '0000000015 00000 n\n' +
    '0000000068 00000 n\n' +
    '0000000128 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n' +
    '210\n' +
    '%%EOF\n'
  );
}

async function uploadDocument(token: string, documentType: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([createTestPDF()], { type: 'application/pdf' });
  formData.append('file', blob, 'test.pdf');
  formData.append('documentType', documentType);
  formData.append('source', 'upload');

  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  expect(response.status).toBe(202);
  const data = await response.json();
  return data.documentId;
}

async function waitForParsing(token: string, documentId: string, maxAttempts = 15): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch document');
    const document = await response.json();
    if (document.status === 'ready' || document.status === 'needs_review' || document.status === 'failed') {
      return document;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Timeout waiting for document to be parsed');
}

describe('M2-T5a: document-type modules — new types', () => {
  test.each([
    ['umbrella_policy', 'umbrella_policy.v1', ['carrier', 'policy_number', 'coverage_limit', 'renewal_date']],
    ['landlord_policy', 'landlord_policy.v1', ['carrier', 'policy_number', 'property_address_street1', 'loss_of_rents_coverage_limit']],
    ['renters_policy', 'renters_policy.v1', ['carrier', 'policy_number', 'personal_property_coverage_limit', 'loss_of_use_coverage_limit']],
    ['long_term_care', 'long_term_care.v1', ['carrier', 'policy_number', 'daily_benefit_amount', 'benefit_period_years']],
  ])('%s parses with real schema fields (%s)', async (documentType, expectedSchemaVersion, expectedKeys) => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, documentType);
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record.schema_version).toBe(expectedSchemaVersion);

    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    for (const key of expectedKeys) {
      expect(fieldKeys).toContain(key);
    }

    // Denormalized columns populated from the schema's own mapping, not hardcoded.
    expect(document.extracted_record.party_name).toBeTruthy();
    expect(document.extracted_record.reference_id).toBeTruthy();
  });

  test('generic fallback (tax) still parses to ready with sparse fields, not needs_review', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'tax');
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record.schema_version).toBe('other.v0');
    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('title');
  });
});
