/**
 * M1-T3: Document Upload Integration Tests
 * Tests PDF upload, document listing, retrieval, and deletion
 */

import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // Minimal valid PDF content
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n' +
    '0 4\n' +
    '0000000000 65535 f\n' +
    '0000000009 00000 n\n' +
    '0000000056 00000 n\n' +
    '0000000115 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n' +
    '203\n' +
    '%%EOF'
  );
}

// Helper to build a PDF with real, extractable text content (correct xref offsets,
// unlike createTestPDF() above which has no content stream at all) — needed to
// exercise the M2-T4 type-match heuristic, which only judges when it can extract text.
function createTestPDFWithText(text: string): Buffer {
  const objs = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  ];
  const stream = `BT /F1 12 Tf 72 712 Td (${text}) Tj ET`;
  objs.push(`5 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj`);

  const header = '%PDF-1.4\n';
  let body = header;
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(body.length);
    body += obj + '\n';
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body + xref + trailer);
}

describe('M1-T3: Document Upload Flow', () => {
  let testToken: string;
  let testDocumentId: string;

  test('Setup - create test user', async () => {
    testToken = await createTestUser();
    expect(testToken).toBeTruthy();
  });

  test('POST /v1/documents - should upload PDF successfully', async () => {
    const pdfBuffer = createTestPDF();
    const formData = new FormData();
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-policy.pdf');
    formData.append('documentType', 'auto_policy');
    formData.append('source', 'upload');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(202);
    const data = await response.json();
    
    expect(data.documentId).toBeTruthy();
    expect(data.status).toBe('pending');
    expect(data.message).toContain('processing');

    testDocumentId = data.documentId;
  });

  test('POST /v1/documents - correctly reads documentType for a realistically large PDF (regression: multipart field-ordering)', async () => {
    // @fastify/multipart's request.file() resolves as soon as the file part's header is
    // seen — form fields that appear AFTER the file in the multipart body (as ours do: the
    // client appends `file` before `documentType`) aren't guaranteed to be parsed yet at
    // that point. A tiny fixture like createTestPDF() arrives in one shot and never exposes
    // this; a real-sized file reliably split across multiple chunks does. This is what a
    // real user actually hit — the fix reads fields only after the file stream is drained.
    const pdfBuffer = createTestPDFWithText(
      'This is your auto insurance vehicle policy declarations page. ' + 'Filler text to pad this document to a realistic size. '.repeat(50_000)
    );
    const formData = new FormData();

    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'large-policy.pdf');
    formData.append('documentType', 'auto_policy');
    formData.append('source', 'upload');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    expect(response.status, `expected 202, got ${response.status}: ${JSON.stringify(data)}`).toBe(202);
    expect(data.documentId).toBeTruthy();
    expect(data.status).toBe('pending');
  }, 30000);

  test('POST /v1/documents - should reject upload without authentication', async () => {
    const pdfBuffer = createTestPDF();
    const formData = new FormData();
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-policy.pdf');
    formData.append('documentType', 'auto_policy');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(401);
  });

  test('POST /v1/documents - should reject non-PDF file', async () => {
    const formData = new FormData();
    
    const textBlob = new Blob(['Not a PDF'], { type: 'text/plain' });
    formData.append('file', textBlob, 'test.txt');
    formData.append('documentType', 'auto_policy');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('PDF');
  });

  test('POST /v1/documents - should reject a file with a spoofed application/pdf Content-Type but non-PDF bytes (M2-T4)', async () => {
    const formData = new FormData();

    // Content-Type claims PDF, but the bytes don't start with the %PDF- magic number —
    // this must be caught by structural (magic-byte) validation, not just the
    // client-supplied mimetype header used in the test above.
    const fakeBlob = new Blob(['Not actually a PDF, just labeled as one'], { type: 'application/pdf' });
    formData.append('file', fakeBlob, 'fake.pdf');
    formData.append('documentType', 'auto_policy');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/valid PDF/i);
  });

  test('POST /v1/documents - blocks (with requiresConfirmation) content that does not match the selected type, before writing storage/DB (M2-T4)', async () => {
    const pdfBuffer = createTestPDFWithText(
      'Thank you for your purchase. Order number: 12345. Subtotal: 49.99. Total due: 53.99.'
    );
    const formData = new FormData();

    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'receipt-labeled-as-life-insurance.pdf');
    formData.append('documentType', 'life_insurance');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    // Blocked before storage/DB writes — a mismatch is a confirmable prompt, not a silent accept.
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.requiresConfirmation).toBe(true);
    expect(data.documentType).toBe('life_insurance');
    expect(data.message).toMatch(/doesn't look like a life insurance/i);
    expect(data.documentId).toBeUndefined();
  });

  test('POST /v1/documents - a confirmed type override still uploads, but stays flagged needs_review (M2-T4)', async () => {
    const pdfBuffer = createTestPDFWithText(
      'Thank you for your purchase. Order number: 12345. Subtotal: 49.99. Total due: 53.99.'
    );
    const formData = new FormData();

    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'receipt-confirmed-as-life-insurance.pdf');
    formData.append('documentType', 'life_insurance');
    formData.append('confirmTypeOverride', 'true');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    // The upload succeeds (the user made an informed choice), but it's not treated as
    // clean — it stays needs_review rather than silently proceeding to pending/parsed.
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.status).toBe('needs_review');
    expect(data.documentId).toBeTruthy();
    expect(data.message).toMatch(/flagged for review/i);
  });

  test('POST /v1/documents - accepts content that matches the selected type as pending (M2-T4)', async () => {
    const pdfBuffer = createTestPDFWithText(
      'This is your Home Insurance Policy declarations page. Dwelling coverage: 300000.'
    );
    const formData = new FormData();

    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'home-policy.pdf');
    formData.append('documentType', 'home_policy');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.status).toBe('pending');
    expect(data.message).toContain('processing');
  });

  test('POST /v1/documents - should reject missing documentType', async () => {
    const pdfBuffer = createTestPDF();
    const formData = new FormData();
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-policy.pdf');
    // Missing documentType

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('documentType');
  });

  test('POST /v1/documents - should reject invalid documentType', async () => {
    const pdfBuffer = createTestPDF();
    const formData = new FormData();
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-policy.pdf');
    formData.append('documentType', 'invalid_type');

    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('Invalid documentType');
  });

  test('GET /v1/documents - should list user documents', async () => {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.documents)).toBe(true);
    expect(data.documents.length).toBeGreaterThan(0);
    
    const uploadedDoc = data.documents.find((d: any) => d.id === testDocumentId);
    expect(uploadedDoc).toBeTruthy();
    expect(uploadedDoc.document_type).toBe('auto_policy');
    expect(uploadedDoc.status).toMatch(/pending|parsing|ready/); // Worker may process quickly
  });

  test('GET /v1/documents - should reject without authentication', async () => {
    const response = await fetch(`${API_BASE_URL}/documents`);

    expect(response.status).toBe(401);
  });

  test('GET /v1/documents/:id - should get document detail', async () => {
    const response = await fetch(`${API_BASE_URL}/documents/${testDocumentId}`, {
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBe(testDocumentId);
    expect(data.document_type).toBe('auto_policy');
    expect(data.storage_key).toBeTruthy();
    expect(data.download_url).toBeTruthy();
  });

  test('GET /v1/documents/:id - should reject access to non-existent document', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    const response = await fetch(`${API_BASE_URL}/documents/${fakeId}`, {
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404);
  });

  test('DELETE /v1/documents/:id - should delete document', async () => {
    const response = await fetch(`${API_BASE_URL}/documents/${testDocumentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(204);

    // Verify document is gone
    const getResponse = await fetch(`${API_BASE_URL}/documents/${testDocumentId}`, {
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(getResponse.status).toBe(404);
  });

  test('DELETE /v1/documents/:id - should reject without authentication', async () => {
    // Upload another document first
    const pdfBuffer = createTestPDF();
    const formData = new FormData();
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-doc.pdf');
    formData.append('documentType', 'other');

    const uploadResponse = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const docId = uploadData.documentId;

    // Try to delete without auth
    const deleteResponse = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      method: 'DELETE',
    });

    expect(deleteResponse.status).toBe(401);
  });

  test('POST /v1/documents - should accept all valid document types', async () => {
    const validTypes = [
      'home_policy',
      'life_insurance',
      'warranty',
      'tax',
      'receipt',
      'other',
    ];

    for (const docType of validTypes) {
      const pdfBuffer = createTestPDF();
      const formData = new FormData();
      
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, `test-${docType}.pdf`);
      formData.append('documentType', docType);

      const response = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
        body: formData,
      });

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.documentId).toBeTruthy();
    }
  });
});
