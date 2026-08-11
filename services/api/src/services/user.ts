/**
 * User service
 * M1-T2: User CRUD operations
 */

import { query } from '../lib/db.js';
import type { User, UserProfile, IdentityChannel, AuthIdentity } from '../types/auth.js';

/**
 * Find user by auth identity (email, phone, or apple)
 */
export async function findUserByIdentity(
  channel: IdentityChannel,
  identifier: string
): Promise<(User & { identities: AuthIdentity[] }) | null> {
  const result = await query<User & { identities: string }>(
    `
    SELECT 
      u.*,
      json_agg(json_build_object(
        'id', ai.id,
        'user_id', ai.user_id,
        'channel', ai.channel,
        'identifier', ai.identifier,
        'verified_at', ai.verified_at,
        'created_at', ai.created_at
      )) as identities
    FROM users u
    JOIN auth_identities ai ON u.id = ai.user_id
    WHERE ai.channel = $1 AND ai.identifier = $2
    AND u.deleted_at IS NULL
    GROUP BY u.id
    `,
    [channel, identifier]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    ...row,
    identities: JSON.parse(row.identities as unknown as string),
  };
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Create a new user with auth identity
 */
export async function createUser(
  channel: IdentityChannel,
  identifier: string
): Promise<User> {
  // Start transaction
  const userResult = await query<User>(
    `INSERT INTO users (plan, role) VALUES ('free', 'customer') RETURNING *`
  );

  const user = userResult.rows[0];

  // Create auth identity
  await query(
    `
    INSERT INTO auth_identities (user_id, channel, identifier, verified_at)
    VALUES ($1, $2, $3, NOW())
    `,
    [user.id, channel, identifier]
  );

  return user;
}

/**
 * Get all auth identities for a user
 */
export async function getUserIdentities(userId: string): Promise<AuthIdentity[]> {
  const result = await query<AuthIdentity>(
    `SELECT * FROM auth_identities WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Convert database User to API UserProfile
 */
export function toUserProfile(user: User, identities: AuthIdentity[]): UserProfile {
  const emailIdentity = identities.find((i) => i.channel === 'email');
  const phoneIdentity = identities.find((i) => i.channel === 'phone');
  const appleIdentity = identities.find((i) => i.channel === 'apple');

  return {
    id: user.id,
    email: emailIdentity?.identifier,
    phone: phoneIdentity?.identifier,
    appleLinked: !!appleIdentity,
    plan: user.plan,
    role: user.role,
    darkMode: user.dark_mode,
    pushEnabled: user.push_enabled,
    weeklyDigest: user.weekly_digest,
    createdAt: user.created_at.toISOString(),
  };
}
