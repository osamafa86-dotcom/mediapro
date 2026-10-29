import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { csrf, ctx, login, mails, uploadFile, write } from './helpers';
import { seed, sql, type Seed } from './seed';

/*
 * M5 — the client portal on real processed media: «مكتبتي», the project grid, the viewer, the player,
 * single / selected / group / whole-project downloads (ZIP64 or per-file links), the guest, both languages.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
const ids = { cam: '', raw: '', clip: '', photos: [] as string[] };
const H = { origin: E2E_ENV.APP_ORIGIN };
test.describe.configure({ mode: 'serial' });

async function ready(id: string, until: (r: Record<string, unknown>) => boolean = (r) => r.status === 'ready', timeout = 120_000) {
  const db = sql();
  try {
    await expect.poll(async () => {
      const [r] = await db<Record<string, unknown>[]>`select status, error, renditions from assets where id = ${id}`;
      if (r?.status === 'failed') throw new Error(`asset failed: ${r.error}`);
      return !!r && until(r);
    }, { timeout, intervals: [500] }).toBe(true);
  } finally { await db.end(); }
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  S = await seed();
  FX = await makeFixtures();
  const admin = await login('admin@e2e.test');
  ids.cam = await uploadFile(admin, S.p1, FX.cam, { mime: 'image/jpeg' });
  ids.raw = await uploadFile(admin, S.p1, FX.raw, { mime: 'image/x-adobe-dng' });
  for (const f of FX.photos) ids.photos.push(await uploadFile(admin, S.p1, f, { mime: 'image/jpeg' }));
  ids.clip = await uploadFile(admin, S.p1, FX.clip, { mime: 'video/mp4' });
  for (const id of [ids.cam, ids.raw, ...ids.photos]) await ready(id);
  await ready(ids.clip, (r) => !!(r.renditions as { mp4_1080?: string }).mp4_1080);
  // the seeded rows (no files, no renditions) would only be noise here
  const db = sql();
  await db`delete from assets where id in (${S.assetFinal}, ${S.assetRaw}, ${S.assetP2})`;
  await db.end();
});

/** Admin issues a link; the viewer opens it with the PIN. Returns a request context with the viewer session. */
async function issue(body: Record<string, unknown>) {
  const admin = await login('admin@e2e.test');
  const r = await write(admin, 'POST', '/api/admin/links', body);
  expect(r.status()).toBe(201);
  return (await r.json()) as { id: string; path: string; pin: string };
}
async function viewer(body: Record<string, unknown> = { clientId: S.clientX }): Promise<APIRequestContext> {
  const l = await issue(body);
  const c = await ctx();
  expect((await c.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  return c;
}
async function openAs(page: Page, body: Record<string, unknown> = { clientId: S.clientX }, locale = 'ar') {
  const l = await issue(body);
  await page.context().addCookies([{ name: 'locale', value: locale, url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  return l;
}
const loaded = (page: Page, sel: string) => expect.poll(() => page.locator(`${sel} img`).evaluateAll((imgs) =>
  imgs.length > 0 && imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 15_000 }).toBe(true);
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
const shot = (page: Page, name: string, info: { project: { name: string } }) => page.screenshot({ path: `test-results/portal/${name}-${info.project.name}.png` });

test('«مكتبتي»: published, unexpired, unarchived projects with covers; the soonest expiry is announced', async ({ page }, info) => {
  const db = sql();
  await db`update projects set expires_at = now() + interval '3 days' where id = ${S.p1}`;
  await openAs(page);
  await page.goto('/library');
  const cards = page.getByTestId('client-library').locator('[data-project-id]');
  await expect(cards).toHaveCount(2); // p1 and p2; never the draft or the expired one
  await expect(page.getByTestId('expiring')).toContainText('«توزيع الطرود الغذائية — رفح»');
  await expect(page.getByTestId('expiring')).toContainText('بعد 3 أيام');
  await loaded(page, `[data-project-id="${S.p1}"]`);
  await expect(page.locator(`[data-project-id="${S.p1}"]`)).toContainText('5 صور');
  await noOverflow(page);
  await shot(page, 'library', info);
  // archived = gone for the client, at once
  await db`update projects set archived_at = now() where id = ${S.p2}`;
  await page.reload();
  await expect(cards).toHaveCount(1);
  await db`update projects set archived_at = null, expires_at = null where id in (${S.p1}, ${S.p2})`;
  await db.end();
});

test('project page: justified grid of real thumbnails; «خام» only for a client allowed raw', async ({ page }, info) => {
  await openAs(page);
  await page.goto(`/p/${S.p1}`);
  const grid = page.getByTestId('photo-grid');
  await expect(grid.locator('[data-asset-id]')).toHaveCount(5);
  await expect(grid.locator(`[data-asset-id="${ids.raw}"]`)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'المجموعات' })).toHaveCount(0); // a single group needs no chips
  await loaded(page, '[data-testid=photo-grid]');
  // justified: every row but the last spans the grid's full width
  const spans = await grid.evaluate((g) => {
    const gr = g.getBoundingClientRect();
    const rows = new Map<number, { l: number; r: number }>();
    for (const e of g.querySelectorAll('[data-asset-id]')) {
      const b = e.getBoundingClientRect(); const k = Math.round(b.top); const cur = rows.get(k);
      rows.set(k, { l: Math.min(cur?.l ?? Infinity, b.left), r: Math.max(cur?.r ?? -Infinity, b.right) });
    }
    return { width: gr.width, rows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.r - v.l) };
  });
  expect(spans.rows.length).toBeGreaterThan(1);
  for (const w of spans.rows.slice(0, -1)) expect(Math.abs(w - spans.width)).toBeLessThan(3);
  await expect(page.getByTestId('download-all')).toContainText('تنزيل المشروع كاملًا');
  await noOverflow(page);
  await shot(page, 'project', info);

  const db = sql();
  await db`update clients set allow_raw = true where id = ${S.clientX}`;
  await page.reload();
  await page.getByRole('button', { name: /خام · 1/ }).click();
  await expect(grid.locator(`[data-asset-id="${ids.raw}"]`)).toHaveCount(1);
  await expect(page).toHaveURL(/group=raw/);
  await db`update clients set allow_raw = false where id = ${S.clientX}`;
  await db.end();
});

test('viewer: pure black, the file name and both download choices; arrows move, Escape closes', async ({ page }, info) => {
  await openAs(page);
  await page.goto(`/p/${S.p1}`);
  await page.getByTestId('photo-grid').locator('[data-asset-id] button[aria-label]').first().click();
  const foot = page.getByTestId('viewer-footer');
  await expect(foot).toBeVisible();
  const first = await foot.locator('[dir=ltr]').first().textContent();
  await expect(foot.getByRole('link', { name: /تنزيل الأصل/ })).toHaveAttribute('href', /^\/api\/download\/[0-9a-f-]{36}$/);
  await expect(foot.getByRole('link', { name: 'نسخة الويب 2048px' })).toHaveAttribute('href', /\?v=web$/);
  await shot(page, 'viewer', info);
  await expect(page.locator('.yarl__slide_current img')).toHaveJSProperty('complete', true);
  await page.keyboard.press('ArrowLeft'); // RTL: «next» is to the left
  await expect.poll(() => foot.locator('[dir=ltr]').first().textContent()).not.toBe(first);
  await expect(page.locator('.yarl__counter')).toHaveText('2 / 5');
  await page.waitForTimeout(400);
  await shot(page, 'viewer', info);
  await page.keyboard.press('Escape');
  await expect(foot).toHaveCount(0);
});

test('selection → one ZIP (STORE, ZIP64-capable) with the right files, names and bytes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one download check is enough');
  await openAs(page);
  await page.goto(`/p/${S.p1}`);
  const cam = page.locator(`[data-asset-id="${ids.cam}"]`);
  const sq = page.locator(`[data-asset-id="${ids.photos[3]}"]`);
  await cam.hover(); await cam.getByRole('checkbox').click();
  await sq.hover(); await sq.getByRole('checkbox').click();
  const bar = page.getByTestId('selection-bar');
  await expect(bar).toContainText('عنصران محدّدان');
  const [dl] = await Promise.all([page.waitForEvent('download'), bar.getByRole('button', { name: 'تنزيل المحدد' }).click()]);
  expect(dl.suggestedFilename()).toBe('توزيع الطرود الغذائية — رفح.zip');
  const zip = join(info.outputDir, 'sel.zip');
  await dl.saveAs(zip);
  const list = execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n').sort();
  expect(list).toEqual(['الصور/نهائي/cam.jpg', 'الصور/نهائي/ممر الطرود.jpg'].sort());
  execFileSync('unzip', ['-tq', zip]); // CRCs check out
  const out = join(info.outputDir, 'x');
  execFileSync('unzip', ['-oq', zip, '-d', out]);
  expect(readFileSync(join(out, 'الصور/نهائي/cam.jpg')).equals(readFileSync(FX.cam))).toBe(true);
  expect(execFileSync('zipinfo', ['-v', zip]).toString()).toMatch(/compression method:\s+none \(stored\)/);
  const db = sql();
  const [row] = await db<{ kind: string; bytes: string }[]>`select kind, bytes from downloads order by at desc limit 1`;
  expect(row).toEqual({ kind: 'zip', bytes: String(statSync(FX.cam).size + statSync(FX.photos[3]!).size) });
  await db.end();
});

