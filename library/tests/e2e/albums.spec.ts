import { expect, test } from '@playwright/test';
import { makeFixtures } from './fixtures/media';
import { ctx, H, login, uploadFile, write } from './helpers';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/*
 * Albums inside a project («مونتاج», a second documentation the same day): made by the admin or the project's team,
 * uploaded into directly or filled by moving files; deleting one returns its files to the main sections.
 * The client sees each album as its own tab. Then: the admin deletes whole projects, and the project form offers
 * the names and types used before.
 */

let S: Seed;
let FX: Awaited<ReturnType<typeof makeFixtures>>;
let album = '';
let inAlbum = '';
let main = '';
test.describe.configure({ mode: 'serial' });

const db = async <T,>(f: (q: ReturnType<typeof sql>) => Promise<T>) => { const q = sql(); try { return await f(q); } finally { await q.end(); } };
const albumOf = (id: string) => db(async (q) => (await q<{ album_id: string | null }[]>`select album_id from assets where id = ${id}`)[0]?.album_id ?? null);
const ready = (ids: string[]) => expect.poll(() => db(async (q) => (await q`select 1 from assets where id = any(${ids}::uuid[]) and status = 'ready'`).length), { timeout: 90_000, intervals: [500] }).toBe(ids.length);

test.beforeAll(async () => {
  S = await seed();
  FX = await makeFixtures();
});

test('who makes albums: the admin and the project’s team; not someone else’s project; one name once', async () => {
  const admin = await login('admin@e2e.test');
  const r = await write(admin, 'POST', `/api/admin/projects/${S.p1}/albums`, { name: 'مونتاج' });
  expect(r.status()).toBe(200);
  album = ((await r.json()) as { id: string }).id;
  expect((await write(admin, 'POST', `/api/admin/projects/${S.p1}/albums`, { name: 'مونتاج' })).status()).toBe(409);
  expect((await write(admin, 'POST', `/api/admin/projects/${S.p1}/albums`, { name: '' })).status()).toBe(400);
  // photographer A works on P1; B does not
  const a = await login('a@e2e.test');
  const second = await write(a, 'POST', `/api/admin/projects/${S.p1}/albums`, { name: 'توثيق ثانٍ' });
  expect(second.status()).toBe(200);
  const b = await login('b@e2e.test');
  expect((await write(b, 'POST', `/api/admin/projects/${S.p1}/albums`, { name: 'x' })).status()).toBe(404);
  expect((await write(b, 'PATCH', `/api/admin/albums/${album}`, { name: 'x' })).status()).toBe(404);
  // A may rename the admin's album (they work on it) but not delete it; their own one, yes
  expect((await write(a, 'PATCH', `/api/admin/albums/${album}`, { name: 'المونتاج' })).status()).toBe(200);
  expect((await write(a, 'DELETE', `/api/admin/albums/${album}`)).status()).toBe(403);
  expect((await write(a, 'PATCH', `/api/admin/albums/${album}`, { name: 'مونتاج' })).status()).toBe(200);
  const secondId = ((await second.json()) as { id: string }).id;
  expect((await write(a, 'DELETE', `/api/admin/albums/${secondId}`)).status()).toBe(200);
});

