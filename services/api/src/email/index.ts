/**
 * Email provider registry.
 * Adding a provider = new adapter file + registration here; zero changes
 * to services/auth.ts (design/parse-provider.md agent rules, applied to email).
 */

import { config } from '../config.js';
import { consoleEmailProvider } from './console-provider.js';
import { createSesEmailProvider } from './ses-provider.js';
import type { EmailProvider } from './types.js';

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  // Mock auth mode never sends real email, regardless of EMAIL_PROVIDER —
  // keeps CI/local mock runs deterministic and side-effect-free.
  if (config.auth.mode === 'mock') {
    cached = consoleEmailProvider;
    return cached;
  }

  if (config.email.provider === 'ses') {
    cached = createSesEmailProvider(config.email.fromAddress);
    return cached;
  }

  cached = consoleEmailProvider;
  return cached;
}

/** Test-only: clear the cached provider so config changes take effect. */
export function resetEmailProviderCache(): void {
  cached = null;
}

export { EmailDeliveryError } from './types.js';
export type { EmailProvider, EmailMessage } from './types.js';
