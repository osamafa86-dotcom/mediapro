import { expect, test, type Page } from '@playwright/test';
import { E2E_ENV } from './env';
import { makeFixtures } from './fixtures/media';
import { ctx, login } from './helpers';
import { PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M6 Drive import end to end against tests/e2e/fixtures/fake-google.mjs: consent → encrypted refresh
 * token → browse with suggestions → plan → the worker streams Drive → R2 → assets processed → report.
 */

let S: Seed;
const H = { origin: E2E_ENV.APP_ORIGIN };
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await makeFixtures(); });

async function admin(page: Page) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: H, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
}

test.describe('drive', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'admin tool, one viewport'); });

  test('connect: Google consent, back with the right state, the refresh token stored encrypted', async ({ page }) => {
    await admin(page);
    await page.goto('/admin/import');
    await expect(page.getByTestId('drive-connect')).toBeVisible();
    await page.getByRole('link', { name: 'ربط Google Drive' }).click();
    await page.waitForURL(/\/admin\/import\?drive=connected/);
    await expect(page.getByRole('status')).toHaveText('رُبط الحساب.');
    await expect(page.getByTestId('drive-browser')).toContainText('archive@emdatra.test');
    const db = sql();
    const [g] = await db<{ refresh_token_enc: string; email: string }[]>`select refresh_token_enc, email from google_tokens where user_id = ${S.admin}`;
    expect(g!.email).toBe('archive@emdatra.test');
    expect(g!.refresh_token_enc).not.toContain('fake-refresh-token');
    expect(g!.refresh_token_enc.split('.')).toHaveLength(3); // iv.tag.ciphertext
    await db.end();
  });

  test('a forged callback (wrong state) changes nothing; only admins reach any of it', async ({ page }) => {
    await admin(page);
    const r = await page.request.get('/api/admin/drive/callback?code=fake-code&state=forged', { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    expect(r.headers()['location']).toBe('/admin/import?drive=bad_state');
    const a = await login('a@e2e.test');
    for (const p of ['/api/admin/drive/connect', '/api/admin/drive/folders']) expect((await a.get(p, { maxRedirects: 0 })).status(), p).toBe(403);
    expect((await (await ctx()).get('/api/admin/drive/folders')).status()).toBe(401);
  });

  test('browse: each folder with its suggested client and date; folders open', async ({ page }) => {
    await admin(page);
    await page.goto('/admin/import');
    const list = page.getByTestId('drive-browser');
    await expect(list.locator('[data-folder-id]')).toHaveCount(3);
    await expect(list.locator('[data-folder-id="f-grad"]')).toContainText('مؤسسة النور للتنمية');
    await expect(list.locator('[data-folder-id="f-grad"]')).toContainText('2025-03-14');
    await expect(list.locator('[data-folder-id="f-ist"]')).toContainText('بلا اقتراح عميل');
    await expect(list.locator('[data-folder-id="f-ist"]')).toContainText('2024-06-12');
    await page.screenshot({ path: 'test-results/drive/browse.png', fullPage: true });
    await list.locator('[data-folder-id="f-grad"]').getByRole('button', { name: 'فتح' }).click();
    await expect(list.locator('[data-folder-id]')).toHaveCount(1);
    await expect(list.locator('[data-folder-id="f-raw"]')).toContainText('RAW');
    await list.getByRole('button', { name: 'Drive' }).click();
    await expect(list.locator('[data-folder-id]')).toHaveCount(3);
  });

  test('import: files stream to storage, become assets in the right groups, and the report tells what failed', async ({ page }) => {
    test.setTimeout(180_000);
    await admin(page);
    await page.goto('/admin/import');
    const list = page.getByTestId('drive-browser');
    await list.locator('[data-folder-id="f-grad"] input[type=checkbox]').check();
    await list.locator('[data-folder-id="f-ist"] input[type=checkbox]').check();
    const plan = page.getByTestId('drive-plan');
    // the İstanbul folder has no suggested client: refused until one is chosen
    await page.getByTestId('drive-start').click();
    await expect(page.getByRole('status')).toHaveText('اختر عميلًا لكل مجلد.');
    await plan.locator('[data-plan-for="f-ist"] select').first().selectOption(S.clientY);
    await expect(plan.locator('[data-plan-for="f-grad"] input').first()).toHaveValue('حفل تخرج مؤسسة النور');
    await page.screenshot({ path: 'test-results/drive/plan.png', fullPage: true });
    await page.getByTestId('drive-start').click();
    await expect(page.getByRole('status')).toHaveText('بدأ الاستيراد في الخلفية. يمكنك مغادرة الصفحة.');

    const db = sql();
    const imps = () => db<{ folder_id: string; status: string; total: number; done: number; failed: number; project_id: string; report: { file: string; ok: boolean; error?: string }[] }[]>`
      select folder_id, status, total, done, failed, project_id, report from drive_imports order by folder_id`;
    await expect.poll(async () => (await imps()).map((i) => i.status), { timeout: 60_000 }).toEqual(['done', 'done']);
    const [grad, ist] = (await imps()).sort((a) => (a.folder_id === 'f-grad' ? -1 : 1));
    expect(grad).toMatchObject({ total: 4, done: 3, failed: 1 });
    expect(grad!.report.find((r) => !r.ok)).toEqual({ file: 'ملاحظات', ok: false, error: 'not_media' });
    expect(ist).toMatchObject({ total: 2, done: 1, failed: 1 });
    expect(ist!.report.find((r) => !r.ok)).toEqual({ file: 'broken.jpg', ok: false, error: 'not_found' });

    // a new project per folder, from the suggestion, waiting for review
    const [p] = await db<{ title: string; shot_date: string; status: string; client_id: string }[]>`select title, shot_date::text, status, client_id from projects where id = ${grad!.project_id}`;
    expect(p).toEqual({ title: 'حفل تخرج مؤسسة النور', shot_date: '2025-03-14', status: 'review', client_id: S.clientX });
    const assets = await db<{ original_name: string; section: string; group: string; source_ref: string; status: string }[]>`
      select original_name, section, "group", source_ref, status from assets where project_id = ${grad!.project_id} order by original_name`;
    expect(assets.map((a) => [a.original_name, a.section, a.group, a.source_ref])).toEqual([
      ['IMG_0042.DNG', 'photos', 'raw', 'drive:d-dng'], ['cam.jpg', 'photos', 'final', 'drive:d-cam'], ['wide.jpg', 'photos', 'final', 'drive:d-wide'],
    ]);
    // and they go through processing like any upload
    await expect.poll(async () => (await db<{ n: number }[]>`select count(*)::int as n from assets where project_id = ${grad!.project_id} and status = 'ready'`)[0]!.n, { timeout: 60_000 }).toBe(3);
    const [clip] = await db<{ section: string; group: string; size: string }[]>`select section, "group", size from assets where project_id = ${ist!.project_id}`;
    expect(clip).toMatchObject({ section: 'videos', group: 'final' });

    // the history on the page says the same
    await page.reload();
    const row = page.getByTestId('drive-history').locator('[data-status=done]').filter({ hasText: '2025-03-14' });
    await expect(row).toContainText('3 من 4');
    await expect(row).toContainText('1 فشل');
    await row.getByText('التفاصيل').click();
    await expect(row).toContainText('ملاحظات — ليس ملف وسائط (مستند Google)');
    await page.screenshot({ path: 'test-results/drive/history.png', fullPage: true });

    // running the same folder into the same project again adds nothing
    const r = await page.request.post('/api/admin/drive/imports', {
      headers: { ...H, 'x-csrf-token': (await page.context().cookies()).find((k) => k.name === 'ml_csrf')!.value },
      data: { items: [{ folderId: 'f-grad', folderName: '2025-03-14 حفل تخرج مؤسسة النور', clientId: S.clientX, projectId: grad!.project_id }] },
    });
    expect(r.status()).toBe(201);
    await expect.poll(async () => (await db<{ n: number }[]>`select count(*)::int as n from drive_imports where status = 'done'`)[0]!.n, { timeout: 60_000 }).toBe(3);
    expect((await db<{ n: number }[]>`select count(*)::int as n from assets where project_id = ${grad!.project_id}`)[0]!.n).toBe(3);
    await db.end();
  });

  test('disconnect removes the stored token', async ({ page }) => {
    await admin(page);
    await page.goto('/admin/import');
    await page.getByRole('button', { name: 'فصل الحساب' }).click();
    await expect(page.getByTestId('drive-connect')).toBeVisible();
    const db = sql();
    expect((await db`select 1 from google_tokens where user_id = ${S.admin}`).length).toBe(0);
    await db.end();
  });
});
