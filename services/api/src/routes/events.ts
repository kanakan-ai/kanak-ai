/**
 * Analytics event routes
 * M1-T6: POST /v1/events per design/api/openapi.yaml EventBatchRequest
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { recordEvents, validateEvent, type AnalyticsEventInput } from '../services/analytics.js';

export async function eventsRoutes(app: FastifyInstance) {
  app.post<{ Body: { events: AnalyticsEventInput[] } }>(
    '/events',
    { preHandler: authenticate },
    async (request, reply) => {
      const events = request.body?.events;

      if (!Array.isArray(events) || events.length === 0) {
        return reply.code(400).send({ error: 'Bad Request', message: 'events must be a non-empty array' });
      }
      if (events.length > 50) {
        return reply.code(400).send({ error: 'Bad Request', message: 'events must contain 50 items or fewer' });
      }

      for (const event of events) {
        const validationError = validateEvent(event);
        if (validationError) {
          return reply.code(400).send({ error: 'Bad Request', message: validationError });
        }
      }

      try {
        const authReq = request as AuthenticatedRequest;
        await recordEvents(authReq.user.id, events);
        return reply.code(202).send({ accepted: events.length });
      } catch (error) {
        request.log.error(error, 'Failed to record events');
        return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to record events' });
      }
    }
  );
}
