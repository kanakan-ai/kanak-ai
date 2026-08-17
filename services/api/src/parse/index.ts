/**
 * ParseProvider registry.
 * Adding a provider = new adapter file + registration here; zero changes to the parse
 * worker or document-type modules (design/parse-provider.md agent rules), same pattern
 * as services/api/src/email/ and services/api/src/sms/.
 */

import { config } from '../config.js';
import { mockParseProvider } from './mock-provider.js';
import type { ParseProvider } from './types.js';

let cached: ParseProvider | null = null;

export function getParseProvider(): ParseProvider {
  if (cached) return cached;

  if (config.parse.provider === 'mock') {
    cached = mockParseProvider;
    return cached;
  }

  // No other provider registered yet (M2-T5b adds the local Ollama/Qwen2.5-VL adapter).
  // Unrecognized/unset config falls back to mock rather than failing the worker outright.
  cached = mockParseProvider;
  return cached;
}

/** Test-only: clear the cached provider so config changes take effect. */
export function resetParseProviderCache(): void {
  cached = null;
}

export type { ParseProvider, ParseInput, ParseOutput, ParseField, ParseDenormalized } from './types.js';
