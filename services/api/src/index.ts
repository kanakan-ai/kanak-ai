/**
 * Kanak AI API Server
 * M1-T1: Minimal Fastify server with health check endpoint
 * M1-T2: Email authentication + session management
 * M1-T3: Document upload and vault
 * M1-T4: Vault view with stub parse worker
 * M2-T5a: Real ParseProvider abstraction + document-type registry replace the stub worker
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import documentRoutes from './routes/documents.js';
import { eventsRoutes } from './routes/events.js';
import { adminRoutes } from './routes/admin.js';
import { checkHealth } from './lib/db.js';
import { recordLatency } from './lib/latency.js';
import { initMinIO } from './services/storage.js';
import { startParseWorker } from './workers/parse-worker.js';
import { startDocumentRetentionWorker } from './workers/document-retention-worker.js';

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

// Multipart form support for file uploads (M1-T3)
await app.register(multipart, {
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
  },
});

// M1-T6: request latency samples for the admin ops dashboard
app.addHook('onResponse', async (request, reply) => {
  recordLatency(reply.elapsedTime);
});

/**
 * Health check endpoint
 * Returns 200 when API service is ready
 * M1-T2: Added database connectivity check
 */
app.get('/health', async () => {
  const dbHealthy = await checkHealth();
  
  return {
    status: dbHealthy ? 'ok' : 'degraded',
    service: 'kanak-api',
    version: '0.1.0',
    env: config.env,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? 'ok' : 'down',
    },
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
 * V1 API routes
 * M1-T2: Auth and user profile routes
 * M1-T3+: Document, alerts, quotes routes
 */
app.register(async (v1) => {
  // Root endpoint
  v1.get('/', async () => {
    return {
      message: 'Kanak AI API v1',
      endpoints: {
        auth: '/v1/auth/*',
        me: '/v1/me',
        documents: '/v1/documents (M1-T3)',
        alerts: '/v1/alerts (M1+)',
        quotes: '/v1/quotes (M1+)',
        ask: '/v1/ask (M1+)',
        account: '/v1/account (M1+)',
        events: '/v1/events (M1-T6)',
      },
    };
  });

  // M1-T2: Authentication routes
  await v1.register(authRoutes);
    
  // M1-T2: User profile routes
  await v1.register(meRoutes);

  // M1-T3: Document routes
  await v1.register(documentRoutes);

  // M1-T6: Analytics ingestion + admin ops dashboard
  await v1.register(eventsRoutes);
  await v1.register(adminRoutes);
}, { prefix: '/v1' });

/**
 * Start server
 */
async function start() {
  try {
    // Initialize MinIO storage (M1-T3)
    await initMinIO();
    console.log('✓ MinIO initialized');

    // Start parse worker (M2-T5a — replaces the M1-T4 stub)
    startParseWorker();
    console.log('✓ Parse worker started');

    // Start document retention worker (M2-T4)
    startDocumentRetentionWorker();
    console.log('✓ Document retention worker started');

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
