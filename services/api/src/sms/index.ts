/**
 * SMS provider registry.
 * Adding a provider = new adapter file + registration here; zero changes
 * to services/auth.ts (design/parse-provider.md agent rules, applied to SMS).
 */

import { config } from '../config.js';
import { consoleSmsProvider } from './console-provider.js';
import { createSnsSmsProvider } from './sns-provider.js';
import type { SmsProvider } from './types.js';

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;

  // Mock auth mode never sends a real SMS, regardless of SMS_PROVIDER —
  // keeps CI/local mock runs deterministic and side-effect-free.
  if (config.auth.mode === 'mock') {
    cached = consoleSmsProvider;
    return cached;
  }

  if (config.sms.provider === 'sns') {
    cached = createSnsSmsProvider();
    return cached;
  }

  cached = consoleSmsProvider;
  return cached;
}

/** Test-only: clear the cached provider so config changes take effect. */
export function resetSmsProviderCache(): void {
  cached = null;
}

export { SmsDeliveryError } from './types.js';
export type { SmsProvider, SmsMessage } from './types.js';
