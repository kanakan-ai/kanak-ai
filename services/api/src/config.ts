/**
 * Kanak AI API — Configuration
 * M1-T1: Basic config loader; will expand with auth, storage, etc. in later tasks
 */

export interface Config {
  env: string;
  port: number;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  minio: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
  auth: {
    // 'live' matches design/TECH_STACK.md and design/m2-capabilities.md's AUTH_MODE contract.
    mode: 'mock' | 'live';
    sessionSecret: string;
  };
  email: {
    provider: 'console' | 'ses';
    fromAddress: string;
  };
  sms: {
    provider: 'console' | 'sns';
  };
  documents: {
    // Days a 'needs_review' or 'failed' document may sit unresolved before the
    // retention worker removes it (storage object + row). See services/document-retention.ts.
    retentionDays: number;
  };
  parse: {
    // design/parse-provider.md: gemini|claude|grok|local_vlm|mock. Only 'mock' is
    // implemented in M2-T5a; anything else currently falls back to mock (see parse/index.ts).
    provider: string;
  };
  adminEmails: string[];
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

export const config: Config = {
  env: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '8080'), 10),
  database: {
    url: getEnv('DATABASE_URL'),
  },
  redis: {
    url: getEnv('REDIS_URL'),
  },
  minio: {
    endpoint: getEnv('MINIO_ENDPOINT'),
    port: parseInt(getEnv('MINIO_PORT', '9000'), 10),
    useSSL: getEnv('MINIO_USE_SSL', 'false') === 'true',
    accessKey: getEnv('MINIO_ACCESS_KEY'),
    secretKey: getEnv('MINIO_SECRET_KEY'),
    bucket: getEnv('MINIO_BUCKET', 'kanak-documents'),
  },
  auth: {
    mode: getEnv('AUTH_MODE', 'mock') as 'mock' | 'live',
    sessionSecret: getEnv('SESSION_SECRET'),
  },
  email: {
    provider: getEnv('EMAIL_PROVIDER', 'console') as 'console' | 'ses',
    fromAddress: getEnv('SES_FROM_EMAIL', ''),
  },
  sms: {
    provider: getEnv('SMS_PROVIDER', 'console') as 'console' | 'sns',
  },
  documents: {
    retentionDays: parseInt(getEnv('DOCUMENT_RETENTION_DAYS', '14'), 10),
  },
  parse: {
    provider: getEnv('PARSE_PROVIDER', 'mock'),
  },
  // M1-T6: emails in this list get role='admin' on first sign-in, for local admin ops dashboard access.
  // Admin console must never be linked from customer UI (STEERING.md rule 7).
  adminEmails: getEnv('ADMIN_EMAILS', '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};
