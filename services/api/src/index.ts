/**
 * Kanak AI API Server
 * M1-T1: Minimal Fastify server with health check endpoint
 * Auth, upload, and other routes will be added in M1-T2+
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

const app = Fastify({
  logger: {
    level: config.env === 'production' ? 'info' : 'debug',
  },
});

// CORS for local web client
await app.register(cors, {
  origin: true, // Allow all origins in development; restrict in production
  credentials: true,
});

/**
 * Health check endpoint
 * Returns 200 when API service is ready
 */
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'kanak-api',
    version: '0.1.0',
    env: config.env,
    timestamp: new Date().toISOString(),
  };
});

/**
 * Root endpoint (placeholder)
 */
app.get('/', async () => {
  return {
    name: 'Kanak AI API',
    version: '0.1.0',
    docs: '/v1/docs',
    health: '/health',
  };
});

/**
 * V1 API routes (placeholder for M1-T1)
 * Auth routes will be added in M1-T2
 * Document routes will be added in M1-T4
 */
app.register(async (v1) => {
  v1.get('/', async () => {
    return {
      message: 'Kanak AI API v1',
      endpoints: {
        auth: '/v1/auth/*',
        documents: '/v1/documents',
        alerts: '/v1/alerts',
        quotes: '/v1/quotes',
        ask: '/v1/ask',
        account: '/v1/account',
        events: '/v1/events',
      },
      note: 'Endpoints will be implemented in M1-T2+',
    };
  });
}, { prefix: '/v1' });

/**
 * Start server
 */
async function start() {
  try {
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });
    console.log(`✓ Kanak API listening on port ${config.port}`);
    console.log(`✓ Environment: ${config.env}`);
    console.log(`✓ Auth mode: ${config.auth.mode}`);
    console.log(`✓ Health check: http://localhost:${config.port}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