test('upload straight into an album; move files in and out; a deleted album gives its files back', async () => {
  const admin = await login('admin@e2e.test');
  inAlbum = await uploadFile(admin, S.p1, FX.photos[0]!, { mime: 'image/jpeg', albumId: album });
  main = await uploadFile(admin, S.p1, FX.photos[1]!, { mime: 'image/jpeg' });
  expect(await albumOf(inAlbum)).toBe(album);
  expect(await albumOf(main)).toBeNull();
  // an album of another project is refused at the start of the upload
  const [other] = await db((q) => q<{ id: string }[]>`insert into project_albums (project_id, name) values (${S.p2}, 'غريب') returning id`);
  const bad = await write(admin, 'POST', '/api/uploads', { projectId: S.p1, filename: 'x.jpg', size: 10, mime: 'image/jpeg', fingerprint: 'fx-bad-album', albumId: other!.id });
  expect(bad.status()).toBe(404);
  await ready([inAlbum, main]);

  // move the main photo in, then back out
  expect((await write(admin, 'POST', '/api/admin/assets/move', { ids: [main], albumId: album })).status()).toBe(200);
  expect(await albumOf(main)).toBe(album);
  // the album's order covers both its photos, and only those
  expect((await write(admin, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', albumId: album, ids: [main, inAlbum] })).status()).toBe(200);
  expect((await write(admin, 'PUT', `/api/admin/projects/${S.p1}/order`, { section: 'photos', albumId: album, ids: [main] })).status()).toBe(409);
  expect((await write(admin, 'POST', '/api/admin/assets/move', { ids: [main], albumId: null })).status()).toBe(200);
  expect(await albumOf(main)).toBeNull();
  // into an album of another project: no
  expect((await write(admin, 'POST', '/api/admin/assets/move', { ids: [main], albumId: other!.id })).status()).toBe(404);
  // B does not work on P1
  expect((await write(await login('b@e2e.test'), 'POST', '/api/admin/assets/move', { ids: [main], albumId: album })).status()).toBe(404);

  // an album deleted: its files return, nothing is lost
  const [tmp] = await db((q) => q<{ id: string }[]>`insert into project_albums (project_id, name) values (${S.p1}, 'مؤقت') returning id`);
  expect((await write(admin, 'POST', '/api/admin/assets/move', { ids: [main], albumId: tmp!.id })).status()).toBe(200);
  const del = await write(admin, 'DELETE', `/api/admin/albums/${tmp!.id}`);
  expect(((await del.json()) as { returned: number }).returned).toBe(1);
  expect(await albumOf(main)).toBeNull();
  expect(await db(async (q) => (await q`select 1 from assets where id = ${main}`).length)).toBe(1);
});

test('the client: the album is its own tab, the main photos do not repeat it, and the ZIP keeps it in its folder', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the data; the tabs are the same component');
  const admin = await login('admin@e2e.test');
  const l = (await (await write(admin, 'POST', '/api/admin/links', { clientId: S.clientX })).json()) as { path: string; pin: string };
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  await page.goto(`/p/${S.p1}`);
  const tabs = page.getByRole('radiogroup', { name: 'الأقسام' });
  const albumTab = tabs.getByRole('radio', { name: /مونتاج/ });
  await expect(albumTab).toBeVisible();
  // the empty «توثيق ثانٍ» was deleted; an album the client cannot see anything in shows no tab at all
  await expect(tabs.getByRole('radio', { name: /غريب/ })).toHaveCount(0);
  await expect(page.locator(`[data-asset-id="${inAlbum}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-asset-id="${main}"]`)).toHaveCount(1);
  await albumTab.click();
  await expect(page.locator(`[data-asset-id="${inAlbum}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-asset-id="${main}"]`)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`tab=${album}`));
  // «تنزيل المشروع كاملًا»: the album's photo sits under «مونتاج/»
  const client = await ctx();
  expect((await client.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
  const csrf = (await client.storageState()).cookies.find((c) => c.name.endsWith('ml_vcsrf'))?.value ?? '';
  const prep = await client.post('/api/download/prepare', { headers: { ...H, 'x-csrf-token': csrf }, data: { projectId: S.p1, ids: [inAlbum, main], label: 'all' } });
  expect(prep.status(), await prep.text()).toBe(200);
  const p = (await prep.json()) as { mode: string; url: string };
  expect(p.mode).toBe('zip');
  const zip = Buffer.from(await (await client.get(p.url)).body());
  const names = zip.toString('latin1');
  expect(names).toContain(Buffer.from('مونتاج/').toString('latin1'));
});

test('the project page: «ألبوم جديد», its tab, and «نقل إلى…» from the photos', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto(`/admin/projects/${S.p1}`);
  await page.getByTestId('new-album').click();
  const dlg = page.getByTestId('album-dialog');
  await dlg.getByRole('button', { name: 'مقابلات' }).click(); // a suggested name fills the field
  await expect(dlg.getByRole('textbox')).toHaveValue('مقابلات');
  await dlg.getByRole('button', { name: 'إنشاء الألبوم' }).click();
  await expect(page).toHaveURL(/tab=[0-9a-f-]{36}/);
  await expect(page.getByTestId('album-head')).toContainText('مقابلات');
  await expect(page.getByText('لا مواد في هذا الألبوم بعد')).toBeVisible();
  await expect(page.getByRole('link', { name: 'رفع إلى هذا الألبوم' })).toHaveAttribute('href', /\/upload\/.+\?album=/);

  // from the photos: select → «نقل إلى…» → the new album
  await page.getByTestId('project-tabs').getByRole('tab', { name: /الصور/ }).click();
  const tile = page.getByTestId('media-grid').locator(`li[data-asset-id="${main}"]`);
  await expect(tile).toBeVisible();
  await page.getByTestId('select-mode').click();
  await tile.click();
  await page.getByTestId('move-selected').click();
  await page.getByTestId('move-dialog').getByRole('button', { name: 'مقابلات' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'نُقلت مادة واحدة إلى «مقابلات»' })).toBeVisible();
  await expect(tile).toHaveCount(0);
  await page.getByTestId('project-tabs').getByRole('tab', { name: /مقابلات/ }).click();
  await expect(page.getByTestId('media-grid').locator(`li[data-asset-id="${main}"]`)).toBeVisible();
  // and the album goes: its file returns
  await page.getByTestId('album-head').getByRole('button', { name: /^المزيد: / }).click();
  await page.getByRole('menuitem', { name: 'حذف الألبوم' }).click();
  await expect(page.getByTestId('album-delete')).toContainText('مادة واحدة فيه تعود');
  await page.getByTestId('album-delete').getByRole('button', { name: 'حذف الألبوم' }).click();
  await expect(page).not.toHaveURL(/tab=/);
  await expect(page.getByTestId('media-grid').locator(`li[data-asset-id="${main}"]`)).toBeVisible();
});

test('upload page: choose an album, or make one on the spot', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'a@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto(`/upload/${S.p1}?album=${album}`);
  const sel = page.getByTestId('album-select');
  await expect(sel).toHaveValue(album);
  await sel.selectOption('__new');
  await page.getByTestId('album-name').fill('الفترة المسائية');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(page.getByTestId('album-select')).toBeVisible();
  const chosen = await page.getByTestId('album-select').inputValue();
  expect(chosen).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByTestId('file-input').setInputFiles(FX.photos[2]!);
  await expect.poll(() => db(async (q) => (await q`select 1 from assets where album_id = ${chosen}`).length), { timeout: 30_000 }).toBe(1);
});

