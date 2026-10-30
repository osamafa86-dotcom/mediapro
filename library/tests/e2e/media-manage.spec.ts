import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { H, login, uploadFile, write } from './helpers';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/*
 * Managing a project's media: the order (whole section or nothing; the client sees it by default), the cover,
 * deleting (who may; the rows at once, the storage by the worker), and the admin's grid and viewers in a browser.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
let photos: string[] = [];
test.describe.configure({ mode: 'serial' });

const s3 = () => new S3Client({ endpoint: E2E_ENV.S3_ENDPOINT, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY } });
const listed = async (Prefix: string) => ((await s3().send(new ListObjectsV2Command({ Bucket: E2E_ENV.S3_BUCKET, Prefix }))).Contents ?? []).length;
async function ready(ids: string[]) {
  await expect.poll(async () => {
    const db = sql();
    const r = await db<{ n: number }[]>`select count(*)::int as n from assets where id = any(${ids}::uuid[]) and status = 'ready'`;
    await db.end();
    return r[0]!.n;
  }, { timeout: 90_000, intervals: [500] }).toBe(ids.length);
}
async function order(projectId: string) {
  const db = sql();
  const r = await db<{ id: string }[]>`select id from assets where project_id = ${projectId} and section = 'photos' and replaced_by is null order by sort_order, original_name, created_at`;
  await db.end();
  return r.map((x) => x.id);
}

test.beforeAll(async () => {
  S = await seed();
  FX = await makeFixtures();
  const admin = await login('admin@e2e.test');
  photos = [];
  for (const f of FX.photos) photos.push(await uploadFile(admin, S.p1, f, { mime: 'image/jpeg' }));
  await ready(photos);
});

test('order: the whole section or nothing; a project member may, anyone else gets 404; the client sees it by default', async ({ page }) => {
  const all = await order(S.p1);
  const reversed = [...all].reverse();
  const member = await login('a@e2e.test'); // member of p1
  expect((await write(member, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', ids: reversed })).status()).toBe(200);
  expect(await order(S.p1)).toEqual(reversed);
  const stranger = await login('b@e2e.test'); // member of p2 only
  expect((await write(stranger, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', ids: all })).status()).toBe(404);
  // a stale page (one missing, one repeated) is refused rather than half-applied
  const partial = await write(member, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', ids: all.slice(1) });
  expect(partial.status()).toBe(409);
  expect(((await partial.json()) as { error: string }).error).toBe('stale_order');
  expect((await write(member, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', ids: [all[0], ...all.slice(0, -1)] })).status()).toBe(409);
  expect(await order(S.p1)).toEqual(reversed);

  // the client's project page opens in that order («الترتيب المختار» is the default)
  const a = await login('admin@e2e.test');
  const l = (await (await write(a, 'POST', '/api/admin/links', { clientId: S.clientX })).json()) as { path: string; pin: string };
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  await page.goto(`/p/${S.p1}`);
  await expect(page.getByTestId('photo-grid').locator('[data-asset-id]')).toHaveCount(photos.length + 1); // + the seeded photo
  const shown = await page.getByTestId('photo-grid').locator('[data-asset-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-asset-id')));
  expect(shown).toEqual(reversed.filter((id) => shown.includes(id)));
  expect(shown.length).toBeGreaterThanOrEqual(photos.length);
});

test('cover: a ready photo of this project, or null for the automatic choice', async () => {
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'PUT', `/api/admin/projects/${S.p1}/cover`, { assetId: photos[1] })).status()).toBe(200);
  const db = sql();
  expect((await db<{ c: string }[]>`select cover_asset_id as c from projects where id = ${S.p1}`)[0]!.c).toBe(photos[1]);
  const foreign = await write(admin, 'PUT', `/api/admin/projects/${S.p2}/cover`, { assetId: photos[1] });
  expect(foreign.status()).toBe(400);
  expect((await write(admin, 'PUT', `/api/admin/projects/${S.p1}/cover`, { assetId: null })).status()).toBe(200);
  expect((await db<{ c: string | null }[]>`select cover_asset_id as c from projects where id = ${S.p1}`)[0]!.c).toBeNull();
  await db.end();
});

test('delete: a member only their own upload before publication; the admin anything; the worker empties the storage', async () => {
  const db = sql();
  const [draft] = await db<{ id: string }[]>`insert into projects (client_id, title, status) values (${S.clientX}, 'مسودة للحذف', 'draft') returning id`;
  await db`insert into project_members (project_id, user_id) values (${draft!.id}, ${S.photoA})`;
  const member = await login('a@e2e.test');
  const mine = await uploadFile(member, draft!.id, FX.photos[0]!, { mime: 'image/jpeg' });
  const minePublished = await uploadFile(member, S.p1, FX.photos[0]!, { mime: 'image/jpeg' });
  await ready([mine, minePublished]);
  // published: the client may already hold it — not theirs to remove any more; nor anyone else's upload
  expect((await write(member, 'POST', '/api/admin/assets/delete', { ids: [minePublished] })).status()).toBe(403);
  expect((await write(member, 'POST', '/api/admin/assets/delete', { ids: [photos[0]] })).status()).toBe(403);
  expect((await write(await login('b@e2e.test'), 'POST', '/api/admin/assets/delete', { ids: [mine] })).status()).toBe(404);
  const ok = await write(member, 'POST', '/api/admin/assets/delete', { ids: [mine] });
  expect(ok.status()).toBe(200);
  expect(((await ok.json()) as { deleted: number }).deleted).toBe(1);

  // the admin removes the cover photo, which also has a client note and a favourite
  const victim = photos[2]!;
  const key = (await db<{ r2_key: string }[]>`select r2_key from assets where id = ${victim}`)[0]!.r2_key;
  await db`update projects set cover_asset_id = ${victim} where id = ${S.p1}`;
  await db`insert into comments (asset_id, user_id, author_name, body) values (${victim}, ${S.admin}, 'سامي', 'ملاحظة على الصورة')`;
  await db`insert into favourites (asset_id, user_id) values (${victim}, ${S.admin})`;
  const prefix = `${key.split('/')[0]}/renditions/${victim}/`; // the deployment's S3_PREFIX is the key's first segment
  expect(await listed(prefix)).toBeGreaterThan(0);
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'POST', '/api/admin/assets/delete', { ids: [victim, minePublished] })).status()).toBe(200);
  expect(await db`select 1 from assets where id = any(${[victim, minePublished]}::uuid[])`).toHaveLength(0);
  expect((await db<{ c: string | null }[]>`select cover_asset_id as c from projects where id = ${S.p1}`)[0]!.c).toBeNull();
  // what the confirmation says: the client's notes and favourites on it go too
  expect(await db`select 1 from comments where asset_id = ${victim}`).toHaveLength(0);
  expect(await db`select 1 from favourites where asset_id = ${victim}`).toHaveLength(0);
  await expect.poll(async () => (await listed(prefix)) + (await listed(key)), { timeout: 30_000, intervals: [500] }).toBe(0);
  expect((await db`select 1 from audit_log where action = 'asset.deleted'`).length).toBeGreaterThanOrEqual(3);
  await db.end();
  photos = photos.filter((id) => id !== victim);
});

async function signIn(page: Page) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
}
const gridIds = (page: Page) => page.getByTestId('media-grid').locator('li[data-asset-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-asset-id')!));

test('admin grid: open large and move between photos; cover from the viewer; select and bring to the start; drag to reorder', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse drag and the lightbox toolbar');
  await signIn(page);
  await page.goto(`/admin/projects/${S.p1}`);
  const grid = page.getByTestId('media-grid');
  await expect(grid.locator('li[data-asset-id]')).toHaveCount((await order(S.p1)).length);
  const before = await gridIds(page);

  // large viewer: an uploaded photo opens, the arrow moves on
  await grid.locator(`li[data-asset-id="${before.find((id) => photos.includes(id))}"] button`).first().click();
  const lb = page.locator('.yarl__root');
  await expect(lb).toBeVisible();
  const at = await lb.locator('.yarl__counter').textContent();
  await page.keyboard.press('ArrowLeft');
  await expect(lb.locator('.yarl__counter')).not.toHaveText(at!);
  await lb.getByTestId('viewer-cover').click();
  await expect(lb.getByTestId('viewer-cover')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(lb).toBeHidden();
  await expect(grid.locator('li[data-asset-id]').filter({ hasText: 'الغلاف' })).toHaveCount(1);

  // select the last two → «تقديم إلى البداية»
  const last2 = before.slice(-2);
  // «تحديد» switches the grid to selecting: a tap ticks instead of opening
  await page.getByTestId('select-mode').click();
  const bar = page.getByTestId('media-selection');
  await expect(bar).toContainText('اختر المواد');
  for (const id of last2) await grid.locator(`li[data-asset-id="${id}"] button`).first().click();
  await expect(page.locator('.yarl__root')).toHaveCount(0);
  await expect(bar).toContainText('محدّدتان');
  await bar.getByRole('button', { name: 'تقديم إلى البداية' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ الترتيب.' })).toBeVisible();
  const afterSel = [...last2, ...before.filter((id) => !last2.includes(id))];
  expect(await gridIds(page)).toEqual(afterSel);
  expect(await order(S.p1)).toEqual(afterSel);
  await bar.getByRole('button', { name: 'تم' }).click();
  await expect(bar).toHaveCount(0);

  // drag the last tile onto the first one with the mouse
  const from = grid.locator(`li[data-asset-id="${afterSel.at(-1)}"]`);
  const to = grid.locator(`li[data-asset-id="${afterSel[0]}"]`);
  const fb = (await from.boundingBox())!;
  const tb = (await to.boundingBox())!;
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width / 2 + 10, fb.y + fb.height / 2 + 10, { steps: 4 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 });
  await page.mouse.up();
  const dragged = [afterSel.at(-1)!, ...afterSel.slice(0, -1)];
  await expect.poll(() => order(S.p1)).toEqual(dragged);
  await page.reload();
  expect(await gridIds(page)).toEqual(dragged);
  await expect(page.locator('.yarl__root')).toHaveCount(0); // the drag did not open the viewer

  // keyboard path: «⋯» → «تأخير إلى النهاية»
  const first = dragged[0]!;
  await grid.locator(`li[data-asset-id="${first}"]`).getByRole('button', { name: /^المزيد: / }).click();
  await page.getByRole('menuitem', { name: 'تأخير إلى النهاية' }).click();
  await expect.poll(() => order(S.p1)).toEqual([...dragged.slice(1), first]);
});

test('admin grid: delete from the viewer after a confirmation; the tile goes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'lightbox toolbar');
  await signIn(page);
  await page.goto(`/admin/projects/${S.p1}`);
  const grid = page.getByTestId('media-grid');
  const before = await gridIds(page);
  const target = before.find((id) => photos.includes(id))!; // an uploaded photo (the seeded one has no previews to open)
  await grid.locator(`li[data-asset-id="${target}"] button`).first().click();
  await page.locator('.yarl__root').getByTestId('viewer-delete').click();
  const dlg = page.getByTestId('delete-dialog');
  await expect(dlg).toContainText('حذف هذه المادة؟');
  await expect(dlg).toContainText('لا يمكن التراجع');
  await dlg.getByRole('button', { name: 'حذف نهائيًا' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُذفت مادة واحدة.' })).toBeVisible();
  await expect(grid.locator(`li[data-asset-id="${target}"]`)).toHaveCount(0);
  await expect(grid.locator('li[data-asset-id]')).toHaveCount(before.length - 1);
});

test('admin grid on a phone: a tap opens the photo large; a long press without moving opens its menu', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'phone');
  await signIn(page);
  await page.goto(`/admin/projects/${S.p1}`);
  const tile = page.getByTestId('media-grid').locator(`li[data-asset-id="${photos.find(Boolean)}"]`);
  await tile.locator('button').first().tap();
  await expect(page.locator('.yarl__root')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.yarl__root')).toHaveCount(0);
  // a long press (held past the lift delay, released in place): the item's menu, no viewer, no reorder
  const before = await order(S.p1);
  const box = (await tile.boundingBox())!;
  await tile.evaluate(async (el, p) => {
    const touch = (t: string, target: EventTarget) => new TouchEvent(t, { bubbles: true, cancelable: true,
      touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: p.x, clientY: p.y })],
      changedTouches: [new Touch({ identifier: 1, target, clientX: p.x, clientY: p.y })] });
    el.dispatchEvent(touch('touchstart', el));
    await new Promise((r) => setTimeout(r, 650));
    el.dispatchEvent(touch('touchend', el));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(page.getByRole('menuitem', { name: 'تحديد' })).toBeVisible();
  await expect(page.locator('.yarl__root')).toHaveCount(0);
  expect(await order(S.p1)).toEqual(before);
  // «تحديد» from that menu: selecting, with this item already ticked
  await page.getByRole('menuitem', { name: 'تحديد' }).click();
  await expect(page.getByTestId('media-selection')).toContainText('محدّدة واحدة');
});

test('admin grid: a video opens large in the player; Esc closes it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser is enough for the player');
  test.setTimeout(150_000);
  const admin = await login('admin@e2e.test');
  const clip = await uploadFile(admin, S.p1, FX.clip, { mime: 'video/mp4', group: 'final' });
  await ready([clip]);
  await signIn(page);
  await page.goto(`/admin/projects/${S.p1}?tab=videos`);
  await page.getByTestId('media-grid').locator(`li[data-asset-id="${clip}"] button`).first().click();
  const v = page.getByTestId('video-viewer');
  await expect(v).toBeVisible();
  await expect(v.locator('video')).toHaveCount(1);
  await expect(v).toContainText('1 / 1');
  await expect(v.getByRole('button', { name: 'التالي' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(v).toHaveCount(0);
});
