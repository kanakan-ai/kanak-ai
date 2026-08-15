/**
 * Console email provider — logs instead of delivering.
 * Always used when AUTH_MODE=mock (spec: "Mock = CI-only"), regardless of
 * EMAIL_PROVIDER, so automated/CI runs never have a real-delivery side effect.
 */

import type { EmailProvider, EmailMessage } from './types.js';

export const consoleEmailProvider: EmailProvider = {
  id: 'console',
  async send(message: EmailMessage): Promise<void> {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 CONSOLE EMAIL PROVIDER (not delivered — set AUTH_MODE=live and
   EMAIL_PROVIDER=ses for real delivery)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: ${message.to}
Subject: ${message.subject}

${message.text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  },
};
