import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { ctx, login, uploadFile, write } from './helpers';
import { PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M4 end to end: a real upload → the real worker (its own process, jobs through Postgres) → renditions
 * in the bucket → served only through the authorizing route as short signed redirects.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
const ids: Record<'cam' | 'raw', string> = { cam: '', raw: '' };
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); FX = await makeFixtures(); });

const s3 = () => new S3Client({ endpoint: E2E_ENV.S3_ENDPOINT, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY } });
const exists = (Key: string) => s3().send(new HeadObjectCommand({ Bucket: E2E_ENV.S3_BUCKET, Key })).then((h) => h.ContentType, () => null);

interface Row { status: string; error: string | null; width: number | null; height: number | null; duration: number | null; taken_at: Date | null; capture_source: string | null; thumbhash: string | null; renditions: Record<string, any> }
async function asset(id: string): Promise<Row> {
  const db = sql();
  const [r] = await db<Row[]>`select status, error, width, height, duration, taken_at, capture_source, thumbhash, renditions from assets where id = ${id}`;
  await db.end();
  return r!;
}
async function settle(id: string, until: (r: Row) => boolean, timeout = 90_000) {
  let last: Row | undefined;
  await expect.poll(async () => { last = await asset(id); return until(last); }, { timeout, intervals: [500] }).toBe(true);
  return last!;
}
/** The route answers with a redirect to a signed URL; we follow it ourselves to check what it points at. */
async function media(c: APIRequestContext, path: string) {
  const r = await c.get(path, { maxRedirects: 0 });
  return { status: r.status(), location: r.headers()['location'] ?? null, cache: r.headers()['cache-control'], body: r.status() === 200 ? await r.text() : '' };
}

test('a camera JPEG: EXIF date and source, AVIF/WebP/JPEG at each width, the web copy, watermarked previews, ThumbHash', async () => {
  const admin = await login('admin@e2e.test');
  const id = await uploadFile(admin, S.p1, FX.cam, { mime: 'image/jpeg' });
  ids.cam = id;
  const r = await settle(id, (x) => x.status !== 'processing');
  expect(r.error).toBeNull();
  expect(r).toMatchObject({ status: 'ready', width: 3000, height: 2000, capture_source: 'camera' });
  expect(r.taken_at!.toISOString()).toBe('2026-10-12T07:30:00.000Z'); // 10:30 in Hebron (UTC+3 in October)
  expect(Buffer.from(r.thumbhash!, 'base64').length).toBeGreaterThan(10);
  expect(r.renditions.images.map((i: { w: number }) => i.w)).toEqual([320, 640, 1280, 2048]); // 3840 > 3000: never upscaled
  for (const i of r.renditions.images) {
    expect(await exists(i.webp)).toBe('image/webp');
    expect(await exists(i.jpeg)).toBe('image/jpeg');
    if (i.w <= 1280) expect(await exists(i.avif)).toBe('image/avif');
  }
  expect(r.renditions.web).toBe(r.renditions.images[3].jpeg);
  expect(r.renditions.wm.map((w: { w: number }) => w.w)).toEqual([640, 1280]);

  // served through the gate: a 10-minute signed redirect, private
  const m = await media(admin, `/m/${id}/w640.avif`);
  expect(m.status).toBe(302);
  expect(m.cache).toContain('private');
  const signed = new URL(m.location!);
  expect(signed.pathname).toContain(r.renditions.images[1].avif);
  expect(signed.searchParams.get('X-Amz-Expires')).toBe('600');
  const img = await fetch(m.location!);
  expect(img.headers.get('content-type')).toBe('image/avif');
  // the original itself is never a variant
  expect((await media(admin, `/m/${id}/original`)).status).toBe(404);
  // nobody signed in, or a photographer who is not on the project: 404, nothing signed
  const anon = await ctx();
  expect((await media(anon, `/m/${id}/w640.webp`)).status).toBe(404);
  expect((await media(await login('b@e2e.test'), `/m/${id}/w640.webp`)).status).toBe(404);
  expect((await media(await login('a@e2e.test'), `/m/${id}/w640.webp`)).status).toBe(302); // A is a member
});

test('RAW: the embedded preview becomes the image (and is kept for staff)', async () => {
  const a = await login('a@e2e.test');
  const id = await uploadFile(a, S.p1, FX.raw, { mime: 'image/x-adobe-dng' });
  ids.raw = id;
  const r = await settle(id, (x) => x.status !== 'processing');
  expect(r.error).toBeNull();
  expect(r).toMatchObject({ status: 'ready', width: 1600, height: 1067 });
  expect(await exists(r.renditions.rawPreview)).toBe('image/jpeg');
  expect(r.renditions.images.map((i: { w: number }) => i.w)).toEqual([320, 640, 1280]);
  expect((await media(a, `/m/${id}/raw`)).status).toBe(302);
});

