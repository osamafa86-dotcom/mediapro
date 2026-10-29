/*
 * The bucket's CORS policy (deploy/vps/r2-cors.json — the one place it is written), then a round trip
 * (put, get, delete a tiny object) so a wrong key or endpoint shows here, not at the first upload.
 * Creates the bucket only where that is allowed (MinIO/moto in development and CI); an R2 token scoped
 * to one bucket may not create buckets, and that is fine.
 *   S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… APP_ORIGIN=… node scripts/s3-setup.mjs
 */
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? 'auto', forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const Bucket = process.env.S3_BUCKET;
await s3.send(new CreateBucketCommand({ Bucket })).catch((e) => {
  if (!/BucketAlready|AccessDenied/.test(e.name)) throw e;
});
const rules = JSON.parse(readFileSync(resolve(process.cwd(), 'deploy/vps/r2-cors.json'), 'utf8'));
rules[0].AllowedOrigins = [process.env.APP_ORIGIN];
await s3.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }));
const Key = `${(process.env.S3_PREFIX ?? 'media-library/').replace(/^\/+/, '')}.setup-check-${Date.now()}`;
await s3.send(new PutObjectCommand({ Bucket, Key, Body: 'ok' }));
const back = await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToString();
await s3.send(new DeleteObjectCommand({ Bucket, Key }));
if (back !== 'ok') throw new Error('round trip returned something else');
console.log(`bucket ${Bucket}: CORS for ${process.env.APP_ORIGIN} (ExposeHeaders ETag), round trip ok`);
