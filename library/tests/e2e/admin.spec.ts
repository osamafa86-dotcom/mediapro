import { expect, test, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { E2E_ENV } from './env';
import { mails } from './helpers';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/* M2 screens in a real browser: archive, project + share link, clients, team, settings, first run. */

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await rm(E2E_ENV.MAIL_DIR, { recursive: true, force: true }); });

async function signIn(page: Page, email = 'admin@e2e.test', locale = 'ar') {
  await page.context().addCookies([{ name: 'locale', value: locale, url: ORIGIN }]);
  const r = await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email, password: PASSWORD } });
  expect(r.status()).toBe(200);
}

test('archive: Arabic search folds letter forms and harakat; numbers line up on the right', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop table');
  await signIn(page);
  await page.goto('/admin/archive');
  await expect(page.getByTestId('archive-table').locator('tbody tr')).toHaveCount(5); // every non-archived project: the admin sees all clients and every status
  // «تخرج» without shadda finds «حفل تخرّج»
  await page.getByRole('searchbox').fill('تخرج');
  await expect(page.getByTestId('archive-table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('archive-table')).toContainText('حفل تخرّج');
  await expect(page).toHaveURL(/q=%D8%AA%D8%AE%D8%B1%D8%AC/);
  await page.getByRole('button', { name: 'مسح الكل' }).click();
  await expect(page.getByTestId('archive-table').locator('tbody tr')).toHaveCount(5);
  // financial-tables rule: numeric cells end on the same right edge, in RTL too
  const edges = await page.$$eval('td[data-col="size"] bdi', (els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
  expect(new Set(edges).size).toBe(1);
  // bidi: «0 B», never «B 0»
  const sizes = await page.$$eval('td[data-col="size"]', (els) => els.map((e) => (e as HTMLElement).innerText));
  for (const t of sizes) expect(t).toMatch(/^[\d.,]+ (B|KB|MB|GB|TB)$/);
});

test('archive: status chip filters; selection bar archives in bulk', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop table');
  await signIn(page);
  await page.goto('/admin/archive');
  await page.locator('select[data-filter="status"]').selectOption('draft');
  await expect(page).toHaveURL(/status=draft/);
  await expect(page.getByTestId('archive-table').locator('tbody tr')).toHaveCount(1);
  await page.locator('select[data-filter="status"]').selectOption('');
  await page.getByRole('checkbox', { name: /حفل تخرّج/ }).check();
  await expect(page.getByTestId('selection-bar')).toContainText('1 محدّدة');
  await page.getByTestId('selection-bar').getByRole('button', { name: 'أرشفة' }).click();
  await expect(page.getByRole('status')).toContainText('تغيّر مشروع واحد');
  await expect(page.getByTestId('archive-table')).not.toContainText('حفل تخرّج');
  await page.goto('/admin/archive?archived=1');
  await expect(page.getByTestId('archive-table')).toContainText('حفل تخرّج');
  await page.getByRole('checkbox', { name: /حفل تخرّج/ }).check();
  await page.getByTestId('selection-bar').getByRole('button', { name: 'استعادة' }).click();
  await expect(page.getByTestId('archive-empty')).toBeVisible();
});

test('project → share dialog → short link + PIN → the client gets in', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await signIn(page);
  await page.goto(`/admin/projects/${S.p1}`);
  await page.getByRole('button', { name: 'إنشاء رابط' }).click();
  const dlg = page.getByTestId('share-dialog');
  await expect(dlg.getByRole('heading', { name: 'رابط التسليم' })).toBeVisible();
  await dlg.getByRole('button', { name: 'إنشاء الرابط' }).click();
  const url = (await dlg.getByTestId('share-url').innerText()).trim();
  expect(url).toMatch(/\/c\/[2-9a-zA-Z]{5}-[2-9a-zA-Z]{5}$/);
  const pin = (await dlg.getByTestId('share-pin').getAttribute('aria-label'))!.replace(/\D/g, '');
  expect(pin).toMatch(/^\d{4}$/);
  // PIN digits are laid out left to right even in the Arabic dialog
  const xs = await dlg.getByTestId('share-pin').locator('span').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  await dlg.getByRole('button', { name: 'إرسال بالبريد…' }).click();
  await expect(dlg.getByRole('status')).toBeVisible();
  expect((await mails()).some((m) => m.to === 'heba@alnoor.test')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('project-links').locator('li')).toHaveCount(1);

  const client = await (await browser.newContext()).newPage();
  await client.goto(`http://${url}`);
  await client.locator('[data-testid=pin-gate] input').first().click();
  await client.keyboard.type(pin);
  await client.waitForURL(`**/p/${S.p1}`);
});

test('clients: create in the side panel, edit, archive', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await signIn(page);
  await page.goto('/admin/clients');
  await page.getByRole('link', { name: /عميل جديد/ }).click();
  const panel = page.getByTestId('client-panel');
  await panel.getByLabel('اسم المؤسسة').fill('بلدية دير البلح');
  await panel.getByLabel('الاسم بالتركية').fill('Deir el-Balah Belediyesi');
  await panel.getByRole('button', { name: 'مستفيدة' }).click();
  await panel.getByLabel('البريد الإلكتروني').fill('rami@deir.test');
  await panel.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page).toHaveURL(/id=/);
  await expect(page.getByTestId('clients-table')).toContainText('بلدية دير البلح');
  await page.getByRole('searchbox').fill('بلديه');
  await expect(page.getByTestId('clients-table').locator('tbody tr')).toHaveCount(1);
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('client-panel').getByRole('button', { name: 'أرشفة العميل' }).click();
  await expect(page.getByTestId('clients-table')).not.toContainText('بلدية دير البلح');
  await page.goto('/admin/clients?status=archived');
  await expect(page.getByTestId('clients-table')).toContainText('بلدية دير البلح');
});

