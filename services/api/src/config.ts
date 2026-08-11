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
    mode: 'mock' | 'real';
    sessionSecret: string;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
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
    mode: getEnv('AUTH_MODE', 'mock') as 'mock' | 'real',
    sessionSecret: getEnv('SESSION_SECRET'),
  },
};