test('the admin deletes a whole project: rows at once, storage by the worker; nobody else can', async () => {
  const admin = await login('admin@e2e.test');
  const a = await login('a@e2e.test');
  expect((await write(a, 'DELETE', `/api/admin/projects/${S.p1}`)).status()).toBe(403);
  expect((await write(a, 'POST', '/api/admin/projects/bulk', { ids: [S.p1], action: 'delete' })).status()).toBe(403);
  const r = await write(admin, 'DELETE', `/api/admin/projects/${S.p1}`);
  expect(r.status(), await r.text()).toBe(200);
  const left = await db(async (q) => ({
    project: (await q`select 1 from projects where id = ${S.p1}`).length,
    assets: (await q`select 1 from assets where project_id = ${S.p1}`).length,
    albums: (await q`select 1 from project_albums where project_id = ${S.p1}`).length,
    jobs: (await q`select 1 from graphile_worker.jobs where key in (${`purge-project:${S.p1}`}, ${`purge-project-late:${S.p1}`})`).length
      + (await q`select 1 from graphile_worker._private_jobs where key in (${`purge-project:${S.p1}`}, ${`purge-project-late:${S.p1}`})`.catch(() => [])).length,
    audit: (await q`select 1 from audit_log where action = 'project.deleted' and target_id = ${S.p1}`).length,
  }));
  expect(left.project).toBe(0);
  expect(left.assets).toBe(0);
  expect(left.albums).toBe(0);
  expect(left.audit).toBe(1);
  expect(left.jobs).toBeGreaterThanOrEqual(1); // the late purge waits an hour; the first may already have run
  expect((await write(admin, 'DELETE', `/api/admin/projects/${S.p1}`)).status()).toBe(404);
});

