import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { csrf, login, mails, uploadFile, write } from './helpers';
import { PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M7: favourites (the client organisation's, never a guest's), notes pinned on a photo or at a moment of a
 * video, the team inbox (replies, states, who sees what), and «رفع نسخة معدّلة» closing the loop.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
const ids = { cam: '', wide: '', tall: '', clip: '' };
const H = { origin: E2E_ENV.APP_ORIGIN };
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  S = await seed();
  FX = await makeFixtures();
  const a = await login('a@e2e.test'); // photographer A uploads: the notes are assigned to them
  ids.cam = await uploadFile(a, S.p1, FX.cam, { mime: 'image/jpeg' });
  ids.wide = await uploadFile(a, S.p1, FX.photos[0]!, { mime: 'image/jpeg' });
  ids.tall = await uploadFile(a, S.p1, FX.photos[1]!, { mime: 'image/jpeg' });
  ids.clip = await uploadFile(a, S.p1, FX.clip, { mime: 'video/mp4' });
  const db = sql();
  await db`delete from assets where id in (${S.assetFinal}, ${S.assetRaw}, ${S.assetP2})`;
  await expect.poll(async () => (await db<{ n: number }[]>`select count(*)::int as n from assets where project_id = ${S.p1} and status = 'ready'`)[0]!.n, { timeout: 120_000 }).toBe(4);
  await db.end();
});

async function client(page: Page, body: Record<string, unknown> = { clientId: S.clientX }) {
  const admin = await login('admin@e2e.test');
  const l = (await (await write(admin, 'POST', '/api/admin/links', body)).json()) as { path: string; pin: string };
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
}
async function staff(page: Page, email: string) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: H, data: { email, password: PASSWORD } })).status()).toBe(200);
}
const tile = (page: Page, id: string) => page.getByTestId('photo-grid').locator(`[data-asset-id="${id}"]`);
const desktopOnly = (info: { project: { name: string } }) => test.skip(info.project.name !== 'desktop', 'one viewport is enough for this flow');

test('favourites: the heart in the viewer, the badge, the chip, «تنزيل المفضّلة» — kept across links', async ({ page, browser }, info) => {
  desktopOnly(info);
  await client(page);
  await page.goto(`/p/${S.p1}`);
  await tile(page, ids.wide).getByRole('button', { name: /wide/ }).click();
  await expect(page.getByTestId('viewer-footer')).toContainText('wide.jpg');
  await page.getByTestId('viewer-fav').click();
  await expect(page.getByTestId('viewer-fav')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(tile(page, ids.wide).getByTestId('fav-badge')).toBeVisible();
  await page.getByTestId('fav-chip').click();
  await expect(page.getByTestId('photo-grid').locator('[data-asset-id]')).toHaveCount(1);
  const bar = page.getByTestId('fav-bar');
  await expect(bar).toContainText('عنصر في المفضّلة');
  const [dl] = await Promise.all([page.waitForEvent('download'), bar.getByRole('button', { name: 'تنزيل المفضّلة' }).click()]);
  const zip = join(info.outputDir, 'fav.zip');
  await dl.saveAs(zip);
  expect(execFileSync('unzip', ['-Z1', zip]).toString().trim()).toBe('الصور/نهائي/wide.jpg');

  // a new link of the same organisation sees the same favourites
  const other = await browser.newPage();
  await client(other);
  await other.goto(`/p/${S.p1}`);
  await expect(tile(other, ids.wide).getByTestId('fav-badge')).toBeVisible();
  await other.close();

  // the admin sees it as a selection signal
  const admin = await browser.newPage();
  await staff(admin, 'admin@e2e.test');
  await admin.goto(`/admin/projects/${S.p1}`);
  await expect(admin.locator(`[data-asset-id="${ids.wide}"]`).getByTestId('client-fav')).toHaveText('1');
  await admin.close();
});

test('a pin note on the photo: placed where it was tapped, numbered, mailed to the team', async ({ page }, info) => {
  desktopOnly(info);
  await client(page);
  await page.goto(`/p/${S.p1}`);
  await tile(page, ids.cam).getByRole('button', { name: /cam/ }).click();
  await page.getByTestId('viewer-notes').click();
  const panel = page.getByTestId('notes-panel');
  await expect(panel).toContainText('لا ملاحظات بعد');
  const layer = page.getByTestId('pin-layer').first();
  await expect(layer).toBeVisible();
  const box = (await layer.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await expect(panel).toContainText('الموضع محدّد');
  await page.getByTestId('note-input').fill('هل توجد نسخة أفقية أوسع؟');
  await page.getByTestId('note-send').click();
  await expect(panel.locator('[data-note-n="1"]')).toContainText('هل توجد نسخة أفقية أوسع؟');
  const pin = layer.locator('[data-pin="1"]');
  await expect(pin).toBeVisible();
  const p = (await pin.boundingBox())!;
  expect(Math.abs(p.x + p.width / 2 - (box.x + box.width * 0.6))).toBeLessThan(3);
  expect(Math.abs(p.y + p.height / 2 - (box.y + box.height * 0.4))).toBeLessThan(3);
  await page.screenshot({ path: 'test-results/notes/viewer-pin.png' });
  const db = sql();
  const [c] = await db<{ x: number; y: number; anchor_type: string; assignee_id: string; author_name: string }[]>`select x, y, anchor_type, assignee_id, author_name from comments where asset_id = ${ids.cam}`;
  expect(c).toMatchObject({ anchor_type: 'pin', assignee_id: S.photoA });
  expect(c!.x).toBeCloseTo(0.6, 2);
  expect(c!.y).toBeCloseTo(0.4, 2);
  await db.end();
  await expect.poll(async () => (await mails()).filter((m) => m.subject.startsWith('ملاحظة جديدة') && m.to === 'a@e2e.test').length).toBe(1);
  expect((await mails()).some((m) => m.subject.startsWith('ملاحظة جديدة') && m.to === 'admin@e2e.test')).toBe(true);
});

test('a note on the video sits at the moment being played, with a marker; its time jumps back there', async ({ page }, info) => {
  desktopOnly(info);
  await client(page);
  await page.goto(`/p/${S.p1}/v/${ids.clip}`);
  const video = page.locator('video');
  // hydrated and streaming before touching the controls
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.getByTestId('player-notes').click();
  await expect(page.getByTestId('video-notes')).toBeVisible();
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 3; });
  await expect(page.getByTestId('note-time')).toHaveText('00:03');
  await page.getByTestId('note-input').fill('الصوت منخفض في هذا الجزء');
  await page.getByTestId('note-send').click();
  const panel = page.getByTestId('notes-panel');
  await expect(panel.locator('[data-note-n="1"]')).toContainText('00:03');
  await expect(page.getByTestId('player').locator('[class*=marker]')).toHaveCount(1);
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 0.5; });
  await panel.getByRole('button', { name: /00:03/ }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(3, 0);
  await page.screenshot({ path: 'test-results/notes/video-notes.png' });
});

