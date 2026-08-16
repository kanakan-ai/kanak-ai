import { describe, test, expect } from 'vitest';
import { daysUntilRemoval, isPastRetention } from '../document-retention.js';

describe('daysUntilRemoval', () => {
  const now = new Date('2026-08-16T00:00:00Z');

  test('returns the full retention window right after the update', () => {
    expect(daysUntilRemoval(now, 14, now)).toBe(14);
  });

  test('counts down as time passes', () => {
    const updatedAt = new Date('2026-08-10T00:00:00Z'); // 6 days ago
    expect(daysUntilRemoval(updatedAt, 14, now)).toBe(8);
  });

  test('reaches zero exactly at the retention boundary', () => {
    const updatedAt = new Date('2026-08-02T00:00:00Z'); // exactly 14 days ago
    expect(daysUntilRemoval(updatedAt, 14, now)).toBe(0);
  });

  test('goes negative once overdue', () => {
    const updatedAt = new Date('2026-07-01T00:00:00Z'); // 46 days ago
    expect(daysUntilRemoval(updatedAt, 14, now)).toBeLessThan(0);
  });
});

describe('isPastRetention', () => {
  const now = new Date('2026-08-16T00:00:00Z');

  test('false when within the window', () => {
    const updatedAt = new Date('2026-08-10T00:00:00Z');
    expect(isPastRetention(updatedAt, 14, now)).toBe(false);
  });

  test('true once past the window', () => {
    const updatedAt = new Date('2026-07-01T00:00:00Z');
    expect(isPastRetention(updatedAt, 14, now)).toBe(true);
  });

  test('true exactly at the boundary (inclusive)', () => {
    const updatedAt = new Date('2026-08-02T00:00:00Z');
    expect(isPastRetention(updatedAt, 14, now)).toBe(true);
  });
});
