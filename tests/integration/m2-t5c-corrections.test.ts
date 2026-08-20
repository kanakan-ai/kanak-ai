/**
 * M2-T5c: PATCH /documents/{id}/fields — user corrections to extracted fields.
 * Array fields are whole-field replacements (edit/add/remove an item all become "send
 * back the new array for this key"), same {key, value} shape as a scalar correction.
 *
 * The mock ParseProvider always produces clean, fully-populated, needsReview:false
 * output (M2-T5a), so a document reaching `needs_review` with real correctable fields
 * isn't reachable end-to-end today — that only becomes possible once M2-T5b's real
 * adapter can produce a genuinely low-confidence extraction. determineStatusAfterCorrection's
 * needs_review -> ready transition is covered at the unit level instead
 * (workers/__tests__/parse-status.test.ts); this suite covers the PATCH endpoint's real
 * HTTP contract and persistence against a normally-parsed `ready` document.
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

async function patchFields(token: string, documentId: string, fields: Array<{ key: string; value: unknown }>) {
  return fetch(`${API_BASE_URL}/documents/${documentId}/fields`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
}

describe('M2-T5c: field corrections', () => {
  test('an object-array field carries its item property schema, so the UI can build an "add item" form even with zero items', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    const parsed = await waitForParsing(token, documentId);

    const vehiclesField = parsed.extracted_record.fields.find((f: any) => f.key === 'vehicles');
    expect(Array.isArray(vehiclesField.itemSchema)).toBe(true);
    const vinProp = vehiclesField.itemSchema.find((p: any) => p.key === 'vin');
    expect(vinProp).toEqual({ key: 'vin', label: 'VIN', type: 'string' });

    // A scalar-array field (e.g. warranty's covered_components) has no itemSchema — items are plain strings.
    const discountsField = parsed.extracted_record.fields.find((f: any) => f.key === 'discounts');
    expect(Array.isArray(discountsField.itemSchema)).toBe(true);
  });

  test('corrects a scalar field and updates the denormalized column derived from it', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    await waitForParsing(token, documentId);

    const response = await patchFields(token, documentId, [{ key: 'carrier', value: 'State Farm' }]);
    expect(response.status).toBe(200);
    const document = await response.json();

    const carrier = document.extracted_record.fields.find((f: any) => f.key === 'carrier');
    expect(carrier.value).toBe('State Farm');
    expect(carrier.needsReview).toBe(false);
    expect(carrier.source).toBe('user');
    // auto_policy.v1.json maps denormalized_columns.party_name -> carrier
    expect(document.extracted_record.party_name).toBe('State Farm');
  });

  test('edits one item inside an array field by sending back the whole array', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    const parsed = await waitForParsing(token, documentId);

    const vehicles = parsed.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    const edited = vehicles.map((v: any, i: number) => (i === 0 ? { ...v, vin: 'CORRECTED-VIN-000' } : v));

    const response = await patchFields(token, documentId, [{ key: 'vehicles', value: edited }]);
    expect(response.status).toBe(200);
    const document = await response.json();
    const updatedVehicles = document.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    expect(updatedVehicles[0].vin).toBe('CORRECTED-VIN-000');
    expect(updatedVehicles).toHaveLength(vehicles.length);
  });

  test('adding an item to an array field grows it by one', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    const parsed = await waitForParsing(token, documentId);

    const vehicles = parsed.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    const grown = [...vehicles, { ...vehicles[0], vin: 'NEW-VEHICLE-VIN' }];

    const response = await patchFields(token, documentId, [{ key: 'vehicles', value: grown }]);
    expect(response.status).toBe(200);
    const document = await response.json();
    const updatedVehicles = document.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    expect(updatedVehicles).toHaveLength(vehicles.length + 1);
  });

  test('removing an item from an array field shrinks it by one', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    const parsed = await waitForParsing(token, documentId);

    const vehicles = parsed.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    const shrunk = vehicles.slice(1);

    const response = await patchFields(token, documentId, [{ key: 'vehicles', value: shrunk }]);
    expect(response.status).toBe(200);
    const document = await response.json();
    const updatedVehicles = document.extracted_record.fields.find((f: any) => f.key === 'vehicles').value;
    expect(updatedVehicles).toHaveLength(vehicles.length - 1);
  });

  test('rejects an unknown field key with 400', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    await waitForParsing(token, documentId);

    const response = await patchFields(token, documentId, [{ key: 'not_a_real_field', value: 'x' }]);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('not_a_real_field');
  });

  test('rejects an array value for a scalar field with 400', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    await waitForParsing(token, documentId);

    const response = await patchFields(token, documentId, [{ key: 'carrier', value: ['nope'] }]);
    expect(response.status).toBe(400);
  });

  test('a no-op correction (same value) returns 200 unchanged', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    const parsed = await waitForParsing(token, documentId);
    const carrier = parsed.extracted_record.fields.find((f: any) => f.key === 'carrier').value;

    const response = await patchFields(token, documentId, [{ key: 'carrier', value: carrier }]);
    expect(response.status).toBe(200);
    const document = await response.json();
    expect(document.extracted_record.fields.find((f: any) => f.key === 'carrier').value).toBe(carrier);
  });

  test('returns 404 for another user\'s document', async () => {
    const ownerToken = await createTestUser();
    const documentId = await uploadDocument(ownerToken, 'auto_policy');
    await waitForParsing(ownerToken, documentId);

    const otherToken = await createTestUser();
    const response = await patchFields(otherToken, documentId, [{ key: 'carrier', value: 'Nope' }]);
    expect(response.status).toBe(404);
  });

  test('returns 404 for a nonexistent document', async () => {
    const token = await createTestUser();
    const response = await patchFields(token, '00000000-0000-0000-0000-000000000000', [{ key: 'carrier', value: 'x' }]);
    expect(response.status).toBe(404);
  });

  test('rejects an empty fields array with 400', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    await waitForParsing(token, documentId);

    const response = await patchFields(token, documentId, []);
    expect(response.status).toBe(400);
  });
});