test('a group downloads as one ZIP; the whole project above the limit becomes per-file links', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one download check is enough');
  await openAs(page);
  await page.goto(`/p/${S.p1}`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-group').click()]);
  const zip = join(info.outputDir, 'group.zip');
  await dl.saveAs(zip);
  expect(execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n')).toHaveLength(5);
  // 5 photos + a 10 MB video > the e2e limit of 5 MB → links, one per file, each a real attachment
  await page.getByTestId('download-all').click();
  const box = page.getByTestId('links-fallback');
  await expect(box).toBeVisible();
  await expect(box.locator('li')).toHaveCount(6);
  const href = await box.getByRole('link', { name: 'clip.mp4' }).getAttribute('href');
  const r = await fetch(href!);
  expect(r.status).toBe(200);
  // the signed URL asks storage to answer as an attachment with the original name (R2 honours it; the moto stand-in ignores it)
  expect(new URL(href!).searchParams.get('response-content-disposition')).toContain("filename*=UTF-8''clip.mp4");
  expect((await r.arrayBuffer()).byteLength).toBe(statSync(FX.clip).size);
});

test('single files: the original or the web copy, with the right names; counted once each', async () => {
  const c = await viewer();
  const r = await c.get(`/api/download/${ids.photos[3]}`, { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  const loc = new URL(r.headers()['location']!);
  expect(loc.searchParams.get('response-content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('ممر الطرود.jpg')}`);
  expect(loc.searchParams.get('X-Amz-Expires')).toBe('600');
  const bytes = Buffer.from(await (await fetch(loc)).arrayBuffer());
  expect(bytes.equals(readFileSync(FX.photos[3]!))).toBe(true);
  const web = await c.get(`/api/download/${ids.cam}?v=web`, { maxRedirects: 0 });
  expect(new URL(web.headers()['location']!).searchParams.get('response-content-disposition')).toContain('cam-2048.jpg');
  const vid = await c.get(`/api/download/${ids.clip}?v=web`, { maxRedirects: 0 });
  expect(new URL(vid.headers()['location']!).searchParams.get('response-content-disposition')).toContain('clip-1080p.mp4');
  // RAW is not this client's to take (allow_raw is off), and nothing outside their projects is
  expect((await c.get(`/api/download/${ids.raw}`, { maxRedirects: 0 })).status()).toBe(404);
  const db = sql();
  const [n] = await db<{ downloads: number }[]>`select downloads from assets where id = ${ids.photos[3]!}`;
  expect(n!.downloads).toBeGreaterThanOrEqual(1);
  await db.end();
});

test('guest: view only — no download, no selection, no «خام», and the server refuses too', async ({ page }, info) => {
  const db = sql();
  await db`update clients set allow_raw = true where id = ${S.clientX}`; // even then: never for a guest
  await openAs(page, { clientId: S.clientX, projectId: S.p1, kind: 'guest' });
  await page.goto(`/p/${S.p1}`);
  await expect(page.getByTestId('client-project')).toHaveAttribute('data-kind', 'guest');
  await expect(page.getByRole('note')).toContainText('عرض فقط');
  await expect(page.getByTestId('download-all')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('a[href^="/api/download"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /خام/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'مكتبتي' })).toHaveCount(0);
  await loaded(page, '[data-testid=photo-grid]');
  await shot(page, 'guest', info);
  await page.getByTestId('photo-grid').locator('[data-asset-id] button').first().click();
  await expect(page.getByTestId('viewer-footer')).toBeVisible();
  await expect(page.getByTestId('viewer-footer').getByRole('link')).toHaveCount(0);
  const r = page.request;
  expect((await r.get(`/api/download/${ids.cam}`, { maxRedirects: 0 })).status()).toBe(403);
  const vc = (await page.context().cookies()).find((k) => k.name.endsWith('ml_vcsrf'))!.value;
  expect((await r.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': vc }, data: { projectId: S.p1, label: 'x' } })).status()).toBe(403);
  await db`update clients set allow_raw = false where id = ${S.clientX}`;
  await db.end();
});

test('tickets: only the session that made one can use it, only with CSRF, and only for an hour', async () => {
  const a = await viewer();
  const tok = async (c: APIRequestContext) => (await c.storageState()).cookies.find((k) => k.name.endsWith('ml_vcsrf'))?.value ?? '';
  expect((await a.post('/api/download/prepare', { headers: H, data: { projectId: S.p1, ids: [ids.cam], label: 'x' } })).status()).toBe(403); // no token
  const ok = await a.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': await tok(a) }, data: { projectId: S.p1, ids: [ids.cam], label: 'x' } });
  expect(ok.status()).toBe(200);
  const { url, mode } = (await ok.json()) as { url: string; mode: string };
  expect(mode).toBe('zip');
  // another viewer of the same client, a staff member, nobody: not theirs
  expect((await (await viewer()).get(url)).status()).toBe(404);
  expect((await (await login('admin@e2e.test')).get(url)).status()).toBe(404);
  expect((await (await ctx()).get(url)).status()).toBe(401);
  // another client's project cannot even be prepared
  expect((await a.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': await tok(a) }, data: { projectId: S.p3, label: 'x' } })).status()).toBe(404);
  // ids from elsewhere are silently not included (the RAW without permission)
  const raw = await a.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': await tok(a) }, data: { projectId: S.p1, ids: [ids.raw], label: 'x' } });
  expect(raw.status()).toBe(404);
  expect((await a.get(url)).status()).toBe(200);
  const db = sql();
  await db`update download_tickets set expires_at = now() - interval '1 minute' where id = ${url.split('/').pop()!}`;
  await db.end();
  expect((await a.get(url)).status()).toBe(410);
  // a link with downloads switched off
  const off = await viewer({ clientId: S.clientX, allowDownload: false });
  expect((await off.get(`/api/download/${ids.cam}`, { maxRedirects: 0 })).status()).toBe(403);
});

test('the admin export works without any PIN, RAW included', async () => {
  const admin = await login('admin@e2e.test');
  const r = await admin.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': await csrf(admin) }, data: { projectId: S.p1, section: 'photos', label: 'export' } });
  expect(r.status()).toBe(200);
  const j = (await r.json()) as { mode: string; count: number };
  expect(j).toMatchObject({ mode: 'zip', count: 6 }); // 5 final + the RAW
});

test('first download mails the admin once when the link asked for it', async () => {
  const c = await viewer({ clientId: S.clientX, notifyFirstDownload: true });
  const before = (await mails()).filter((m) => m.subject.startsWith('أول تنزيل')).length;
  await c.get(`/api/download/${ids.cam}`, { maxRedirects: 0 });
  await c.get(`/api/download/${ids.photos[0]}`, { maxRedirects: 0 });
  await expect.poll(async () => (await mails()).filter((m) => m.subject.startsWith('أول تنزيل')).length).toBe(before + 1);
});

test('player: streams, switches quality, previews the scrub position, and keys move the time', async ({ page }, info) => {
  await openAs(page);
  await page.goto(`/p/${S.p1}?tab=videos`);
  const card = page.getByTestId('video-grid').locator(`[data-asset-id="${ids.clip}"]`);
  await expect(card).toContainText('00:06');
  await card.getByRole('link', { name: 'clip.mp4' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/p/${S.p1}/v/${ids.clip}$`));
  const player = page.getByTestId('player');
  await expect(player).toHaveAttribute('dir', 'ltr'); // the time bar never mirrors
  await page.getByTestId('play').click();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(0.5);
  const q = page.getByTestId('quality');
  await expect(q.locator('option')).toHaveText([/^تلقائي/, '1080p', '720p', '360p']);
  await q.selectOption({ label: '360p' });
  await page.locator('video').evaluate((v: HTMLVideoElement) => v.pause());
  const at = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.locator('body').press('ArrowLeft');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(Math.max(at - 1, 0.01));
  if (info.project.name === 'desktop') {
    const track = player.locator('input[type=range]').locator('..');
    const box = (await track.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
    await expect(player.getByText(/^00:0[3-4]$/)).toBeVisible(); // the hover time over the sprite frame
  }
  await expect(page.getByRole('link', { name: /تنزيل الأصل/ })).toHaveAttribute('href', `/api/download/${ids.clip}`);
  await expect(page.getByRole('link', { name: 'نسخة 1080p' })).toHaveAttribute('href', `/api/download/${ids.clip}?v=web`);
  await noOverflow(page);
  await shot(page, 'player', info);
});

test('Turkish: LTR, Turkish words, same data', async ({ page }, info) => {
  await openAs(page, { clientId: S.clientX }, 'tr');
  await page.goto(`/p/${S.p1}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByTestId('download-all')).toContainText('Projenin tamamını indir');
  await expect(page.getByRole('radio', { name: /Fotoğraflar/ })).toBeChecked();
  await expect(page.getByTestId('photo-grid').locator('[data-asset-id]')).toHaveCount(5);
  await loaded(page, '[data-testid=photo-grid]');
  await noOverflow(page);
  await shot(page, 'project-tr', info);
  await page.goto(`/p/${S.p1}/v/${ids.clip}`);
  await expect(page.getByText('Bu projede · 1 video')).toBeVisible();
  await shot(page, 'player-tr', info);
});

