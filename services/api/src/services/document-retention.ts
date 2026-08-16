/**
 * Retention policy for unresolved documents (M2-T4 follow-up).
 * A document that was uploaded via a confirmed type-mismatch override sits as
 * 'needs_review' and is never picked up by the parse worker — this defines when
 * it (or a genuinely 'failed' document) is stale enough to be removed automatically.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days remaining before removal; 0 or negative means it's due (or overdue). */
export function daysUntilRemoval(updatedAt: Date, retentionDays: number, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - updatedAt.getTime();
  const remainingMs = retentionDays * MS_PER_DAY - elapsedMs;
  return Math.ceil(remainingMs / MS_PER_DAY);
}

export function isPastRetention(updatedAt: Date, retentionDays: number, now: Date = new Date()): boolean {
  return daysUntilRemoval(updatedAt, retentionDays, now) <= 0;
}
