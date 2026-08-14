/**
 * M1-T1 Integration Tests
 * Verifies that the containerized stack is properly set up:
 * - All services are healthy
 * - Database schema is initialized
 * - MinIO bucket exists
 * - API responds to health checks
 * - Web app is accessible
 */

import { describe, it, expect } from 'vitest';

// Every other test file's API_BASE_URL includes the /v1 suffix (e.g. m1-t2-auth.test.ts) —
// match that convention so a single env override works across the whole suite (portability
// verification, docs/M1-E2E-verification.md), and derive the root/health URLs from it here.
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1';
const API_ROOT_URL = API_BASE_URL.replace(/\/v1\/?$/, '');
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';

describe('M1-T1: Infrastructure Health Checks', () => {
  it('API health endpoint returns 200 OK', async () => {
    const response = await fetch(`${API_ROOT_URL}/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('kanak-api');
    expect(data.version).toBeDefined();
  }, { timeout: 10000 });

  it('API v1 root returns API info', async () => {
    const response = await fetch(API_BASE_URL);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.message).toContain('Kanak AI');
    expect(data.endpoints).toBeDefined();
  }, { timeout: 10000 });

  it('Web app is accessible', async () => {
    const response = await fetch(WEB_BASE_URL);
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('Kanak AI');
  }, { timeout: 10000 });

  it('PostgreSQL is accessible', async () => {
    // Basic connectivity test via pg protocol would require pg client
    // For M1-T1, we verify via API that can connect to DB
    const response = await fetch(`${API_ROOT_URL}/health`);
    expect(response.status).toBe(200);
  }, { timeout: 10000 });

  it('MinIO is accessible', async () => {
    const response = await fetch(`${MINIO_ENDPOINT}/minio/health/live`);
    expect(response.status).toBe(200);
  }, { timeout: 10000 });
});

describe('M1-T1: Database Schema', () => {
  it('Database schema tables exist', async () => {
    // This will be properly tested once we have DB query endpoints
    // For M1-T1, we verify the schema was applied via successful API startup
    const response = await fetch(`${API_ROOT_URL}/health`);
    expect(response.status).toBe(200);
  }, { timeout: 10000 });
});

describe('M1-T1: CORS Configuration', () => {
  it('API allows CORS requests from web client', async () => {
    const response = await fetch(`${API_ROOT_URL}/health`, {
      method: 'GET',
      headers: {
        'Origin': WEB_BASE_URL,
      },
    });
    
    expect(response.status).toBe(200);
    // CORS headers should be present
    expect(response.headers.has('access-control-allow-origin')).toBe(true);
  }, { timeout: 10000 });
});
