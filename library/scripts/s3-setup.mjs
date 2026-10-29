/*
 * Create the bucket and set its CORS policy (the same policy the owner sets on R2 — docs/deploy.md).
 * Used for local MinIO/moto and in CI. Origins come from APP_ORIGIN.
 *   S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… APP_ORIGIN=… node scripts/s3-setup.mjs
 */
import { CreateBucketCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? 'auto', forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const Bucket = process.env.S3_BUCKET;
await s3.send(new CreateBucketCommand({ Bucket })).catch((e) => { if (!/BucketAlready/.test(e.name)) throw e; });
const rules = JSON.parse(readFileSync(new URL('../tests/e2e/fixtures/r2-cors.json', import.meta.url), 'utf8'));
rules[0].AllowedOrigins = [process.env.APP_ORIGIN];
await s3.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }));
console.log(`bucket ${Bucket} ready, CORS for ${process.env.APP_ORIGIN}`);