test('clients get clean stills; guests only watermarked ones, never the web copy, the RAW preview or «خام»', async () => {
  const admin = await login('admin@e2e.test');
  const open = async (kind: 'client' | 'guest', projectId: string) => {
    const l = await write(admin, 'POST', '/api/admin/links', { clientId: S.clientX, projectId, kind });
    expect(l.status()).toBe(201);
    const { path, pin } = (await l.json()) as { path: string; pin: string };
    const c = await ctx();
    expect((await c.post('/api/link/pin', { headers: { origin: E2E_ENV.APP_ORIGIN }, data: { token: path.slice(3), pin } })).status()).toBe(200);
    return c;
  };
  const r = await asset(ids.cam);
  const client = await open('client', S.p1);
  expect(new URL((await media(client, `/m/${ids.cam}/w640.webp`)).location!).pathname).toContain(r.renditions.images[1].webp);
  expect((await media(client, `/m/${ids.cam}/web`)).status).toBe(302);

  const guest = await open('guest', S.p1);
  const g = await media(guest, `/m/${ids.cam}/w2048.jpg`);
  expect(g.status).toBe(302);
  expect(new URL(g.location!).pathname).toContain(r.renditions.wm[1].jpeg); // watermarked, capped at 1280
  expect((await media(guest, `/m/${ids.cam}/w640.avif`)).status).toBe(404);
  expect((await media(guest, `/m/${ids.cam}/web`)).status).toBe(404);
  expect((await media(guest, `/m/${ids.raw}/w640.webp`)).status).toBe(404); // the RAW group does not exist for a guest
  expect((await media(guest, `/m/${ids.raw}/raw`)).status).toBe(404);

  // a link to another project of the same client sees nothing here
  const other = await open('guest', S.p2);
  expect((await media(other, `/m/${ids.cam}/w640.webp`)).status).toBe(404);
});

test('a file whose bytes are not what its name says fails with a reason, and gets nothing', async () => {
  const a = await login('a@e2e.test');
  const id = await uploadFile(a, S.p1, FX.fakeJpg, { mime: 'image/jpeg' });
  const r = await settle(id, (x) => x.status !== 'processing');
  expect(r).toMatchObject({ status: 'failed', renditions: {} });
  expect(r.error).toMatch(/^type_mismatch/);
  expect((await media(a, `/m/${id}/w640.jpg`)).status).toBe(404);
});

test('video: playable after the lowest rung; then every rung ≤ source, the scrub sprite and the 1080p download copy', async () => {
  test.setTimeout(240_000);
  const admin = await login('admin@e2e.test');
  const id = await uploadFile(admin, S.p1, FX.clip, { mime: 'video/mp4' });
  const first = await settle(id, (x) => x.status !== 'processing', 120_000);
  expect(first.error).toBeNull();
  expect(first).toMatchObject({ status: 'ready', width: 1920, height: 1080 });
  expect(first.duration).toBeCloseTo(6, 0);
  expect(first.renditions.hls.rungs[0]).toBe(360); // the cheapest rung comes first
  expect(await exists(first.renditions.poster)).toBe('image/jpeg');

  const r = await settle(id, (x) => !!x.renditions.mp4_1080, 180_000);
  expect(r.error).toBeNull();
  expect(r.renditions.hls.rungs).toEqual([360, 720, 1080]); // no 1440/2160 from a 1080p source
  expect(await exists(r.renditions.mp4_1080)).toBe('video/mp4');
  expect(await exists(r.renditions.sprite.image)).toBe('image/jpeg');

  // the master playlist comes back rewritten: every URI goes through the gate again
  const master = await media(admin, `/m/${id}/hls/master.m3u8`);
  expect(master.status).toBe(200);
  expect(master.cache).toBe('private, no-store');
  const lines = master.body.split('\n').filter((l) => l && !l.startsWith('#'));
  expect(lines).toEqual([360, 720, 1080].map((h) => `/m/${id}/hls/${h}/index.m3u8`));
  expect(master.body).toMatch(/CODECS="avc1\.[0-9a-f]+,mp4a\.40\.2"/);
  const rung = await media(admin, lines[0]!);
  expect(rung.body).toContain(`#EXT-X-MAP:URI="/m/${id}/hls/360/init.mp4"`);
  const seg = rung.body.split('\n').find((l) => l.startsWith('/m/'))!;
  expect(seg).toMatch(new RegExp(`^/m/${id}/hls/360/seg_\\d{5}\\.m4s$`));
  const s = await media(admin, seg);
  expect(s.status).toBe(302);
  const bytes = await (await fetch(s.location!)).arrayBuffer();
  expect(bytes.byteLength).toBeGreaterThan(1000);

  // the scrub track points at the sprite through the gate
  const vtt = (await media(admin, `/m/${id}/sprite.vtt`)).body;
  expect(vtt).toMatch(/^WEBVTT/);
  expect(vtt).toMatch(new RegExp(`^/m/${id}/sprite\\.jpg#xywh=\\d+,\\d+,\\d+,\\d+$`, 'm'));
  expect(vtt).not.toMatch(/^sprite\.jpg/m);
  expect((await media(admin, `/m/${id}/sprite.jpg`)).status).toBe(302);
  expect((await media(admin, `/m/${id}/web`)).status).toBe(302);
  // outsiders: nothing
  expect((await media(await ctx(), `/m/${id}/hls/master.m3u8`)).status).toBe(404);
});

test('the project grid shows real thumbnails over a placeholder, and failures with their reason', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: E2E_ENV.APP_ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto(`/admin/projects/${S.p1}`);
  const ready = page.locator('[data-status=ready]');
  await expect(ready.first()).toBeVisible();
  expect(await ready.count()).toBeGreaterThanOrEqual(2); // the camera JPEG and the RAW (the seeded rows have no renditions)
  // every ready tile's image really loaded (through /m → signed redirect → bucket, allowed by the CSP)
  await expect.poll(() => ready.locator('img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 15_000 })
    .not.toContain(false);
  const bg = await ready.first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toMatch(/^url\("data:image\/png;base64,/); // ThumbHash placeholder
  const failed = page.locator('[data-status=failed][data-reason=type_mismatch]');
  await expect(failed).toContainText('تعذّرت المعالجة: محتوى الملف لا يطابق نوعه');
  await expect(failed).toContainText('holiday.jpg');
  // the video tile on its own tab, with its duration
  await page.goto(`/admin/projects/${S.p1}?tab=videos`);
  await expect(page.locator('[data-status=ready]').first()).toContainText('0:06');
});