test('team: invite sends mail; permissions persist; the locked one is disabled', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await signIn(page);
  await page.goto('/admin/team');
  await page.getByRole('button', { name: 'دعوة مصوّر' }).click();
  const dlg = page.getByTestId('invite-dialog');
  await dlg.getByLabel('الاسم').fill('يوسف كمال');
  await dlg.getByLabel('البريد الإلكتروني').fill('yousef@e2e.test');
  await dlg.getByRole('button', { name: 'متعاون' }).click();
  await dlg.getByRole('button', { name: 'إرسال الدعوة' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('main').getByRole('status')).toContainText('yousef@e2e.test');
  expect((await mails()).some((m) => m.to === 'yousef@e2e.test')).toBe(true);
  await expect(page.locator('tr[data-state="pending"]', { hasText: 'يوسف كمال' })).toHaveCount(1);

  const perms = page.getByTestId('role-permissions');
  await expect(perms.getByTestId('perm-seeClientLinks').getByRole('switch')).toBeDisabled();
  await perms.getByTestId('perm-publishWithoutReview').click();
  await expect(perms.getByTestId('perm-publishWithoutReview').getByRole('switch')).toBeChecked();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByTestId('role-permissions').getByTestId('perm-publishWithoutReview').getByRole('switch')).toBeChecked();
});

test('settings: one save, persisted; date preview follows digits', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await signIn(page);
  await page.goto('/admin/settings');
  await page.getByRole('group', { name: 'مدة الصلاحية الافتراضية' }).getByRole('button', { name: '14 يومًا' }).click();
  await page.getByRole('button', { name: '٠١٢٣' }).click();
  await expect(page.getByTestId('date-preview')).toContainText(/[٠-٩]/);
  await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(page.getByRole('status')).toHaveText('حُفظ.');
  await page.reload();
  await expect(page.getByRole('group', { name: 'مدة الصلاحية الافتراضية' }).getByRole('button', { name: '14 يومًا' })).toHaveAttribute('aria-pressed', 'true');
  const db = sql(); await db`delete from settings where key in ('linkDefaults', 'region')`; await db.end();
});

test('Turkish admin: LTR, Arabic names keep their order', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop table');
  await signIn(page, 'admin@e2e.test', 'tr');
  await page.goto('/admin/archive');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Arşiv');
  await expect(page.getByTestId('archive-summary')).toContainText(/\d+ projeden \d+ sonuç/);
});

test('phone: the archive is a record list, and the nav stays reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'phone layout');
  await signIn(page);
  await page.goto('/admin/archive');
  await expect(page.getByTestId('archive-table').locator('thead')).toBeHidden();
  const row = page.getByTestId('archive-table').locator('tbody tr').first();
  await expect(row.locator('td[data-col="status"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeAttached();
});

test('first run: an empty library shows the setup checklist', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  const db = sql();
  await db`delete from projects`;
  await db.end();
  await signIn(page);
  await page.goto('/admin/archive');
  const fr = page.getByTestId('archive-first-run');
  await expect(fr.getByRole('heading', { name: 'أرشيفك يبدأ من هنا' })).toBeVisible();
  // the test bucket exists and answers (global-setup creates it): «متصل» is measured, not assumed
  await expect(fr).toContainText('e2e · متصل');
  await expect(fr).not.toContainText('تعذّر الوصول');
  await expect(fr.locator('a[data-done]')).toHaveCount(3); // storage, clients and team; no import yet
});
