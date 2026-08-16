/**
 * Lightweight email format + common-typo checks, run before ever attempting delivery.
 * Catches the class of error users hit most often (a typo'd domain, e.g. "hotmail.con")
 * which AWS SES itself cannot distinguish from "recipient not verified" — SES returns
 * the same AccessDenied/MessageRejected shape either way (docs/M2-T1-verification.md).
 * Better to catch an obvious typo here than surface a vendor-flavored rejection for it.
 */

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// A handful of well-known major-provider domain typos. Not exhaustive — a bare-minimum
// catch for the most common mistake (adjacent-key/missing-letter TLD typos), not a full
// TLD or MX validator.
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.cmo': 'hotmail.com',
  'hotmail.comm': 'hotmail.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.cmo': 'yahoo.com',
  'yahoo.comm': 'yahoo.com',
  'outlook.con': 'outlook.com',
  'outlook.cmo': 'outlook.com',
  'icloud.con': 'icloud.com',
};

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

export function validateEmailFormat(email: unknown): EmailValidationResult {
  if (!email || typeof email !== 'string' || !EMAIL_FORMAT_REGEX.test(email)) {
    return { valid: false, reason: 'Invalid email address' };
  }

  const atIndex = email.lastIndexOf('@');
  const domain = email.slice(atIndex + 1).toLowerCase();
  const correctDomain = COMMON_DOMAIN_TYPOS[domain];
  if (correctDomain) {
    const suggestion = `${email.slice(0, atIndex + 1)}${correctDomain}`;
    return { valid: false, reason: `That domain looks like a typo. Did you mean ${suggestion}?`, suggestion };
  }

  return { valid: true };
}
