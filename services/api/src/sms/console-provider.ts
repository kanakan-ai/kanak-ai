/**
 * Console SMS provider — logs instead of delivering.
 * Always used when AUTH_MODE=mock (spec: "Mock = CI-only"), regardless of
 * SMS_PROVIDER, so automated/CI runs never have a real-delivery side effect.
 */

import type { SmsProvider, SmsMessage } from './types.js';

export const consoleSmsProvider: SmsProvider = {
  id: 'console',
  async send(message: SmsMessage): Promise<void> {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 CONSOLE SMS PROVIDER (not delivered — set AUTH_MODE=live and
   SMS_PROVIDER=sns for real delivery)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: ${message.to}

${message.body}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  },
};