test('archive: the admin deletes selected projects after ticking «أفهم…»', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto('/admin/archive?view=table');
  await page.getByRole('checkbox', { name: /مسودة/ }).check();
  await page.getByTestId('selection-bar').getByTestId('bulk-delete').click();
  const dlg = page.getByTestId('delete-project-dialog');
  const go = dlg.getByRole('button', { name: 'احذف نهائيًا' });
  await expect(go).toBeDisabled();
  await dlg.getByTestId('delete-sure').check();
  await go.click();
  await expect(page.getByRole('status')).toContainText('حُذف مشروع واحد');
  await expect(page.getByTestId('archive-table')).not.toContainText('مسودة');
  expect(await db(async (q) => (await q`select 1 from projects where id = ${S.draft}`).length)).toBe(0);
});

test('the project form offers names and types used before; a team member sees the types, not the admin’s names', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  const admin = await login('admin@e2e.test');
  const r = await write(admin, 'POST', '/api/admin/projects', { title: 'توزيع الطرود الغذائية', clientId: S.clientX, type: 'توزيع مساعدات' });
  expect(r.status()).toBe(201);
  const presets = await db((q) => q<{ kind: string; value: string }[]>`select kind, value from project_presets order by kind, value`);
  expect(presets).toEqual(expect.arrayContaining([{ kind: 'title', value: 'توزيع الطرود الغذائية' }, { kind: 'type', value: 'توزيع مساعدات' }]));

  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto('/admin/archive');
  await page.getByRole('button', { name: 'مشروع جديد' }).click();
  const dlg = page.getByTestId('project-dialog');
  const title = dlg.getByRole('combobox', { name: 'اسم المشروع' });
  // «طرود» with nothing else: the saved name is offered; hamza and taa marbuta do not matter
  await title.fill('الطرود');
  await page.getByRole('option', { name: 'توزيع الطرود الغذائية', exact: true }).click();
  await expect(title).toHaveValue('توزيع الطرود الغذائية');
  const type = dlg.getByRole('combobox', { name: 'نوع المشروع' });
  await type.fill('مساعدات');
  await page.getByRole('option', { name: 'توزيع مساعدات', exact: true }).click();
  await expect(type).toHaveValue('توزيع مساعدات');
  // a new value is accepted as typed
  await type.fill('حملة شتوية');
  await expect(type).toHaveValue('حملة شتوية');
  // the list can be trimmed (projects keep their names)
  await dlg.getByTestId('manage-presets').click();
  await page.getByTestId('presets-dialog').getByRole('button', { name: 'حذف «توزيع مساعدات» من القائمة' }).click();
  await expect(page.getByTestId('presets-dialog')).not.toContainText('توزيع مساعدات');
  expect(await db(async (q) => (await q`select 1 from project_presets where kind = 'type' and value = 'توزيع مساعدات'`).length)).toBe(0);
  expect(await db(async (q) => (await q`select 1 from projects where type = 'توزيع مساعدات'`).length)).toBe(1);

  // a photographer: the admin's names stay private, the types are shared, their own names come back
  await db((q) => q`insert into project_presets (kind, value, created_by) values ('type', 'فعالية', ${S.admin}) on conflict do nothing`);
  const a = await login('a@e2e.test');
  expect((await write(a, 'POST', '/api/admin/presets', { kind: 'type', value: 'فعالية' })).status()).toBe(404); // not theirs to remove
  expect((await write(a, 'POST', '/api/admin/projects', { title: 'تصوير ميداني', type: 'فعالية' })).status()).toBe(201);
  await page.context().clearCookies();
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'a@e2e.test', password: PASSWORD } })).status()).toBe(200);
  await page.goto('/admin/archive');
  await page.getByRole('button', { name: 'مشروع جديد' }).click();
  // the arrow opens the whole list (typing filters it)
  await page.getByTestId('project-dialog').getByTestId('title-combo').getByRole('button').click();
  await expect(page.getByRole('option', { name: 'تصوير ميداني', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'توزيع الطرود الغذائية', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('project-dialog').getByTestId('type-combo').getByRole('button').click();
  await expect(page.getByRole('option', { name: 'فعالية', exact: true })).toBeVisible();
});
