import { expect, test, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { E2E_ENV } from './env';
import { ctx, H, mails } from './helpers';
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
  await page.goto('/admin/archive?view=table');
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
  await page.goto('/admin/archive?view=table');
  await page.locator('select[data-filter="status"]').selectOption('draft');
  await expect(page).toHaveURL(/status=draft/);
  await expect(page.getByTestId('archive-table').locator('tbody tr')).toHaveCount(1);
  await page.locator('select[data-filter="status"]').selectOption('');
  await page.getByRole('checkbox', { name: /حفل تخرّج/ }).check();
  await expect(page.getByTestId('selection-bar')).toContainText('1 محدّدة');
  await page.getByTestId('selection-bar').getByRole('button', { name: 'أرشفة' }).click();
  await expect(page.getByRole('status')).toContainText('تغيّر مشروع واحد');
  await expect(page.getByTestId('archive-table')).not.toContainText('حفل تخرّج');
  await page.goto('/admin/archive?archived=1&view=table');
  await expect(page.getByTestId('archive-table')).toContainText('حفل تخرّج');
  await page.getByRole('checkbox', { name: /حفل تخرّج/ }).check();
  await page.getByTestId('selection-bar').getByRole('button', { name: 'استعادة' }).click();
  await expect(page.getByTestId('archive-empty')).toBeVisible();
});

