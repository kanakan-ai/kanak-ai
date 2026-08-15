/**
 * AWS SES email provider — live delivery for AUTH_MODE=live.
 * Credentials resolve via the standard AWS SDK provider chain
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION env vars, or an
 * IAM role) — never hard-coded and never read directly by this module.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailDeliveryError } from './types.js';
import type { EmailProvider, EmailMessage } from './types.js';

// SES surfaces "recipient not verified" (sandbox mode) through the same
// authorization-style error as a genuine IAM permission gap — AWS itself
// doesn't distinguish them, so neither can we. Both mean "this specific
// recipient could not be sent to," which is the actionable distinction for
// the caller (see docs/M2-T1-verification.md "Known non-bug failure mode").
const RECIPIENT_REJECTED_ERROR_NAMES = new Set(['AccessDenied', 'MessageRejected']);

// The AWS credentials themselves are wrong, unrecognized, or expired — a
// config problem, not a per-recipient one. Distinct dev hint from the above.
const CREDENTIALS_INVALID_ERROR_NAMES = new Set([
  'ExpiredToken',
  'ExpiredTokenException',
  'InvalidClientTokenId',
  'UnrecognizedClientException',
  'AuthFailure',
  'SignatureDoesNotMatch',
]);

export function createSesEmailProvider(fromAddress: string): EmailProvider {
  const client = new SESClient({});

  return {
    id: 'ses',
    async send(message: EmailMessage): Promise<void> {
      try {
        await client.send(
          new SendEmailCommand({
            Source: fromAddress,
            Destination: { ToAddresses: [message.to] },
            Message: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: message.text, Charset: 'UTF-8' },
                ...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}),
              },
            },
          })
        );
      } catch (error) {
        const name = error instanceof Error ? error.name : undefined;
        if (name && RECIPIENT_REJECTED_ERROR_NAMES.has(name)) {
          throw new EmailDeliveryError(
            `SES rejected recipient ${message.to} (${name})`,
            'recipient_rejected'
          );
        }
        if (name && CREDENTIALS_INVALID_ERROR_NAMES.has(name)) {
          throw new EmailDeliveryError(`SES rejected the configured AWS credentials (${name})`, 'credentials_invalid');
        }
        throw error;
      }
    },
  };
}
