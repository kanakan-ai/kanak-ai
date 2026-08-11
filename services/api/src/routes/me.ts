/**
 * User profile routes
 * M1-T2: /me endpoint for current user
 */

import type { FastifyInstance } from 'fastify';
import { getUserIdentities, toUserProfile } from '../services/user.js';
import { authenticate } from '../middleware/auth.js';
import type { UserProfile } from '../types/auth.js';

export async function meRoutes(app: FastifyInstance) {
  /**
   * GET /v1/me
   * Get current user profile
   */
  app.get('/me', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    try {
      // Get all user identities
      const identities = await getUserIdentities(user.id);

      const profile: UserProfile = toUserProfile(user, identities);

      return reply.code(200).send(profile);
    } catch (error) {
      request.log.error(error, 'Failed to get user profile');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to load profile',
      });
    }
  });

  /**
   * PATCH /v1/me
   * Update user preferences (M1-T2: stub for future implementation)
   */
  app.patch('/me', {
    preHandler: authenticate,
  }, async (_request, reply) => {
    return reply.code(501).send({
      error: 'Not Implemented',
      message: 'Profile updates will be implemented in a future task',
    });
  });
}