test('archive as albums: the default; a tap opens the project; «تحديد» picks albums for the same bulk bar; the table choice is remembered', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/archive');
  const cards = page.getByTestId('archive-cards');
  await expect(cards.locator('li[data-id]')).toHaveCount(5);
  await expect(page.getByTestId('archive-table')).toHaveCount(0);
  const grad = cards.locator('li', { hasText: 'حفل تخرّج' });
  await expect(grad.locator('a')).toHaveAttribute('href', /\/admin\/projects\/[0-9a-f-]{36}$/);
  // a phone shows two albums side by side and never scrolls sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // select mode: a tap picks instead of opening
  await page.getByTestId('archive-select').click();
  await grad.getByRole('button', { name: /حفل تخرّج/ }).click();
  await expect(grad.getByRole('button', { name: /حفل تخرّج/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/admin\/archive/);
  await expect(page.getByTestId('selection-bar')).toContainText('1 محدّدة');
  await page.getByTestId('selection-bar').getByRole('button', { name: 'أرشفة' }).click();
  await expect(page.getByRole('status')).toContainText('تغيّر مشروع واحد');
  await expect(cards.locator('li[data-id]')).toHaveCount(4);
  await page.goto('/admin/archive?archived=1');
  await page.getByTestId('archive-select').click();
  await page.getByTestId('archive-cards').getByRole('button', { name: /حفل تخرّج/ }).click();
  await page.getByTestId('selection-bar').getByRole('button', { name: 'استعادة' }).click();
  await expect(page.getByTestId('archive-empty')).toBeVisible();
  // the table is one tap away, and the next visit opens on it
  await page.goto('/admin/archive');
  await page.getByTestId('view-table').click();
  await expect(page.getByTestId('archive-table')).toBeVisible();
  await page.goto('/admin/archive');
  await expect(page.getByTestId('archive-table')).toBeVisible();
  await page.getByTestId('view-cards').click();
  await expect(page.getByTestId('archive-cards')).toBeVisible();
  await page.goto('/admin/archive');
  await expect(page.getByTestId('archive-cards')).toBeVisible();
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

test('users: an emailed invite, or a password the admin hands over; the permissions matrix persists', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'admin flow');
  await signIn(page);
  await page.goto('/admin/team');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('المستخدمون');
  // 1) by mail, as before
  await page.getByRole('button', { name: 'إضافة مستخدم' }).click();
  let dlg = page.getByTestId('invite-dialog');
  await dlg.getByLabel('الاسم').fill('يوسف كمال');
  await dlg.getByLabel('البريد الإلكتروني').fill('yousef@e2e.test');
  await dlg.getByRole('button', { name: 'متعاون' }).click();
  await dlg.getByRole('button', { name: 'دعوة بالبريد' }).click();
  await dlg.getByRole('button', { name: 'إرسال الدعوة' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('main').getByRole('status')).toContainText('yousef@e2e.test');
  expect((await mails()).some((m) => m.to === 'yousef@e2e.test')).toBe(true);
  await expect(page.locator('tr[data-state="pending"]', { hasText: 'يوسف كمال' })).toContainText('دعوة معلّقة');

  // 2) with a password: too short is said in the form; a generated one is 16 characters; no mail
  await page.getByRole('button', { name: 'إضافة مستخدم' }).click();
  dlg = page.getByTestId('invite-dialog');
  await dlg.getByLabel('الاسم').fill('ليلى منصور');
  await dlg.getByLabel('البريد الإلكتروني').fill('layla@e2e.test');
  await dlg.getByRole('button', { name: 'محرّر' }).click();
  await dlg.getByLabel('كلمة المرور').fill('short');
  await dlg.getByRole('button', { name: 'إضافة المستخدم' }).click();
  await expect(dlg.getByRole('alert')).toHaveText('كلمة المرور قصيرة: 12 حرفًا على الأقل.');
  await dlg.getByRole('button', { name: 'توليد كلمة' }).click();
  const pw = await dlg.getByLabel('كلمة المرور').inputValue();
  expect(pw).toMatch(/^[a-zA-Z2-9]{16}$/);
  await dlg.getByRole('button', { name: 'إضافة المستخدم' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('main').getByRole('status')).toContainText('أُضيف ليلى منصور');
  expect((await mails()).some((m) => m.to === 'layla@e2e.test')).toBe(false);
  const row = page.locator('tr', { hasText: 'ليلى منصور' });
  await expect(row).toContainText('لم يدخل بعد');
  await expect(row.getByRole('button', { name: 'إعادة الإرسال' })).toHaveCount(0);
  const member = await ctx();
  expect((await member.post('/api/auth/login', { headers: H, data: { email: 'layla@e2e.test', password: pw } })).status()).toBe(200);

  // 3) a new password from the row menu: the old one stops working
  await row.getByRole('button', { name: 'المزيد: ليلى منصور' }).click();
  await page.getByRole('menuitem', { name: 'تعيين كلمة مرور' }).click();
  const pdlg = page.getByTestId('password-dialog');
  await expect(pdlg).toContainText('كلمة مرور جديدة لـليلى منصور');
  await pdlg.getByLabel('كلمة المرور').fill('handed over in person 1');
  await pdlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(pdlg).toBeHidden();
  await expect(row).toContainText('حُفظت كلمة المرور الجديدة.');
  expect((await member.get('/api/me')).status()).toBe(401);
  expect((await (await ctx()).post('/api/auth/login', { headers: H, data: { email: 'layla@e2e.test', password: 'handed over in person 1' } })).status()).toBe(200);

  // 4) the matrix: every role side by side; a switch saves at once and survives a reload; fixed rules have no switch
  const perms = page.getByTestId('role-permissions');
  await expect(perms.getByRole('columnheader')).toHaveText(['الصلاحية', 'المدير', 'مصوّر', 'محرّر', 'متعاون']);
  const sw = perms.getByTestId('perm-publishWithoutReview-editor');
  await expect(sw.getByRole('switch')).not.toBeChecked();
  await sw.click();
  await expect(sw.getByRole('switch')).toBeChecked();
  await expect(perms.getByTestId('perm-publishWithoutReview-photographer').getByRole('switch')).not.toBeChecked();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByTestId('perm-publishWithoutReview-editor').getByRole('switch')).toBeChecked();
  for (const f of ['viewProjects', 'notes', 'delete', 'clients', 'users', 'settings']) await expect(page.getByTestId(`fixed-${f}`).getByRole('switch')).toHaveCount(0);
  await expect(page.getByTestId('fixed-clients')).toContainText('غير مسموح');
  // deletion: the admin anything, a member only their own uploads before publication — and the note says it is final
  await expect(page.getByTestId('fixed-delete')).toContainText('ما رفعه قبل النشر');
  await expect(page.getByTestId('role-permissions')).toContainText('الحذف نهائي');
});

test('the sidebar folds to a rail of icons and stays folded; the work area takes the room; no fold on a phone', async ({ page }, info) => {
  await signIn(page);
  await page.goto('/admin/archive');
  const toggle = page.getByTestId('sidebar-toggle');
  if (info.project.name !== 'desktop') { await expect(toggle).toBeHidden(); return; }
  const aside = page.locator('aside').first();
  const main = page.locator('main#main');
  const before = { aside: (await aside.boundingBox())!.width, main: (await main.boundingBox())!.width };
  expect(before.aside).toBeGreaterThan(200);
  await expect(toggle).toHaveAttribute('aria-label', 'طيّ القائمة');
  await toggle.click();
  await expect.poll(async () => (await aside.boundingBox())!.width).toBeLessThan(70);
  await expect.poll(async () => (await main.boundingBox())!.width).toBeGreaterThan(before.main + 150);
  // icons only, but every link keeps its name (screen readers, hover title)
  await expect(aside.getByRole('link', { name: 'الأرشيف' })).toBeVisible();
  await expect(aside.getByRole('link', { name: 'الأرشيف' })).toHaveAttribute('title', 'الأرشيف');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // remembered: the next page is drawn folded by the server, no flash
  await page.goto('/admin/team');
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-collapsed');
  expect((await page.locator('aside').first().boundingBox())!.width).toBeLessThan(70);
  await page.getByTestId('sidebar-toggle').click();
  await expect.poll(async () => (await page.locator('aside').first().boundingBox())!.width).toBeGreaterThan(200);
  await page.reload();
  await expect(page.locator('[data-shell]')).not.toHaveAttribute('data-collapsed');
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
  await page.goto('/admin/archive?view=table');
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
