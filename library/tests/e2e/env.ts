import { resolve } from 'node:path';

export const PORT = Number(process.env.E2E_PORT ?? 3100);
export const ORIGIN = `http://127.0.0.1:${PORT}`;

/** Test-only values (never used anywhere else). Production secrets live on the server only. */
export const E2E_ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://media:media@127.0.0.1:5432/media_test',
  SESSION_SECRET: 'e2e-only-session-secret-not-for-production-0001',
  LINK_SIGNING_SECRET: 'e2e-only-link-secret-not-for-production-000002',
  APP_ORIGIN: ORIGIN,
  MAIL_DIR: resolve(process.cwd(), 'test-results/mail'),
  S3_ENDPOINT: 'http://127.0.0.1:9000', S3_REGION: 'auto', S3_BUCKET: 'e2e', S3_ACCESS_KEY_ID: 'e2e', S3_SECRET_ACCESS_KEY: 'e2e-secret',
};
