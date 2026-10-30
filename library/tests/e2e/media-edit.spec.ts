import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { expect, test } from '@playwright/test';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { ctx, H, login, uploadFile, write } from './helpers';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/*
 * Crop and rotate: a record the worker renders from the untouched original into `<id>/e<v>/`, swapped in at once;
 * the «original» download becomes the edit; a reset renders the upload again; old versions leave the bucket.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
let wide = ''; // 3000×1500
test.describe.configure({ mode: 'serial' });

const s3 = () => new S3Client({ endpoint: E2E_ENV.S3_ENDPOINT, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY } });
const keys = async (Prefix: string) => ((await s3().send(new ListObjectsV2Command({ Bucket: E2E_ENV.S3_BUCKET, Prefix }))).Contents ?? []).map((o) => o.Key!);
interface Row { status: string; width: number; height: number; r2_key: string; renditions: Record<string, any>; edit: { v: number; state: string; rotate: number } | null }
async function row(id: string): Promise<Row> {
  const db = sql();
  const [r] = await db<Row[]>`select status, width, height, r2_key, renditions, edit from assets where id = ${id}`;
  await db.end();
  return r!;
}
const settled = (id: string, v: number) => expect.poll(async () => { const r = await row(id); return r.edit?.v === v ? r.edit.state : 'other'; }, { timeout: 60_000, intervals: [500] });

test.beforeAll(async () => {
  S = await seed();
  FX = await makeFixtures();
  const admin = await login('admin@e2e.test');
  wide = await uploadFile(admin, S.p1, FX.photos.find((p) => p.endsWith('wide.jpg'))!, { mime: 'image/jpeg' });
  await expect.poll(async () => (await row(wide)).status, { timeout: 90_000, intervals: [500] }).toBe('ready');
});

test('rotate a quarter turn: new renditions in their own folder, the old ones gone, the original download is the edit', async () => {
  const before = await row(wide);
  expect([before.width, before.height]).toEqual([3000, 1500]);
  const folder = (await keys(`${before.r2_key.split('/')[0]}/renditions/${wide}/`));
  expect(folder.length).toBeGreaterThan(0);
  const admin = await login('admin@e2e.test');
  const r = await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 90, crop: null });
  expect(r.status()).toBe(200);
  expect(((await r.json()) as { v: number }).v).toBe(1);
  // the previous renditions stay on screen until the swap
  expect((await row(wide)).status).toBe('ready');
  await settled(wide, 1).toBe('done');
  const after = await row(wide);
  expect([after.width, after.height]).toEqual([1500, 3000]);
  expect(after.renditions.images[0].webp).toContain(`/${wide}/e1/`);
  expect(after.renditions.edited.key).toContain(`/${wide}/e1/edited.jpg`);
  // only e1 is left in the asset's folder
  const prefix = `${before.r2_key.split('/')[0]}/renditions/${wide}/`;
  await expect.poll(async () => (await keys(prefix)).every((k) => k.startsWith(`${prefix}e1/`)), { timeout: 30_000 }).toBe(true);
  // «original» hands over the edited JPEG, named after the upload; the upload itself is still there
  const dl = await admin.get(`/api/download/${wide}`, { maxRedirects: 0 });
  expect(dl.status()).toBe(302);
  const loc = dl.headers()['location']!;
  expect(loc).toContain('/e1/edited.jpg');
  expect(decodeURIComponent(loc)).toContain('wide.jpg');
  expect((await keys(before.r2_key)).length).toBe(1);
  // the dialog's «as shot» picture: staff yes
  expect((await admin.get(`/m/${wide}/source.webp`, { maxRedirects: 0 })).status()).toBe(302);
});

test('crop, then reset: the latest save wins, and a reset renders the upload again', async () => {
  const admin = await login('admin@e2e.test');
  // two saves in a row: the second supersedes the first
  expect((await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 0, crop: { x: 0, y: 0, w: 0.5, h: 1 } })).status()).toBe(200);
  expect((await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 0, crop: { x: 0.5, y: 0, w: 0.5, h: 0.5 } })).status()).toBe(200);
  await settled(wide, 3).toBe('done');
  const cropped = await row(wide);
  expect([cropped.width, cropped.height]).toEqual([1500, 750]);
  expect(cropped.edit!.v).toBe(3);
  expect(cropped.renditions.images[0].webp).toContain('/e3/');

  const reset = await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { reset: true });
  expect(reset.status()).toBe(200);
  await settled(wide, 4).toBe('done');
  const back = await row(wide);
  expect([back.width, back.height]).toEqual([3000, 1500]);
  expect(back.renditions.edited).toBeUndefined();
  const loc = (await admin.get(`/api/download/${wide}`, { maxRedirects: 0 })).headers()['location']!;
  expect(loc).toContain(encodeURIComponent(back.r2_key.split('/').pop()!).slice(0, 8));
  expect(loc).not.toContain('edited.jpg');
});

test('who and what: not RAW, not a video, not someone else’s project; a bad crop is refused', async () => {
  const admin = await login('admin@e2e.test');
  const db = sql();
  const [raw] = await db<{ id: string }[]>`select id from assets where project_id = ${S.p1} and "group" = 'raw' limit 1`;
  await db.end();
  if (raw) expect((await write(admin, 'PUT', `/api/admin/assets/${raw.id}/edit`, { rotate: 90, crop: null })).status()).toBe(400);
  expect((await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 45, crop: null })).status()).toBe(400);
  expect((await write(admin, 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 0, crop: { x: 0.8, y: 0, w: 0.5, h: 1 } })).status()).toBe(400);
  // b@ is not a member of p1
  expect((await write(await login('b@e2e.test'), 'PUT', `/api/admin/assets/${wide}/edit`, { rotate: 90, crop: null })).status()).toBe(404);
  // a client never gets the «as shot» copy (the edit is what was delivered), though the photo itself is theirs
  const l = (await (await write(admin, 'POST', '/api/admin/links', { clientId: S.clientX })).json()) as { path: string; pin: string };
  const client = await ctx();
  expect((await client.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  expect((await client.get(`/m/${wide}/w640.webp`, { maxRedirects: 0 })).status()).toBe(302);
  expect((await client.get(`/m/${wide}/source.webp`, { maxRedirects: 0 })).status()).toBe(404);
});

test('in the browser: «قصّ وتدوير» → turn right → save; the tile says it is working, then shows the turned photo', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the cropper is drawn for a mouse here; touch is the same component');
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto(`/admin/projects/${S.p1}`);
  const tile = page.getByTestId('media-grid').locator(`li[data-asset-id="${wide}"]`);
  await tile.getByRole('button', { name: /^المزيد: / }).click();
  await page.getByRole('menuitem', { name: 'قصّ وتدوير' }).click();
  const dlg = page.getByTestId('edit-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('img')).toBeVisible();
  await dlg.getByTestId('rotate-right').click();
  await dlg.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(dlg).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ التعديل' })).toBeVisible();
  const v = (await row(wide)).edit!.v;
  await settled(wide, v).toBe('done');
  await expect(tile.getByRole('status')).toHaveCount(0, { timeout: 15_000 }); // the «جارٍ تطبيق التعديل…» note leaves with the refresh
  const r = await row(wide);
  expect([r.width, r.height]).toEqual([1500, 3000]);
  // and back: the reset button is there because it is edited now
  await tile.getByRole('button', { name: /^المزيد: / }).click();
  await page.getByRole('menuitem', { name: 'قصّ وتدوير' }).click();
  await page.getByTestId('edit-dialog').getByRole('button', { name: 'استعادة الأصل' }).click();
  await settled(wide, v + 1).toBe('done');
  expect([(await row(wide)).width, (await row(wide)).height]).toEqual([3000, 1500]);
});
