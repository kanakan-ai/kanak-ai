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
    expect(data.status).toBe('accepted');
    expect(data.message).toContain('processing');

    testDocumentId = data.documentId;
  });

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
    expect(uploadedDoc.status).toMatch(/pending|parsing/);
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
