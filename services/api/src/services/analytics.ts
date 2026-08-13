/**
 * Analytics service
 * M1-T6: Privacy-safe product event ingestion + ops/admin queries
 *
 * Contract note: mirrors design/api/openapi.yaml `AnalyticsEvent` /
 * `EventBatchRequest` (POST /v1/events) plus a new admin-only read model
 * (`GET /v1/admin/ops-summary`) that is not yet reflected in openapi.yaml —
 * see routes/admin.ts for the response shape.
 */

import { query } from '../lib/db.js';
import { config } from '../config.js';

export const ALLOWED_CLIENTS = ['web', 'ios', 'android'] as const;
export type AnalyticsClient = (typeof ALLOWED_CLIENTS)[number];

export type AnalyticsEnv = 'local' | 'staging' | 'prod';

export interface AnalyticsEventInput {
  event: string;
  sessionId?: string | null;
  client?: string;
  appVersion?: string | null;
  occurredAt?: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsEventRecord {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event: string;
  client: string;
  app_version: string | null;
  env: string;
  properties: Record<string, unknown>;
  occurred_at: string;
  received_at: string;
}

/** Maps NODE_ENV to the analytics_events.env taxonomy (metrics.md §6). */
export function currentAnalyticsEnv(): AnalyticsEnv {
  if (config.env === 'production') return 'prod';
  if (config.env === 'staging') return 'staging';
  return 'local';
}

/** Validates a single event against the OpenAPI AnalyticsEvent shape. Returns an error message, or null if valid. */
export function validateEvent(input: AnalyticsEventInput): string | null {
  if (!input || typeof input.event !== 'string' || !input.event.trim()) {
    return 'event is required';
  }
  if (input.event.length > 120) {
    return 'event must be 120 characters or fewer';
  }
  if (input.client !== undefined && !ALLOWED_CLIENTS.includes(input.client as AnalyticsClient)) {
    return `client must be one of: ${ALLOWED_CLIENTS.join(', ')}`;
  }
  if (input.properties !== undefined && (typeof input.properties !== 'object' || input.properties === null || Array.isArray(input.properties))) {
    return 'properties must be an object';
  }
  if (input.occurredAt !== undefined && Number.isNaN(Date.parse(input.occurredAt))) {
    return 'occurredAt must be a valid ISO-8601 timestamp';
  }
  return null;
}

/** Server-side write, used both by POST /v1/events and by trust-path server emitters (auth, upload). */
export async function recordEvent(
  input: AnalyticsEventInput & { userId?: string | null }
): Promise<void> {
  await query(
    `INSERT INTO analytics_events (user_id, session_id, event, client, app_version, env, properties, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, COALESCE($8, now()))`,
    [
      input.userId ?? null,
      input.sessionId ?? null,
      input.event,
      input.client ?? 'web',
      input.appVersion ?? null,
      currentAnalyticsEnv(),
      JSON.stringify(input.properties ?? {}),
      input.occurredAt ? new Date(input.occurredAt) : null,
    ]
  );
}

export async function recordEvents(userId: string | null, events: AnalyticsEventInput[]): Promise<void> {
  for (const event of events) {
    await recordEvent({ ...event, userId });
  }
}

/** Most recent occurrences of one event, joined to the user's first identifier for admin display. */
export async function recentEvents(eventName: string, limit = 10): Promise<Array<AnalyticsEventRecord & { user_identifier: string | null }>> {
  const result = await query<AnalyticsEventRecord & { user_identifier: string | null }>(
    `SELECT ae.id, ae.user_id, ae.session_id, ae.event, ae.client, ae.app_version, ae.env,
            ae.properties, ae.occurred_at, ae.received_at, ai.identifier AS user_identifier
     FROM analytics_events ae
     LEFT JOIN LATERAL (
       SELECT identifier FROM auth_identities WHERE user_id = ae.user_id ORDER BY created_at ASC LIMIT 1
     ) ai ON true
     WHERE ae.event = $1
     ORDER BY ae.occurred_at DESC
     LIMIT $2`,
    [eventName, limit]
  );
  return result.rows;
}

export async function eventCountSince(eventName: string, since: Date): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM analytics_events WHERE event = $1 AND occurred_at >= $2`,
    [eventName, since]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

/** Per-day counts for the given events over the trailing window, for simple time-series charts. */
export async function dailyEventCounts(
  eventNames: string[],
  days = 7
): Promise<Array<{ day: string; event: string; count: number }>> {
  const result = await query<{ day: string; event: string; count: string }>(
    `SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day, event, COUNT(*)::text AS count
     FROM analytics_events
     WHERE event = ANY($1) AND occurred_at >= NOW() - ($2 || ' days')::interval
     GROUP BY 1, 2
     ORDER BY 1 ASC`,
    [eventNames, days]
  );
  return result.rows.map((row) => ({ day: row.day, event: row.event, count: parseInt(row.count, 10) }));
}