test('the inbox: grouped by project; a reply reaches the client (page and mail) and moves the note to «قيد التنفيذ»', async ({ page, browser }, info) => {
  desktopOnly(info);
  await staff(page, 'admin@e2e.test');
  await page.goto('/admin/notes');
  const list = page.getByTestId('notes-list');
  await expect(list.locator('[data-note-id]')).toHaveCount(2);
  await expect(list).toContainText('توزيع الطرود الغذائية — رفح');
  await list.locator('[data-note-id]').filter({ hasText: 'نسخة أفقية' }).click();
  const detail = page.getByTestId('note-detail');
  await expect(detail).toContainText('cam.jpg');
  await page.getByTestId('reply-input').fill('سنرسل نسخة أوسع خلال يوم.');
  await page.getByTestId('reply-send').click();
  await expect(detail.getByTestId('status')).toHaveValue('in_progress');
  await expect(detail).toContainText('سنرسل نسخة أوسع خلال يوم.');
  await page.screenshot({ path: 'test-results/notes/inbox.png' });
  await expect.poll(async () => (await mails()).some((m) => m.to === 'heba@alnoor.test' && m.subject.startsWith('رد على ملاحظتكم'))).toBe(true);

  const c = await browser.newPage();
  await client(c);
  await c.goto(`/p/${S.p1}`);
  await tile(c, ids.cam).getByRole('button', { name: /cam/ }).click();
  await c.getByTestId('viewer-notes').click();
  await expect(c.getByTestId('notes-panel').locator('[data-note-n="1"]')).toContainText('سنرسل نسخة أوسع خلال يوم.');
  await expect(c.getByTestId('notes-panel').locator('[data-note-n="1"]')).toContainText('قيد التنفيذ');
  await c.close();
});

