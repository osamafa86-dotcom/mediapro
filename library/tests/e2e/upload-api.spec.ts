import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { E2E_ENV } from './env';
import { login, mails, write } from './helpers';
import { seed, sql, type Seed } from './seed';

/*
 * M3 boundaries over HTTP: the server signs only part uploads, part listing, complete and abort, and
 * only for the caller's own active upload; the real object size decides whether an asset exists.
 */

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await rm(E2E_ENV.MAIL_DIR, { recursive: true, force: true }); });

const s3 = () => new S3Client({ endpoint: E2E_ENV.S3_ENDPOINT, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY } });

async function open(c: APIRequestContext, body: Record<string, unknown>) {
  const r = await write(c, 'POST', '/api/uploads', { projectId: S.p1, mime: 'image/jpeg', fingerprint: `fp-${Math.random()}`, ...body });
  return { status: r.status(), data: (await r.json()) as { id: string; key: string; uploadId: string; partSize: number; group: string; section: string; resumed: boolean; error?: string } };
}
async function sign(c: APIRequestContext, body: Record<string, unknown>) {
  const r = await write(c, 'POST', '/api/uploads/sign', body);
  return { status: r.status(), url: ((await r.json()) as { url?: string }).url };
}
/** Upload bytes as one part, then complete — the browser's work, done with the signed URLs. */
async function pushOnePart(c: APIRequestContext, u: { key: string; uploadId: string }, bytes: Buffer) {
  const put = await sign(c, { method: 'PUT', key: u.key, uploadId: u.uploadId, partNumber: 1 });
  const pr = await fetch(put.url!, { method: 'PUT', body: new Uint8Array(bytes) });
  const etag = pr.headers.get('etag');
  const done = await sign(c, { method: 'POST', key: u.key, uploadId: u.uploadId });
  const cr = await fetch(done.url!, { method: 'POST', body: `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${etag}</ETag></Part></CompleteMultipartUpload>` });
  expect(cr.status).toBe(200);
}

test('files are classified by type: RAW → «خام», video can be «رشزات», a photo never is', async () => {
  const a = await login('a@e2e.test');
  const raw = await open(a, { filename: 'IMG_0001.CR3', size: 1000 });
  expect(raw.data).toMatchObject({ section: 'photos', group: 'raw' });
  const clip = await open(a, { filename: 'C0047_drone.MP4', size: 1000, group: 'footage', mime: 'video/mp4' });
  expect(clip.data).toMatchObject({ section: 'videos', group: 'footage' });
  const photo = await open(a, { filename: 'a.jpg', size: 1000, group: 'footage' });
  expect(photo.data).toMatchObject({ section: 'photos', group: 'final' });
  for (const bad of ['shell.php', 'run.exe', 'doc.pdf', 'noext']) expect((await open(a, { filename: bad, size: 10 })).status, bad).toBe(415);
});

test('upload needs project access and the role permission', async () => {
  const b = await login('b@e2e.test'); // photographer B is not a member of p1
  expect((await open(b, { filename: 'x.jpg', size: 10 })).status).toBe(404);
  const admin = await login('admin@e2e.test');
  await write(admin, 'PUT', '/api/admin/settings/rolePermissions', { photographer: { upload: false } });
  const a = await login('a@e2e.test');
  expect((await open(a, { filename: 'x.jpg', size: 10 })).status).toBe(403);
  const db = sql(); await db`delete from settings where key = 'rolePermissions'`; await db.end();
});

test('the same file re-opens the same multipart upload (resume after a closed tab)', async () => {
  const a = await login('a@e2e.test');
  const one = await open(a, { filename: 'big.mov', size: 50_000_000, fingerprint: 'same-file', mime: 'video/quicktime' });
  const two = await open(a, { filename: 'big.mov', size: 50_000_000, fingerprint: 'same-file', mime: 'video/quicktime' });
  expect(two.data).toMatchObject({ id: one.data.id, uploadId: one.data.uploadId, key: one.data.key, resumed: true });
  expect(one.data.key.startsWith(`media-library/${S.p1}/`)).toBe(true);
  // another person with the same file gets their own upload
  const admin = await login('admin@e2e.test');
  const other = await open(admin, { filename: 'big.mov', size: 50_000_000, fingerprint: 'same-file', mime: 'video/quicktime' });
  expect(other.data.uploadId).not.toBe(one.data.uploadId);
});

