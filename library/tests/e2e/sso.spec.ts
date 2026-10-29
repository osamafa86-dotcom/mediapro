import { expect, test, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { ssoSign } from '../../src/lib/sso-sign';
import { E2E_ENV } from './env';
import { seed, sql, type Seed } from './seed';

/*
 * Phase 2: the parent site opens the library with a signed, single-use link (docs/sso.md). The library
 * signs the person in without a second password, keeps name/email/role in step with the parent site,
 * and refuses replays, tampering, expired links and disabled accounts — always with a reason on screen.
 */

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); });

const link = (c: Partial<{ u: string; e: string; n: string; r: string; exp: number; nonce: string }> = {}, tamper?: Record<string, string>) => {
  const claims = { u: 'ext-7', e: 'new@emdatra.org', n: 'رامي ن.', r: 'photographer', exp: Math.floor(Date.now() / 1000) + 60, nonce: randomBytes(16).toString('base64url'), ...c };
  const p = new URLSearchParams({ ...Object.fromEntries(Object.entries(claims).map(([k, v]) => [k, String(v)])), sig: ssoSign(claims, E2E_ENV.EMDATRA_SSO_SECRET) });
  for (const [k, v] of Object.entries(tamper ?? {})) p.set(k, v);
  return `/api/auth/sso?${p}`;
};
const go = async (page: Page, url: string) => { await page.context().addCookies([{ name: 'locale', value: 'ar', url: E2E_ENV.APP_ORIGIN }]); await page.goto(url); };

test('a new person from the parent site is created and lands where their role works', async ({ page }) => {
  const url = link();
  await go(page, url);
  await page.waitForURL('**/upload');
  const db = sql();
  const [u] = await db<{ name: string; role: string; auth_provider: string; external_id: string; password_hash: string | null }[]>`
    select name, role, auth_provider, external_id, password_hash from users where email = 'new@emdatra.org'`;
  expect(u).toEqual({ name: 'رامي ن.', role: 'photographer', auth_provider: 'emdatra', external_id: 'ext-7', password_hash: null });
  // the same link again: refused, with the reason
  await page.context().clearCookies();
  await go(page, url);
  await page.waitForURL('**/login?sso=sso_replayed');
  await expect(page.getByTestId('sso-error')).toContainText('استُعمل الرابط من قبل');
  await db.end();
});

test('the parent site stays the source of truth: name and role follow it (a demotion is a demotion)', async ({ page }) => {
  await go(page, link({ r: 'admin', n: 'رامي نصّار' }));
  await page.waitForURL('**/admin');
  await page.context().clearCookies();
  await go(page, link({ r: 'contributor' }));
  await page.waitForURL('**/upload');
  const db = sql();
  const [u] = await db<{ role: string; name: string }[]>`select role, name from users where external_id = 'ext-7'`;
  expect(u).toEqual({ role: 'contributor', name: 'رامي ن.' });
  await db.end();
});

test('an existing local account with the same email is linked once, not duplicated', async ({ page }) => {
  await go(page, link({ u: 'ext-admin', e: 'ADMIN@e2e.test', n: 'سامي ع.', r: 'admin' }));
  await page.waitForURL('**/admin');
  const db = sql();
  const rows = await db<{ id: string; auth_provider: string; external_id: string }[]>`select id, auth_provider, external_id from users where lower(email) = 'admin@e2e.test'`;
  expect(rows).toEqual([{ id: S.admin, auth_provider: 'emdatra', external_id: 'ext-admin' }]);
  await db.end();
});

test('refused: tampered, expired, minted too far ahead, a non-library role, a disabled account', async ({ page }) => {
  const cases: [string, string][] = [
    [link({}, { r: 'admin' }), 'sso_bad_signature'],
    [link({ exp: Math.floor(Date.now() / 1000) - 5 }), 'sso_expired'],
    [link({ exp: Math.floor(Date.now() / 1000) + 3600 }), 'sso_too_far'],
    [link({ r: 'viewer' }), 'sso_role'],
    [link({ u: 'ext-off', e: 'off@e2e.test', n: 'معطّل' }), 'disabled'],
  ];
  for (const [url, why] of cases) {
    await page.context().clearCookies();
    await go(page, url);
    await page.waitForURL(`**/login?sso=${why}`);
    await expect(page.getByTestId('sso-error'), why).toBeVisible();
  }
  // nothing was created for any of them
  const db = sql();
  expect((await db`select 1 from users where external_id in ('ext-off')`).length).toBe(0);
  await db.end();
});
