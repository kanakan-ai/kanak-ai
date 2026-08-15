import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  auth: { mode: 'mock' as 'mock' | 'live', sessionSecret: 'x' },
  sms: { provider: 'console' as 'console' | 'sns' },
}));

const createSnsSmsProviderMock = vi.hoisted(() => vi.fn(() => ({ id: 'sns', send: vi.fn() })));

vi.mock('../../config.js', () => ({ config: mockConfig }));
vi.mock('../sns-provider.js', () => ({ createSnsSmsProvider: createSnsSmsProviderMock }));

const { getSmsProvider, resetSmsProviderCache } = await import('../index.js');

describe('getSmsProvider', () => {
  beforeEach(() => {
    resetSmsProviderCache();
    mockConfig.auth.mode = 'mock';
    mockConfig.sms.provider = 'console';
    createSnsSmsProviderMock.mockClear();
  });

  test('always uses the console provider when AUTH_MODE=mock, even if SMS_PROVIDER=sns', () => {
    mockConfig.auth.mode = 'mock';
    mockConfig.sms.provider = 'sns';

    const provider = getSmsProvider();

    expect(provider.id).toBe('console');
    expect(createSnsSmsProviderMock).not.toHaveBeenCalled();
  });

  test('uses SNS when AUTH_MODE=live and SMS_PROVIDER=sns', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.sms.provider = 'sns';

    const provider = getSmsProvider();

    expect(provider.id).toBe('sns');
    expect(createSnsSmsProviderMock).toHaveBeenCalledTimes(1);
  });

  test('falls back to console when AUTH_MODE=live but SMS_PROVIDER is not sns', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.sms.provider = 'console';

    const provider = getSmsProvider();

    expect(provider.id).toBe('console');
    expect(createSnsSmsProviderMock).not.toHaveBeenCalled();
  });

  test('caches the resolved provider across calls', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.sms.provider = 'sns';

    const first = getSmsProvider();
    const second = getSmsProvider();

    expect(first).toBe(second);
    expect(createSnsSmsProviderMock).toHaveBeenCalledTimes(1);
  });
});
