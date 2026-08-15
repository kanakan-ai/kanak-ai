/**
 * AWS SNS SMS provider — live delivery for AUTH_MODE=live.
 * Credentials resolve via the standard AWS SDK provider chain
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION env vars, or an
 * IAM role) — never hard-coded and never read directly by this module.
 * Reuses the same AWS credentials as the SES email provider (M2-T1).
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SmsDeliveryError } from './types.js';
import type { SmsProvider, SmsMessage } from './types.js';

// New AWS accounts start SNS SMS in a spending-limit sandbox and some regions
// require an origination identity; both surface as an authorization-style
// rejection tied to the specific destination number, same ambiguity as SES's
// sandbox-vs-permissions overlap (design/parse-provider.md "Agent rules";
// docs/M2-T1-verification.md "Known non-bug failure mode").
const RECIPIENT_REJECTED_ERROR_NAMES = new Set(['AuthorizationErrorException', 'OptedOutException']);

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

export function createSnsSmsProvider(): SmsProvider {
  const client = new SNSClient({});

  return {
    id: 'sns',
    async send(message: SmsMessage): Promise<void> {
      try {
        await client.send(
          new PublishCommand({
            PhoneNumber: message.to,
            Message: message.body,
            MessageAttributes: {
              'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
            },
          })
        );
      } catch (error) {
        const name = error instanceof Error ? error.name : undefined;
        if (name && RECIPIENT_REJECTED_ERROR_NAMES.has(name)) {
          throw new SmsDeliveryError(
            `SNS rejected recipient ${message.to} (${name})`,
            'recipient_rejected'
          );
        }
        if (name && CREDENTIALS_INVALID_ERROR_NAMES.has(name)) {
          throw new SmsDeliveryError(`SNS rejected the configured AWS credentials (${name})`, 'credentials_invalid');
        }
        throw error;
      }
    },
  };
}
