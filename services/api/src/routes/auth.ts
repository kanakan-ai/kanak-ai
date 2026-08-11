/**
 * Auth routes
 * M1-T2: Email OTP/magic link authentication endpoints
 */

import type { FastifyInstance } from 'fastify';
import { startEmailOtp, verifyEmailOtp } from '../services/auth.js';
import { createSession, revokeSession } from '../services/session.js';
import { findUserByIdentity, findUserById, createUser, getUserIdentities, toUserProfile } from '../services/user.js';
import type { SessionResponse, OtpStartResponse } from '../types/auth.js';
import { authenticate } from '../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /v1/auth/email/start
   * Start email OTP or magic link flow
   */
  app.post<{
    Body: {
      email: string;
      preferMagicLink?: boolean;
    };
  }>('/auth/email/start', async (request, reply) => {
    const { email, preferMagicLink = false } = request.body;

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid email address',
      });
    }

    try {
      const result = await startEmailOtp(email, preferMagicLink);

      const response: OtpStartResponse = {
        status: result.devHint ? 'mock' : 'sent',
        channel: 'email',
        expiresInSeconds: result.expiresInSeconds,
        ...(result.devHint && { devHint: result.devHint }),
      };

      return reply.code(200).send(response);
    } catch (error) {
      request.log.error(error, 'Failed to start email OTP');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send verification email',
      });
    }
  });

  /**
   * POST /v1/auth/email/verify
   * Verify email OTP or magic link token
   */
  app.post<{
    Body: {
      email: string;
      code?: string;
      magicToken?: string;
    };
  }>('/auth/email/verify', async (request, reply) => {
    const { email, code, magicToken } = request.body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Email is required',
      });
    }

    const verificationCode = code || magicToken;
    if (!verificationCode) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Either code or magicToken is required',
      });
    }

    try {
      // Verify OTP/magic token
      const isValid = await verifyEmailOtp(email, verificationCode);
      if (!isValid) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired verification code',
        });
      }

      // Find or create user
      let userResult = await findUserByIdentity('email', email.toLowerCase());
      let userId: string;
      let identities: any[];

      if (!userResult) {
        const newUser = await createUser('email', email.toLowerCase());
        userId = newUser.id;
        identities = await getUserIdentities(userId);
      } else {
        userId = userResult.id;
        identities = await getUserIdentities(userId);
      }

      // Load full user for profile
      const user = userResult || await findUserById(userId);
      if (!user) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to load user',
        });
      }

      // Create session
      const session = await createSession(userId, request.headers['user-agent']);

      // Build response
      const response: SessionResponse = {
        accessToken: session.token,
        tokenType: 'Bearer',
        expiresInSeconds: session.expiresInSeconds,
        user: toUserProfile(user, identities),
      };

      return reply.code(200).send(response);
    } catch (error) {
      request.log.error(error, 'Failed to verify email OTP');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify code',
      });
    }
  });

  /**
   * POST /v1/auth/logout
   * Revoke current session
   */
  app.post('/auth/logout', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No session to logout',
      });
    }

    const token = authorization.split(' ')[1];
    if (!token) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid authorization header',
      });
    }

    try {
      await revokeSession(token);
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to logout');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to logout',
      });
    }
  });
}
