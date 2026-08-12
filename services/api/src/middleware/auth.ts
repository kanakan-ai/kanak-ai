/**
 * Auth middleware
 * M1-T2: Bearer token validation middleware
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../services/session.js';
import { findUserById } from '../services/user.js';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate middleware
 * Validates session token and attaches user to request
 * 
 * Use as: onRequest: [authenticateRequest]
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  // Validate session
  const userId = await validateSession(token);
  if (!userId) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  }

  // Load user
  const user = await findUserById(userId);
  if (!user) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'User not found',
    });
  }

  // Attach user to request for downstream handlers
  (request as any).user = user;
  (request as any).userId = userId;
}

// Export alias for consistency
export const authenticateRequest = authenticate;

/**
 * Optional auth middleware
 * Attaches user if token present, but doesn't reject request
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    return;
  }

  const userId = await validateSession(token);
  if (userId) {
    const user = await findUserById(userId);
    if (user) {
      (request as any).user = user;
      (request as any).userId = userId;
    }
  }
}

/**
 * Require admin role middleware
 * Must be used after authenticate middleware
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = (request as any).user;

  if (!user || user.role !== 'admin') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
}
