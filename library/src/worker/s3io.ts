import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

/* The worker's own S3 access (it runs outside Next, so it cannot import the server-only modules). */

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let client: S3Client | undefined;
export function s3() {
  client ??= new S3Client({
    endpoint: need('S3_ENDPOINT'), region: process.env.S3_REGION ?? 'auto', forcePathStyle: true,
    credentials: { accessKeyId: need('S3_ACCESS_KEY_ID'), secretAccessKey: need('S3_SECRET_ACCESS_KEY') },
  });
  return client;
}
export const bucket = () => need('S3_BUCKET');
export const prefix = () => (process.env.S3_PREFIX ?? 'media-library/').replace(/^\/+/, '');

/** Stream an object to a local file (originals can be many GB — never buffered whole). */
export async function download(key: string, path: string) {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  await pipeline(r.Body as Readable, createWriteStream(path));
}

/** First bytes of an object, for sniffing before any download. */
export async function head(key: string, n = 4096): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${n - 1}` }));
  return new Uint8Array(await r.Body!.transformToByteArray());
}

const CACHE = 'private, max-age=31536000, immutable';

export async function putBuffer(key: string, body: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: CACHE }));
}

export async function putFile(key: string, path: string, contentType: string) {
  const { size } = await stat(path);
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType, CacheControl: CACHE }));
}

/** Deletes these keys and everything under these prefixes; a key already gone is not an error (the job may run twice). */
export async function purge(keys: string[], prefixes: string[]): Promise<number> {
  const all = [...keys];
  for (const p of prefixes) {
    let token: string | undefined;
    do {
      const r = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: p, ContinuationToken: token }));
      for (const o of r.Contents ?? []) if (o.Key) all.push(o.Key);
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
  }
  for (let i = 0; i < all.length; i += 1000) {
    const r = await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: all.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    if (r.Errors?.length) throw new Error(`purge: ${r.Errors.length} objects not deleted (${r.Errors[0]?.Code})`);
  }
  return all.length;
}

/** Everything under `prefix` except what starts with one of `keep`: an edited photo's previous renditions. */
export async function purgeExcept(prefix: string, keep: string[]): Promise<number> {
  const drop: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key && !keep.some((k) => o.Key!.startsWith(k))) drop.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return drop.length ? purge(drop, []) : 0;
}
