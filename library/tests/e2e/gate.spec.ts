import { expect, request as pwRequest, test } from '@playwright/test';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/* The screens of M1 in a real browser, both viewports, Arabic and Turkish (Figma 14:2, 68:1412). */

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); });

async function issue(body: Record<string, unknown>) {
  const c = await pwRequest.newContext({ baseURL: ORIGIN });
  await c.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'admin@e2e.test', password: PASSWORD } });
  const csrf = (await c.storageState()).cookies.find((k) => k.name === 'ml_csrf')!.value;
  const r = await c.post('/api/admin/links', { headers: { origin: ORIGIN, 'x-csrf-token': csrf }, data: body });
  const j = (await r.json()) as { id: string; path: string; pin: string };
  await c.dispose();
  return j;
}

const cells = (page: import('@playwright/test').Page) => page.locator('[data-testid=pin-gate] input');

test('Arabic gate: RTL page, LTR digits, correct PIN opens the library', async ({ page }) => {
  const l = await issue({ clientId: S.clientX });
  await page.goto(l.path);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مكتبة مؤسسة النور للتنمية');
  await expect(page.locator('[data-testid=pin-gate] [role=group]')).toHaveAttribute('dir', 'ltr');
  await cells(page).first().click();
  await page.keyboard.type(l.pin);
  await page.waitForURL('**/library');
  await expect(page.getByTestId('client-library')).toContainText('مؤسسة النور للتنمية');
  await expect(page.getByTestId('client-library').locator('li')).toHaveCount(2);
  // the link now goes straight in for this browser
  await page.goto(l.path);
  await page.waitForURL('**/library');
});

test('five wrong PINs show the locked state with a countdown, which survives a reload', async ({ page }) => {
  const l = await issue({ clientId: S.clientX });
  const wrong = String((Number(l.pin) + 1) % 10_000).padStart(4, '0');
  await page.goto(l.path);
  for (let i = 0; i < 4; i++) {
    await cells(page).first().click();
    await page.keyboard.type(wrong);
    await expect(page.locator('main').getByRole('alert')).toContainText('الرمز غير صحيح');
  }
  await cells(page).first().click();
  await page.keyboard.type(wrong);
  await expect(page.getByTestId('pin-locked')).toContainText('أُوقف الدخول مؤقتًا');
  await expect(page.getByRole('button', { name: /حاول بعد \u2066\d\d:\d\d\u2069/ })).toBeDisabled();
  await expect(cells(page).first()).toBeDisabled();
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-gate', 'locked');
  await expect(page.getByTestId('pin-locked')).toBeVisible();
});

test('Turkish expired link: LTR, date printed, renewal request recorded once', async ({ page, context }) => {
  await context.addCookies([{ name: 'locale', value: 'tr', url: ORIGIN }]);
  const l = await issue({ clientId: S.clientX });
  const db = sql();
  await db`update links set expires_at = '2026-10-12T20:59:59Z' where id = ${l.id}`;
  await page.goto(l.path);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nur Kalkınma Vakfı kütüphanesi');
  await expect(page.locator('main')).toContainText("12 Ekim 2026'da sona erdi");
  await expect(page.locator('main')).toContainText('Gönderen: EMDATRA · سامي ع.');
  await page.getByRole('button', { name: 'Yeni bağlantı iste' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('Talebiniz alındı');
  const [row] = await db<{ n: number }[]>`select count(*)::int as n from renewal_requests where link_id = ${l.id}`;
  await db.end();
  expect(row?.n).toBe(1);
});

test('Arabic expired date uses Levantine month names', async ({ page }) => {
  const l = await issue({ clientId: S.clientX });
  const db = sql();
  await db`update links set expires_at = '2026-10-12T20:59:59Z' where id = ${l.id}`;
  await db.end();
  await page.goto(l.path);
  await expect(page.locator('main')).toContainText('انتهى في 12 تشرين الأول 2026');
});

test('an invalid link says so, without revealing anything', async ({ page }) => {
  await page.goto('/l/not-a-real-token-at-all-xxxxxxxxxxxx');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('هذا الرابط غير صالح');
});

test('guest lands on its project with the view-only banner', async ({ page }) => {
  const l = await issue({ clientId: S.clientX, projectId: S.p1, kind: 'guest' });
  await page.goto(l.path);
  await cells(page).first().click();
  await page.keyboard.type(l.pin);
  await page.waitForURL(`**/p/${S.p1}`);
  await expect(page.getByTestId('client-project')).toHaveAttribute('data-kind', 'guest');
  await expect(page.getByRole('note')).toContainText('عرض فقط');
  await page.goto(`/p/${S.p2}`);
  await expect(page.getByTestId('client-project')).toHaveCount(0);
});

test('staff: /admin needs a login; login, then logout', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForURL('**/login');
  await page.getByLabel('البريد الإلكتروني').fill('a@e2e.test');
  await page.getByLabel('كلمة المرور').fill('wrong-password-123');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('البريد أو كلمة المرور غير صحيحة.');
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أهلًا، مصوّر أ');
  await expect(page.getByTestId('staff-projects').locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'خروج' }).click();
  await page.waitForURL('**/login');
});