test('the signer refuses every operation except the four, and anything not yours', async () => {
  const a = await login('a@e2e.test');
  const mine = (await open(a, { filename: 'p.jpg', size: 40_000_000 })).data;
  const admin = await login('admin@e2e.test');
  const theirs = (await open(admin, { filename: 'q.jpg', size: 1000 })).data;
  // no PutObject, no CreateMultipartUpload, no DeleteObject — even on my own key
  expect((await sign(a, { method: 'PUT', key: mine.key })).status).toBe(403);
  expect((await sign(a, { method: 'POST', key: mine.key })).status).toBe(403);
  expect((await sign(a, { method: 'DELETE', key: mine.key })).status).toBe(403);
  expect((await sign(a, { method: 'PUT', key: `media-library/${S.p1}/evil.jpg`, uploadId: mine.uploadId, partNumber: 1 })).status).toBe(403);
  // someone else's upload, or my key with someone else's uploadId
  expect((await sign(a, { method: 'PUT', key: theirs.key, uploadId: theirs.uploadId, partNumber: 1 })).status).toBe(403);
  expect((await sign(a, { method: 'PUT', key: mine.key, uploadId: theirs.uploadId, partNumber: 1 })).status).toBe(403);
  // part numbers stay within the file: 40 MB at 16 MiB parts = 3 parts
  expect((await sign(a, { method: 'PUT', key: mine.key, uploadId: mine.uploadId, partNumber: 3 })).status).toBe(200);
  expect((await sign(a, { method: 'PUT', key: mine.key, uploadId: mine.uploadId, partNumber: 4 })).status).toBe(400);
  for (const m of ['GET', 'POST', 'DELETE']) expect((await sign(a, { method: m, key: mine.key, uploadId: mine.uploadId })).status, m).toBe(200);
  // not signed in at all
  expect((await (await import('./helpers')).ctx().then((c) => c.post('/api/uploads/sign', { headers: { origin: E2E_ENV.APP_ORIGIN }, data: { method: 'PUT', key: mine.key, uploadId: mine.uploadId, partNumber: 1 } }))).status()).toBe(401);
});

test('complete: the real object size decides; a short object is deleted, a right one becomes an asset', async () => {
  const a = await login('a@e2e.test');
  const short = (await open(a, { filename: 'short.jpg', size: 2048 })).data;
  expect((await write(a, 'POST', `/api/uploads/${short.id}/complete`)).status()).toBe(409); // nothing uploaded yet
  await pushOnePart(a, short, Buffer.alloc(1000, 1));
  const r = await write(a, 'POST', `/api/uploads/${short.id}/complete`);
  expect(r.status()).toBe(409);
  expect(await r.json()).toMatchObject({ error: 'size_mismatch', expected: 2048, got: 1000 });
  await expect(s3().send(new HeadObjectCommand({ Bucket: E2E_ENV.S3_BUCKET, Key: short.key }))).rejects.toThrow();

  const good = (await open(a, { filename: 'IMG_9000.CR3', size: 3000, mime: 'image/x-canon-cr3' })).data;
  await pushOnePart(a, good, Buffer.alloc(3000, 7));
  const ok = await write(a, 'POST', `/api/uploads/${good.id}/complete`);
  expect(ok.status()).toBe(200);
  const { assetId } = (await ok.json()) as { assetId: string };
  const db = sql();
  const [asset] = await db<{ size: string; group: string; section: string; status: string; original_name: string }[]>`select size, "group", section, status, original_name from assets where id = ${assetId}`;
  await db.end();
  expect(asset).toEqual({ size: '3000', group: 'raw', section: 'photos', status: 'processing', original_name: 'IMG_9000.CR3' });
  // completing twice is harmless; someone else cannot complete or abort it
  expect((await write(a, 'POST', `/api/uploads/${good.id}/complete`)).status()).toBe(200);
  const b = await login('b@e2e.test');
  expect((await write(b, 'POST', `/api/uploads/${good.id}/complete`)).status()).toBe(404);
  expect((await write(b, 'POST', `/api/uploads/${short.id}/abort`)).status()).toBe(404);
});

test('«جاهز للمراجعة»: refused while uploads are open; then review, and the admin gets a mail', async () => {
  const db = sql();
  await db`insert into project_members (project_id, user_id) values (${S.draft}, ${S.photoA}) on conflict do nothing`;
  const a = await login('a@e2e.test');
  const w = (await write(a, 'POST', '/api/uploads', { projectId: S.draft, filename: 'r.jpg', size: 500, mime: 'image/jpeg', fingerprint: 'ready-file-1' }));
  expect(w.status(), await w.text()).toBe(200);
  const u = (await w.json()) as { id: string; key: string; uploadId: string };
  const [st] = await db<{ status: string }[]>`select status from projects where id = ${S.draft}`;
  expect(st!.status).toBe('uploading'); // the first upload moves a draft to «قيد الرفع»
  const early = await write(a, 'POST', `/api/admin/projects/${S.draft}/ready`);
  expect(early.status()).toBe(409);
  expect(await early.json()).toMatchObject({ error: 'uploads_pending', pending: 1 });
  await pushOnePart(a, u, Buffer.alloc(500, 3));
  expect((await write(a, 'POST', `/api/uploads/${u.id}/complete`)).status()).toBe(200);
  const r = await write(a, 'POST', `/api/admin/projects/${S.draft}/ready`);
  expect(await r.json()).toEqual({ status: 'review' });
  expect((await mails()).some((m) => m.to === 'admin@e2e.test' && m.subject.includes('بانتظار المراجعة'))).toBe(true);
  await db.end();
});
