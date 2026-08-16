/**
 * Auth routes
 * M1-T2: Email OTP/magic link authentication endpoints
 */

import type { FastifyInstance } from 'fastify';
import { startEmailOtp, verifyEmailOtp, startPhoneOtp, verifyOtp } from '../services/auth.js';
import { config } from '../config.js';
import { createSession, revokeSession } from '../services/session.js';
import { findUserByIdentity, findUserById, createUser, getUserIdentities, toUserProfile } from '../services/user.js';
import type { SessionResponse, OtpStartResponse, User } from '../types/auth.js';
import { authenticate } from '../middleware/auth.js';
import { recordEvent } from '../services/analytics.js';
import { EmailDeliveryError } from '../email/index.js';
import { SmsDeliveryError } from '../sms/index.js';
import { validateEmailFormat } from '../lib/email-validation.js';

/**
 * Customer-facing hint, shown in every environment — no vendor/infra details, ever.
 * A rejected recipient is, from a real customer's point of view, most often their
 * own typo (see the recipient_rejected case hit during M2 verification: a mistyped
 * TLD that AWS SES itself reports identically to "account still in sandbox"). The
 * full underlying reason (vendor, error name, sandbox vs. credentials) is logged via
 * request.log.error below — check `docker-compose logs api` for that detail; it is
 * intentionally never returned to the caller, in dev or prod.
 */
function emailUserHint(error: unknown): string {
  if (error instanceof EmailDeliveryError && error.reason === 'recipient_rejected') {
    return ' Double-check that the email address is correct, then try again.';
  }
  return '';
}

/** Customer-facing hint, shown in every environment — no vendor/infra details, ever. */
function smsUserHint(error: unknown): string {
  if (error instanceof SmsDeliveryError && error.reason === 'recipient_rejected') {
    return ' Double-check that the phone number is correct, then try again.';
  }
  return '';
}

export async function authRoutes(app: FastifyInstance) {
  async function issueSession(channel: 'email' | 'phone' | 'apple', identifier: string, userAgent?: string): Promise<SessionResponse> {
    const existingUser = await findUserByIdentity(channel, identifier);
    let user: User | null = existingUser;
    if (!existingUser) {
      const created = await createUser(channel, identifier);
      user = await findUserById(created.id);
    }
    if (!user) throw new Error('Failed to load user');
    const identities = await getUserIdentities(user.id);
    const session = await createSession(user.id, userAgent);
    await recordEvent({ userId: user.id, event: 'auth_sign_in_success', properties: { auth_channel: channel } });
    return { accessToken: session.token, tokenType: 'Bearer', expiresInSeconds: session.expiresInSeconds, user: toUserProfile(user, identities) };
  }

  app.post<{ Body: { phone: string } }>('/auth/phone/start', async (request, reply) => {
    const phone = request.body?.phone?.trim();
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) return reply.code(400).send({ error: 'Bad Request', message: 'Phone must be in E.164 format, for example +15551234567' });
    try {
      const result = await startPhoneOtp(phone);
      const response: OtpStartResponse = { status: result.devHint ? 'mock' : 'sent', channel: 'sms', expiresInSeconds: result.expiresInSeconds, ...(result.devHint && { devHint: result.devHint }) };
      return reply.send(response);
    } catch (error) { request.log.error(error, 'Failed to start phone OTP'); return reply.code(500).send({ error: 'Internal Server Error', message: `Failed to send verification code.${smsUserHint(error)}` }); }
  });

  app.post<{ Body: { phone: string; code: string } }>('/auth/phone/verify', async (request, reply) => {
    const phone = request.body?.phone?.trim(); const code = request.body?.code;
    if (!phone || !code) return reply.code(400).send({ error: 'Bad Request', message: 'Phone and code are required' });
    try {
      if (!await verifyOtp('phone', phone, code)) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired verification code' });
      return reply.send(await issueSession('phone', phone, request.headers['user-agent']));
    } catch (error) { request.log.error(error, 'Failed to verify phone OTP'); return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to verify code' }); }
  });

  app.post<{ Body: { identityToken: string; fullName?: string } }>('/auth/apple', async (request, reply) => {
    const identityToken = request.body?.identityToken;
    if (!identityToken) return reply.code(401).send({ error: 'Unauthorized', message: 'Apple identity token is required' });
    // Real Apple JWT verification requires configured Apple keys; M1 accepts explicit mock identities only.
    if (config.auth.mode !== 'mock' || !identityToken.startsWith('mock-apple-')) return reply.code(401).send({ error: 'Unauthorized', message: 'Apple sign-in is not configured' });
    try { return reply.send(await issueSession('apple', identityToken, request.headers['user-agent'])); }
    catch (error) { request.log.error(error, 'Failed Apple sign-in'); return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to sign in with Apple' }); }
  });
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

    // Format + common-typo check, before ever attempting delivery — catches the class of
    // mistake (e.g. "hotmail.con") that AWS SES itself can't distinguish from "recipient
    // not verified" (see docs/M2-T1-verification.md).
    const emailCheck = validateEmailFormat(email);
    if (!emailCheck.valid) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: emailCheck.reason,
        ...(emailCheck.suggestion && { suggestion: emailCheck.suggestion }),
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
      // Generic message for all callers (never leak vendor/infra detail to a real user —
      // this genuinely could just mean the address is unreachable). A dev-only hint is
      // appended outside production so local testing doesn't have to read container logs
      // to learn "this is SES sandbox mode" vs "the AWS credentials expired," per
      // docs/M2-T1-verification.md.
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: `Failed to send verification email.${emailUserHint(error)}`,
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
      await recordEvent({ userId, event: 'auth_sign_in_success', properties: { auth_channel: 'email' } });

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
