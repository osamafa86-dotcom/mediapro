import { expect, test, type Page } from '@playwright/test';
import { E2E_ENV } from './env';
import { H } from './helpers';
import { PASSWORD, seed, sql, type Seed } from './seed';

/*
 * Date filters on the archive: a project's day is its shoot date, else the day it was created.
 * One rule at a time in the address — a quick period, one day, one month, or a range — and the panel writes them.
 */

let S: Seed;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  S = await seed();
  const db = sql();
  await db`update projects set shot_date = '2026-03-15' where id = ${S.p1}`;
  await db`update projects set shot_date = '2026-03-31' where id = ${S.p3}`;
  await db`update projects set shot_date = '2025-12-20' where id = ${S.draft}`;
  await db`update projects set shot_date = null, created_at = now() where id = ${S.expired}`; // its day is today
  await db.end();
});

async function admin(page: Page) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: H, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(200);
}
const ids = async (page: Page) => {
  await expect(page.getByTestId('archive-summary')).toBeVisible();
  if (await page.getByTestId('archive-empty').count()) return [];
  return (await page.getByTestId('archive-cards').locator('li[data-id]').evaluateAll((li) => li.map((x) => x.getAttribute('data-id')))).sort();
};
const at = async (page: Page, qs: string) => { await page.goto(`/admin/archive?${qs}`); return ids(page); };

test('the address: one day, one month, a range, today; nonsense is ignored', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'server filters, one viewport is enough');
  await admin(page);
  expect(await at(page, 'day=2026-10-09')).toEqual([S.p2]);
  expect(await at(page, 'month=2026-03')).toEqual([S.p1, S.p3].sort()); // the 31st is in March
  expect(await at(page, 'from=2026-03-20&to=2026-10-09')).toEqual([S.p2, S.p3].sort()); // both ends included
  expect(await at(page, 'from=2026-03-20')).toContain(S.expired); // open-ended
  expect(await at(page, 'to=2025-12-31')).toEqual([S.draft]);
  expect(await at(page, 'period=today')).toEqual([S.expired]); // no shoot date: the day it was created
  expect(await at(page, 'day=2026-13-40')).toHaveLength(5); // not a date: no filter, not an error
  expect(await at(page, 'month=2026-3')).toHaveLength(5);
  // a day wins over a period if both are in the address
  expect(await at(page, 'period=today&day=2026-10-09')).toEqual([S.p2]);
});

test('the panel: a month from two lists, a day, a range, then clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough; the panel is the same on a phone');
  await admin(page);
  await page.goto('/admin/archive');
  const chip = page.locator('[data-filter="date"]');
  await chip.click();
  const panel = page.getByTestId('date-panel');
  await panel.getByTestId('date-year').selectOption('2026');
  await panel.getByTestId('date-month').selectOption('03');
  await expect(page).toHaveURL(/month=2026-03/);
  await expect(chip).toContainText('مارس 2026');
  expect(await ids(page)).toEqual([S.p1, S.p3].sort());

  await chip.click();
  await page.getByTestId('date-day').fill('2026-10-09');
  await expect(page).toHaveURL(/day=2026-10-09/);
  await expect(page).not.toHaveURL(/month=/); // one rule at a time
  expect(await ids(page)).toEqual([S.p2]);

  await chip.click();
  await page.getByTestId('date-from').fill('2025-12-01');
  await page.getByTestId('date-to').fill('2026-03-20');
  await page.getByTestId('date-panel').getByRole('button', { name: 'تطبيق' }).click();
  await expect(page).toHaveURL(/from=2025-12-01&to=2026-03-20|to=2026-03-20.*from=2025-12-01/);
  expect(await ids(page)).toEqual([S.p1, S.draft].sort());

  await chip.click();
  await page.getByTestId('date-panel').getByRole('button', { name: 'مسح التاريخ' }).click();
  await expect(page).not.toHaveURL(/from=|to=|day=|month=|period=/);
  expect(await ids(page)).toHaveLength(5);

  // a quick period
  await chip.click();
  await page.getByTestId('date-panel').getByRole('button', { name: 'اليوم', exact: true }).click();
  await expect(page).toHaveURL(/period=today/);
  expect(await ids(page)).toEqual([S.expired]);
});
