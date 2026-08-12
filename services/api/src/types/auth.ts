/**
 * Type definitions for auth and user data
 * M1-T2: Core types matching database schema and OpenAPI spec
 * M1-T3: AuthenticatedRequest for protected endpoints
 */

import type { FastifyRequest } from 'fastify';

export type PlanTier = 'free' | 'pro' | 'platinum';
export type UserRole = 'customer' | 'admin';
export type IdentityChannel = 'email' | 'phone' | 'apple';

export interface User {
  id: string;
  plan: PlanTier;
  role: UserRole;
  display_name: string | null;
  dark_mode: boolean;
  push_enabled: boolean;
  weekly_digest: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AuthIdentity {
  id: string;
  user_id: string;
  channel: IdentityChannel;
  identifier: string;
  verified_at: Date;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  user_agent: string | null;
  created_at: Date;
}

export interface OtpChallenge {
  id: string;
  channel: IdentityChannel;
  identifier: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

/**
 * API response types (matching OpenAPI spec)
 */
export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  appleLinked: boolean;
  plan: PlanTier;
  role: UserRole;
  darkMode: boolean;
  pushEnabled: boolean;
  weeklyDigest: boolean;
  createdAt: string;
}

export interface SessionResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: UserProfile;
}

export interface OtpStartResponse {
  status: 'sent' | 'mock';
  channel: 'sms' | 'email';
  expiresInSeconds: number;
  devHint?: string;
}

/**
 * Authenticated request type (M1-T3)
 * Used for protected routes that require authentication
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: User & {
    email?: string;
    phone?: string;
  };
  userId: string;
}
