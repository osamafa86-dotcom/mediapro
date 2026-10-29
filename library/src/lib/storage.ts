import 'server-only';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/* R2 in production, MinIO locally — both speak the S3 API. Credentials only from the environment. */

declare global { var __mediaS3: S3Client | undefined }

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see docs/deploy.md)`);
  return v;
}

export function s3(): S3Client {
  globalThis.__mediaS3 ??= new S3Client({
    endpoint: need('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: need('S3_ACCESS_KEY_ID'), secretAccessKey: need('S3_SECRET_ACCESS_KEY') },
  });
  return globalThis.__mediaS3;
}

export const bucket = () => need('S3_BUCKET');

/** Short-lived signed GET. Only callers that passed asset authorization may reach this (never a guest). */
export async function presignGet(key: string, opts: { filename?: string; seconds?: number } = {}) {
  const cmd = new GetObjectCommand({
    Bucket: bucket(), Key: key,
    ResponseContentDisposition: opts.filename ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.filename)}` : undefined,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: opts.seconds ?? 3600 });
}

export type StorageStatus = { state: 'unconfigured' } | { state: 'connected'; bucket: string } | { state: 'error'; bucket: string };
let statusCache: { at: number; v: StorageStatus } | null = null;

/** Is the bucket reachable? HeadBucket with a 3 s timeout, remembered for a minute. */
export async function storageStatus(): Promise<StorageStatus> {
  if (!process.env.S3_ENDPOINT || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) return { state: 'unconfigured' };
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.v;
  const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const b = bucket();
  let v: StorageStatus;
  try {
    await s3().send(new HeadBucketCommand({ Bucket: b }), { abortSignal: AbortSignal.timeout(3000) });
    v = { state: 'connected', bucket: b };
  } catch {
    v = { state: 'error', bucket: b };
  }
  statusCache = { at: Date.now(), v };
  return v;
}
