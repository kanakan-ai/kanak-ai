/**
 * M1-T4: Vault View Integration Tests
 * Tests document parsing, extraction, and vault display
 */

import { describe, test, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';

// Helper to create a test user and get access token
async function createTestUser(): Promise<string> {
  const email = `test-${Date.now()}@example.com`;
  
  // Start OTP
  const startResponse = await fetch(`${API_BASE_URL}/auth/email/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  expect(startResponse.status).toBe(200);

  // Verify with mock code
  const verifyResponse = await fetch(`${API_BASE_URL}/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: '000000' }),
  });
  expect(verifyResponse.status).toBe(200);

  const verifyData = await verifyResponse.json();
  return verifyData.accessToken;
}

// Helper to create a test PDF file
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

// Helper to upload a document
async function uploadDocument(
  token: string,
  documentType: string
): Promise<string> {
  const formData = new FormData();
  const pdfBlob = new Blob([createTestPDF()], { type: 'application/pdf' });
  formData.append('file', pdfBlob, 'test.pdf');
  formData.append('documentType', documentType);
  formData.append('source', 'upload');

  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  expect(response.status).toBe(202);
  const data = await response.json();
  return data.documentId;
}

// Helper to wait for document to be parsed
async function waitForParsing(
  token: string,
  documentId: string,
  maxAttempts: number = 10
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }

    const document = await response.json();

    if (document.status === 'ready') {
      return document;
    }

    if (document.status === 'failed') {
      throw new Error('Document parsing failed');
    }

    // Wait 1 second before next attempt
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timeout waiting for document to be parsed');
}

describe('M1-T4: Vault View & Stub Parse', () => {
  test('Auto policy is parsed and extracted fields are present', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    
    // Wait for stub parse to complete
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
    expect(document.extracted_record.schema_version).toBe('auto_policy.v1');
    expect(document.extracted_record.fields.length).toBeGreaterThan(0);

    // Check for required auto policy fields
    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('carrier');
    expect(fieldKeys).toContain('policy_number');
    expect(fieldKeys).toContain('premium_annual');
    expect(fieldKeys).toContain('renewal_date');

    // Check denormalized columns
    expect(document.extracted_record.party_name).toBeTruthy();
    expect(document.extracted_record.reference_id).toBeTruthy();
    expect(document.extracted_record.amount).toBeGreaterThan(0);
    expect(document.extracted_record.amount_frequency).toBe('annual');
    expect(document.extracted_record.key_date).toBeTruthy();
  });

  test('Home policy is parsed with correct schema', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'home_policy');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
    expect(document.extracted_record.schema_version).toBe('home_policy.v1');

    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('carrier');
    expect(fieldKeys).toContain('policy_number');
    expect(fieldKeys).toContain('premium_annual');
    expect(fieldKeys).toContain('renewal_date');
    expect(fieldKeys).toContain('dwelling_coverage');

    expect(document.extracted_record.party_name).toBeTruthy();
    expect(document.extracted_record.amount).toBeGreaterThan(0);
  });

  test('Life insurance is parsed with correct fields', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'life_insurance');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
    expect(document.extracted_record.schema_version).toBe('life_insurance.v1');

    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('carrier');
    expect(fieldKeys).toContain('policy_number');
    expect(fieldKeys).toContain('death_benefit');
  });

  test('Warranty document is parsed correctly', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'warranty');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
    expect(document.extracted_record.schema_version).toBe('warranty.v1');

    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('issuer');
    expect(fieldKeys).toContain('warranty_number');
  });

  test('Receipt document is parsed correctly', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'receipt');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
    expect(document.extracted_record.schema_version).toBe('receipt.v1');

    const fieldKeys = document.extracted_record.fields.map((f: any) => f.key);
    expect(fieldKeys).toContain('merchant');
    expect(fieldKeys).toContain('order_number');
    expect(fieldKeys).toContain('total_amount');
  });

  test('Tax document is parsed with basic fields', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'tax');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
  });

  test('Other document type is parsed with minimal fields', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'other');
    
    const document = await waitForParsing(token, documentId);

    expect(document.status).toBe('ready');
    expect(document.extracted_record).toBeDefined();
  });

  test('Document list includes extracted records', async () => {
    const token = await createTestUser();
    
    // Upload two documents
    const docId1 = await uploadDocument(token, 'auto_policy');
    const docId2 = await uploadDocument(token, 'home_policy');
    
    // Wait for both to be parsed
    await waitForParsing(token, docId1);
    await waitForParsing(token, docId2);
    
    // Get document list
    const response = await fetch(`${API_BASE_URL}/documents`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.documents.length).toBeGreaterThanOrEqual(2);

    // Check that extracted records are included
    const parsedDocs = data.documents.filter((d: any) => d.status === 'ready');
    expect(parsedDocs.length).toBeGreaterThanOrEqual(2);
    
    for (const doc of parsedDocs) {
      expect(doc.extracted_record).toBeDefined();
      expect(doc.extracted_record.fields).toBeDefined();
      expect(doc.extracted_record.party_name).toBeTruthy();
    }
  });

  test('Extracted fields have expected structure', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    
    const document = await waitForParsing(token, documentId);

    const fields = document.extracted_record.fields;
    expect(Array.isArray(fields)).toBe(true);

    // Check field structure
    for (const field of fields) {
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('value');
      expect(field).toHaveProperty('confidence');
      expect(field).toHaveProperty('source');
      
      // Confidence should be between 0 and 1
      if (field.confidence !== null && field.confidence !== undefined) {
        expect(field.confidence).toBeGreaterThanOrEqual(0);
        expect(field.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  test('Overall confidence is set correctly', async () => {
    const token = await createTestUser();
    const documentId = await uploadDocument(token, 'auto_policy');
    
    const document = await waitForParsing(token, documentId);

    expect(document.extracted_record.overall_confidence).toBeDefined();
    expect(document.extracted_record.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(document.extracted_record.overall_confidence).toBeLessThanOrEqual(1);
  });

  test('Multiple documents can be parsed concurrently', async () => {
    const token = await createTestUser();
    
    // Upload 3 documents at once
    const docIds = await Promise.all([
      uploadDocument(token, 'auto_policy'),
      uploadDocument(token, 'home_policy'),
      uploadDocument(token, 'life_insurance'),
    ]);

    // Wait for all to be parsed
    const documents = await Promise.all(
      docIds.map((id) => waitForParsing(token, id))
    );

    // All should be ready
    for (const doc of documents) {
      expect(doc.status).toBe('ready');
      expect(doc.extracted_record).toBeDefined();
    }
  });

  test('Filter documents by status in vault list', async () => {
    const token = await createTestUser();
    
    // Upload a document
    const documentId = await uploadDocument(token, 'auto_policy');
    
    // Immediately query for pending documents
    const pendingResponse = await fetch(`${API_BASE_URL}/documents?status=pending`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(pendingResponse.status).toBe(200);
    
    // Wait for parsing to complete
    await waitForParsing(token, documentId);
    
    // Query for ready documents
    const readyResponse = await fetch(`${API_BASE_URL}/documents?status=ready`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(readyResponse.status).toBe(200);
    const readyData = await readyResponse.json();
    
    // Should have at least one ready document
    expect(readyData.documents.length).toBeGreaterThanOrEqual(1);
    expect(readyData.documents[0].status).toBe('ready');
  });
});