test('who sees what: a photographer only what is assigned to them (in the query), and only the admin assigns', async ({ page, browser }, info) => {
  desktopOnly(info);
  const a = await browser.newPage();
  await staff(a, 'a@e2e.test');
  await a.goto('/admin/notes');
  await expect(a.getByTestId('notes-list').locator('[data-note-id]')).toHaveCount(2);
  await expect(a.getByTestId('assignee')).toHaveCount(0); // no «المسند إليه» for a photographer
  const b = await login('b@e2e.test');
  const db = sql();
  const [note] = await db<{ id: string }[]>`select id from comments where asset_id = ${ids.cam} and parent_id is null`;
  expect((await b.get(`/api/admin/notes/${note!.id}`)).status()).toBe(404);
  expect((await b.fetch(`/api/admin/notes/${note!.id}`, { method: 'PATCH', headers: { ...H, 'x-csrf-token': await csrf(b) }, data: { status: 'resolved' } })).status()).toBe(404);
  const aCtx = await login('a@e2e.test');
  expect((await aCtx.fetch(`/api/admin/notes/${note!.id}`, { method: 'PATCH', headers: { ...H, 'x-csrf-token': await csrf(aCtx) }, data: { assigneeId: S.photoB } })).status()).toBe(403);
  // only the project's team (or an admin) can be assigned
  const adm = await login('admin@e2e.test');
  expect((await adm.fetch(`/api/admin/notes/${note!.id}`, { method: 'PATCH', headers: { ...H, 'x-csrf-token': await csrf(adm) }, data: { assigneeId: S.photoB } })).status()).toBe(400);
  await db`insert into project_members (project_id, user_id) values (${S.p1}, ${S.photoB}) on conflict do nothing`;
  // the admin hands it to B: now B sees it and A does not
  await staff(page, 'admin@e2e.test');
  await page.goto(`/admin/notes?id=${note!.id}`);
  await page.getByTestId('assignee').selectOption(S.photoB);
  await expect(page.getByRole('status')).toHaveText('حُفظ.');
  expect((await b.get(`/api/admin/notes/${note!.id}`)).status()).toBe(200);
  await a.reload();
  await expect(a.getByTestId('notes-list').locator('[data-note-id]')).toHaveCount(1);
  await db`update comments set assignee_id = ${S.photoA} where id = ${note!.id}`;
  await db.end();
  await a.close();
});

test('«رفع نسخة معدّلة»: the new file takes the old one\'s place for the client, the note closes, the old one stays on record', async ({ page, browser }, info) => {
  desktopOnly(info);
  test.setTimeout(120_000);
  await staff(page, 'admin@e2e.test');
  const db = sql();
  const [note] = await db<{ id: string }[]>`select id from comments where asset_id = ${ids.cam} and parent_id is null`;
  await page.goto(`/admin/notes?id=${note!.id}`);
  await page.getByTestId('replace-file').setInputFiles(FX.photos[2]!); // square.jpg
  await expect(page.getByRole('status')).toHaveText('حُفظ.', { timeout: 30_000 });
  const [old] = await db<{ replaced_by: string | null; sort_order: number }[]>`select replaced_by, sort_order from assets where id = ${ids.cam}`;
  expect(old!.replaced_by).not.toBeNull();
  const [neu] = await db<{ original_name: string; sort_order: number; group: string }[]>`select original_name, sort_order, "group" from assets where id = ${old!.replaced_by}`;
  expect(neu).toEqual({ original_name: 'square.jpg', sort_order: old!.sort_order, group: 'final' });
  const [c] = await db<{ status: string; resolved_at: string | null }[]>`select status, resolved_at from comments where id = ${note!.id}`;
  expect(c!.status).toBe('resolved');
  expect(c!.resolved_at).not.toBeNull();
  await expect.poll(async () => (await db<{ status: string }[]>`select status from assets where id = ${old!.replaced_by}`)[0]!.status, { timeout: 60_000 }).toBe('ready');
  await db.end();
  // the client sees the new one in its place, not the old one
  const cl = await browser.newPage();
  await client(cl);
  await cl.goto(`/p/${S.p1}`);
  await expect(tile(cl, ids.cam)).toHaveCount(0);
  await expect(tile(cl, old!.replaced_by!)).toHaveCount(1);
  await cl.close();
  // and the inbox keeps the closed note with why
  await page.goto(`/admin/notes?state=resolved&id=${note!.id}`);
  await expect(page.getByTestId('note-detail')).toContainText('استُبدلت بنسخة معدّلة');
});

test('a guest never sees or writes notes or favourites — the server refuses too', async ({ page }) => {
  await client(page, { clientId: S.clientX, projectId: S.p1, kind: 'guest' });
  await page.goto(`/p/${S.p1}`);
  await expect(page.getByTestId('fav-chip')).toHaveCount(0);
  await tile(page, ids.wide).getByRole('button').first().click();
  await expect(page.getByTestId('viewer-footer')).toBeVisible();
  await expect(page.getByTestId('viewer-fav')).toHaveCount(0);
  await expect(page.getByTestId('viewer-notes')).toHaveCount(0);
  const vc = (await page.context().cookies()).find((k) => k.name.endsWith('ml_vcsrf'))!.value;
  const h = { ...H, 'x-csrf-token': vc };
  expect((await page.request.get(`/api/notes?assetId=${ids.wide}`)).status()).toBe(403);
  expect((await page.request.post('/api/notes', { headers: h, data: { assetId: ids.wide, body: 'x' } })).status()).toBe(403);
  expect((await page.request.post('/api/favourites', { headers: h, data: { assetId: ids.wide, on: true } })).status()).toBe(403);
  await page.goto(`/p/${S.p1}/v/${ids.clip}`);
  await expect(page.getByTestId('player-notes')).toHaveCount(0);
});
