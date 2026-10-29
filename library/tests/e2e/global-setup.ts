import { CreateBucketCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { E2E_ENV } from './env';

/** The test bucket gets the same CORS policy the owner sets on R2 (tests/e2e/fixtures/r2-cors.json). */
export default async function globalSetup() {
  const s3 = new S3Client({
    endpoint: E2E_ENV.S3_ENDPOINT, region: E2E_ENV.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY },
  });
  try {
    await s3.send(new CreateBucketCommand({ Bucket: E2E_ENV.S3_BUCKET })).catch((e: Error) => { if (!/BucketAlready/.test(e.name)) throw e; });
    const rules = JSON.parse(readFileSync(new URL('./fixtures/r2-cors.json', import.meta.url), 'utf8'));
    rules[0].AllowedOrigins = [E2E_ENV.APP_ORIGIN];
    await s3.send(new PutBucketCorsCommand({ Bucket: E2E_ENV.S3_BUCKET, CORSConfiguration: { CORSRules: rules } }));
  } catch (e) {
    throw new Error(`S3 test server not reachable at ${E2E_ENV.S3_ENDPOINT} — start it first (docs/testing.md): ${(e as Error).message}`);
  }
}
