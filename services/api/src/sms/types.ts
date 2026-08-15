/**
 * SMS provider abstraction
 * M2-T2: Pluggable SMS delivery, mirrors the EmailProvider pattern
 * (services/api/src/email/types.ts, itself mirroring design/parse-provider.md) —
 * core auth code depends only on this interface, never on a vendor SDK directly.
 */

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsProvider {
  readonly id: string;
  send(message: SmsMessage): Promise<void>;
}

/**
 * Provider-agnostic delivery failure. Adapters translate vendor-specific errors
 * into this shape so callers never need vendor knowledge — same boundary rule
 * as design/parse-provider.md §"Agent rules" and email/types.ts.
 */
export type SmsDeliveryErrorReason = 'recipient_rejected' | 'credentials_invalid' | 'unknown';

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly reason: SmsDeliveryErrorReason = 'unknown'
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}
