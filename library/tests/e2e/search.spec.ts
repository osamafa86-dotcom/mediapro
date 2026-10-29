import { expect, test, type Page } from '@playwright/test';
import { E2E_ENV } from './env';
import { login, write } from './helpers';
import { PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M6 search acceptance: «الزفاف» = «زفاف», «istanbul» = «İstanbul», harakat and hamza folded, every word
 * must match (AND) — in the admin archive, the clients list, «مكتبتي» and inside a project.
 */

let S: Seed;
const H = { origin: E2E_ENV.APP_ORIGIN };
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  S = await seed();
  const db = sql();
  await db`update projects set title = 'حفل الزفاف الجماعي' where id = ${S.p3}`;
  await db`update projects set place = 'İstanbul', shot_date = '2026-05-02' where id = ${S.p1}`;
  await db`update projects set shot_date = '2025-06-01' where id = ${S.p2}`;
  await db`update assets set original_name = 'DSC_4821.JPG' where id = ${S.assetFinal}`;
  await db.end();
});

async function admin(page: Page) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: H, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
}
const rows = (page: Page) => page.getByTestId('archive-table').locator('tbody tr[data-id]');
async function archiveIds(page: Page, q: string) {
  await page.goto(`/admin/archive?q=${encodeURIComponent(q)}`);
  await expect(page.getByTestId('archive-summary')).toBeVisible();
  return (await rows(page).evaluateAll((trs) => trs.map((t) => t.getAttribute('data-id')))).sort();
}

test('archive: the article, Turkish İ, harakat and file names; every word must match', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'server search, one viewport is enough');
  await admin(page);
  expect(await archiveIds(page, 'زفاف')).toEqual([S.p3]);
  expect(await archiveIds(page, 'الزفاف')).toEqual([S.p3]);
  expect(await archiveIds(page, 'istanbul')).toEqual([S.p1]);
  expect(await archiveIds(page, 'ISTANBUL')).toEqual([S.p1]);
  expect(await archiveIds(page, 'تخرج')).toEqual([S.p2]); // the title is «حفل تخرّج»
  expect(await archiveIds(page, 'dsc_4821')).toEqual([S.p1]); // a file inside the project
  expect(await archiveIds(page, 'مؤسسة النور')).toEqual([S.p1, S.p2, S.draft, S.expired].sort()); // the client's name
  expect(await archiveIds(page, 'زفاف istanbul')).toEqual([]); // AND, not OR
  await expect(page.getByTestId('archive-empty')).toBeVisible();
});

test('clients list: «النور» finds «مؤسسة النور للتنمية»; «nur vakfi» finds its Turkish name', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'server search, one viewport is enough');
  await admin(page);
  for (const q of ['النور', 'نور', 'nur vakfı', 'NUR VAKFI']) {
    await page.goto(`/admin/clients?q=${encodeURIComponent(q)}`);
    await expect(page.getByTestId('clients-table').locator('tbody tr[data-id]'), q).toHaveCount(1);
    await expect(page.getByTestId('clients-table').locator(`tbody tr[data-id="${S.clientX}"]`)).toHaveCount(1);
  }
});

async function client(page: Page) {
  const a = await login('admin@e2e.test');
  const l = (await (await write(a, 'POST', '/api/admin/links', { clientId: S.clientX })).json()) as { path: string; pin: string };
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/link/pin', { headers: H, data: { token: l.path.slice(3), pin: l.pin } })).status()).toBe(200);
}

test('«مكتبتي»: the header search filters, and a year with no match says where the match is', async ({ page }) => {
  await client(page);
  await page.goto('/library');
  const cards = page.getByTestId('client-library').locator('[data-project-id]');
  await expect(cards).toHaveCount(2);
  await page.getByTestId('portal-search').fill('حفل 2026'); // «حفل تخرّج» is 2025: every word must match
  await expect(page.getByTestId('search-empty')).toBeVisible();
  await page.getByTestId('portal-search').fill('التخرج');
  await expect(page).toHaveURL(/\?q=/);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-project-id', S.p2);
  // in 2026 there is no «تخرج» → the empty state names the year and offers all years
  await page.getByRole('button', { name: '2026' }).click();
  await expect(page.getByTestId('search-empty')).toContainText('لا نتائج لـ«التخرج» في 2026');
  await expect(cards.first()).toContainText('وُجد في 2025');
  await page.getByRole('button', { name: 'ابحث في كل السنوات' }).click();
  await expect(page.getByTestId('search-empty')).toHaveCount(0);
  await expect(cards).toHaveCount(1);
  // the search is in the address, so it survives a reload and can be shared
  await page.reload();
  await expect(page.getByTestId('portal-search')).toHaveValue('التخرج');
  await expect(cards).toHaveCount(1);
  // Escape clears it
  await page.getByTestId('portal-search').press('Escape');
  await expect(cards).toHaveCount(2);
});

test('inside a project: file names, and a clear empty state', async ({ page }) => {
  await client(page);
  await page.goto(`/p/${S.p1}?q=${encodeURIComponent('dsc 4821')}`);
  await expect(page.getByTestId('photo-grid').locator('[data-asset-id]')).toHaveCount(1);
  await page.getByTestId('portal-search').fill('لا يوجد');
  await expect(page.getByTestId('search-empty')).toContainText('لا نتائج لـ«لا يوجد»');
  // ⌘K / Ctrl+K focuses the search
  await page.getByTestId('portal-search').blur();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('portal-search')).toBeFocused();
});
