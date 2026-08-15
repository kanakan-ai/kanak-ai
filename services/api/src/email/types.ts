/**
 * Email provider abstraction
 * M2-T1: Pluggable email delivery, mirrors the ParseProvider pattern
 * (design/parse-provider.md) — core auth code depends only on this
 * interface, never on a vendor SDK directly.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Provider-agnostic delivery failure. Adapters translate vendor-specific errors
 * (e.g. AWS SES's AccessDenied/MessageRejected for an unverified recipient while
 * in sandbox mode) into this shape so callers never need vendor knowledge —
 * same boundary rule as design/parse-provider.md §"Agent rules".
 */
export type EmailDeliveryErrorReason = 'recipient_rejected' | 'credentials_invalid' | 'unknown';

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly reason: EmailDeliveryErrorReason = 'unknown'
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
