/**
 * Admin routes
 * M1-T6: Basic ops dashboard data (role=admin only; never linked from customer UI)
 *
 * GET /v1/admin/ops-summary response shape (not yet reflected in
 * kanak-ai-specs/design/api/openapi.yaml — see services/analytics.ts note):
 *   {
 *     api: { status, env, uptimeSeconds, version },
 *     database: { status },
 *     latency: { sampleCount, avgMs, p50Ms, p95Ms },
 *     events: {
 *       authSignInSuccess: { last24h, recent: [...] },
 *       documentUploadAccepted: { last24h, recent: [...] },
 *       dailyCounts: [{ day, event, count }]
 *     }
 *   }
 */

import type { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { checkHealth } from '../lib/db.js';
import { getLatencyStats } from '../lib/latency.js';
import { config } from '../config.js';
import { recentEvents, eventCountSince, dailyEventCounts } from '../services/analytics.js';

const AUTH_EVENT = 'auth_sign_in_success';
const UPLOAD_EVENT = 'document_upload_accepted';

const serverStartedAt = Date.now();

function toApiEvent(row: Awaited<ReturnType<typeof recentEvents>>[number]) {
  return {
    id: row.id,
    userIdentifier: row.user_identifier,
    properties: row.properties,
    occurredAt: row.occurred_at,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    '/admin/ops-summary',
    { preHandler: [authenticate, requireAdmin] },
    async (_request, reply) => {
      const dbHealthy = await checkHealth();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [authRecent, uploadRecent, authCount24h, uploadCount24h, dailyCounts] = await Promise.all([
        recentEvents(AUTH_EVENT, 10),
        recentEvents(UPLOAD_EVENT, 10),
        eventCountSince(AUTH_EVENT, since24h),
        eventCountSince(UPLOAD_EVENT, since24h),
        dailyEventCounts([AUTH_EVENT, UPLOAD_EVENT], 7),
      ]);

      return reply.send({
        api: {
          status: 'ok',
          env: config.env,
          uptimeSeconds: Math.round((Date.now() - serverStartedAt) / 1000),
          version: '0.1.0',
        },
        database: {
          status: dbHealthy ? 'ok' : 'down',
        },
        latency: getLatencyStats(),
        events: {
          authSignInSuccess: { last24h: authCount24h, recent: authRecent.map(toApiEvent) },
          documentUploadAccepted: { last24h: uploadCount24h, recent: uploadRecent.map(toApiEvent) },
          dailyCounts,
        },
      });
    }
  );
}
