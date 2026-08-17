import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({ parse: { provider: 'mock' } }));

vi.mock('../../config.js', () => ({ config: mockConfig }));

const { getParseProvider, resetParseProviderCache } = await import('../index.js');

describe('getParseProvider', () => {
  beforeEach(() => {
    resetParseProviderCache();
    mockConfig.parse.provider = 'mock';
  });

  test('returns the mock provider when PARSE_PROVIDER=mock', () => {
    expect(getParseProvider().id).toBe('mock');
  });

  test('falls back to mock for an unrecognized/unimplemented provider (no adapter until M2-T5b)', () => {
    mockConfig.parse.provider = 'local_vlm';
    expect(getParseProvider().id).toBe('mock');
  });

  test('caches the resolved provider across calls', () => {
    const first = getParseProvider();
    const second = getParseProvider();
    expect(first).toBe(second);
  });
});
