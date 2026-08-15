import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  auth: { mode: 'mock' as 'mock' | 'live', sessionSecret: 'x' },
  email: { provider: 'console' as 'console' | 'ses', fromAddress: 'kanak@example.com' },
}));

const createSesEmailProviderMock = vi.hoisted(() =>
  vi.fn((fromAddress: string) => ({ id: 'ses', send: vi.fn(), fromAddress }))
);

vi.mock('../../config.js', () => ({ config: mockConfig }));
vi.mock('../ses-provider.js', () => ({ createSesEmailProvider: createSesEmailProviderMock }));

const { getEmailProvider, resetEmailProviderCache } = await import('../index.js');

describe('getEmailProvider', () => {
  beforeEach(() => {
    resetEmailProviderCache();
    mockConfig.auth.mode = 'mock';
    mockConfig.email.provider = 'console';
    createSesEmailProviderMock.mockClear();
  });

  test('always uses the console provider when AUTH_MODE=mock, even if EMAIL_PROVIDER=ses', () => {
    mockConfig.auth.mode = 'mock';
    mockConfig.email.provider = 'ses';

    const provider = getEmailProvider();

    expect(provider.id).toBe('console');
    expect(createSesEmailProviderMock).not.toHaveBeenCalled();
  });

  test('uses SES when AUTH_MODE=live and EMAIL_PROVIDER=ses', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.email.provider = 'ses';

    const provider = getEmailProvider();

    expect(provider.id).toBe('ses');
    expect(createSesEmailProviderMock).toHaveBeenCalledWith('kanak@example.com');
  });

  test('falls back to console when AUTH_MODE=live but EMAIL_PROVIDER is not ses', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.email.provider = 'console';

    const provider = getEmailProvider();

    expect(provider.id).toBe('console');
    expect(createSesEmailProviderMock).not.toHaveBeenCalled();
  });

  test('caches the resolved provider across calls', () => {
    mockConfig.auth.mode = 'live';
    mockConfig.email.provider = 'ses';

    const first = getEmailProvider();
    const second = getEmailProvider();

    expect(first).toBe(second);
    expect(createSesEmailProviderMock).toHaveBeenCalledTimes(1);
  });
});
