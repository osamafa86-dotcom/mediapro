import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { E2E_ENV } from './env';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M1 acceptance: every authorization boundary is attacked over HTTP against the production build,
 * and must hold. Each guard here was also proven by breaking the code and watching the test fail
 * (see the PR description).
 */

let S: Seed;
const H = { origin: ORIGIN };

async function ctx(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: ORIGIN });
}

async function csrfOf(c: APIRequestContext, name: 'ml_csrf' | 'ml_vcsrf') {
  return (await c.storageState()).cookies.find((k) => k.name === name)?.value ?? '';
}

async function login(email: string): Promise<APIRequestContext> {
  const c = await ctx();
  const r = await c.post('/api/auth/login', { headers: H, data: { email, password: PASSWORD } });
  expect(r.status(), `login ${email}`).toBe(200);
  return c;
}

async function staffPost(c: APIRequestContext, url: string, data: unknown) {
  return c.post(url, { headers: { ...H, 'x-csrf-token': await csrfOf(c, 'ml_csrf') }, data });
}

async function newLink(admin: APIRequestContext, body: Record<string, unknown>) {
  const r = await staffPost(admin, '/api/admin/links', body);
  expect(r.status()).toBe(201);
  const j = (await r.json()) as { id: string; path: string; pin: string };
  return { ...j, token: j.path.slice(3) };
}

const wrongPin = (pin: string) => String((Number(pin) + 1) % 10_000).padStart(4, '0');

async function openLink(token: string, pin: string) {
  const c = await ctx();
  const r = await c.post('/api/link/pin', { headers: H, data: { token, pin } });
  return { c, r };
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await rm(E2E_ENV.MAIL_DIR, { recursive: true, force: true }); });

test.describe('staff login', () => {
  test('wrong password is 401; 5 failures lock the account for 10 minutes even for the right password', async () => {
    const c = await ctx();
    for (let i = 0; i < 4; i++) {
      expect((await c.post('/api/auth/login', { headers: H, data: { email: 'lock@e2e.test', password: 'nope-nope-nope' } })).status()).toBe(401);
    }
    const fifth = await c.post('/api/auth/login', { headers: H, data: { email: 'lock@e2e.test', password: 'nope-nope-nope' } });
    expect(fifth.status()).toBe(423);
    const right = await c.post('/api/auth/login', { headers: H, data: { email: 'LOCK@e2e.test', password: PASSWORD } });
    expect(right.status()).toBe(423);
    const until = new Date(((await right.json()) as { until: string }).until).getTime();
    expect(until - Date.now()).toBeGreaterThan(9 * 60_000);
  });

  test('login without our Origin is refused (login CSRF)', async () => {
    const c = await ctx();
    expect((await c.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(403);
    expect((await c.post('/api/auth/login', { headers: { origin: 'https://evil.example' }, data: { email: 'admin@e2e.test', password: PASSWORD } })).status()).toBe(403);
  });

  test('a disabled user cannot sign in, and is signed out once disabled', async () => {
    const c = await ctx();
    expect((await c.post('/api/auth/login', { headers: H, data: { email: 'off@e2e.test', password: PASSWORD } })).status()).toBe(401);
    const a = await login('a@e2e.test');
    expect((await a.get('/api/me')).status()).toBe(200);
    const db = sql();
    await db`update users set disabled_at = now() where id = ${S.photoA}`;
    expect((await a.get('/api/me')).status()).toBe(401);
    await db`update users set disabled_at = null where id = ${S.photoA}`;
    await db.end();
  });

  test('session cookie is httpOnly and SameSite=Lax; the CSRF cookie is readable', async () => {
    const c = await login('admin@e2e.test');
    const cookies = (await c.storageState()).cookies;
    const sess = cookies.find((k) => k.name === 'ml_session')!;
    expect(sess.httpOnly).toBe(true);
    expect(sess.sameSite).toBe('Lax');
    expect(cookies.find((k) => k.name === 'ml_csrf')!.httpOnly).toBe(false);
  });

  test('every staff write needs the session CSRF token and our Origin', async () => {
    const admin = await login('admin@e2e.test');
    const body = { clientId: S.clientX };
    expect((await admin.post('/api/admin/links', { headers: H, data: body })).status()).toBe(403);
    expect((await admin.post('/api/admin/links', { headers: { ...H, 'x-csrf-token': 'forged' }, data: body })).status()).toBe(403);
    const other = await login('b@e2e.test');
    // a valid token from another session is not this session's token
    expect((await admin.post('/api/admin/links', { headers: { ...H, 'x-csrf-token': await csrfOf(other, 'ml_csrf') }, data: body })).status()).toBe(403);
    expect((await admin.post('/api/admin/links', { headers: { origin: 'https://evil.example', 'x-csrf-token': await csrfOf(admin, 'ml_csrf') }, data: body })).status()).toBe(403);
    expect((await staffPost(admin, '/api/admin/links', body)).status()).toBe(201);
  });

  test('magic link: same answer for unknown e-mail, one use only', async () => {
    const c = await ctx();
    const unknown = await c.post('/api/auth/magic', { headers: H, data: { email: 'nobody@e2e.test' } });
    const known = await c.post('/api/auth/magic', { headers: H, data: { email: 'admin@e2e.test' } });
    expect(unknown.status()).toBe(200);
    expect(await unknown.text()).toBe(await known.text());
    const files = await readdir(E2E_ENV.MAIL_DIR);
    expect(files).toHaveLength(1);
    const mail = JSON.parse(await readFile(join(E2E_ENV.MAIL_DIR, files[0]!), 'utf8')) as { to: string; text: string };
    expect(mail.to).toBe('admin@e2e.test');
    const token = /token=([\w-]+)/.exec(mail.text)![1]!;
    // opening the e-mail link (GET) must not log in — scanners prefetch it
    const page = await c.get(`/auth/magic?token=${token}`);
    expect(page.status()).toBe(200);
    expect((await c.get('/api/me')).status()).toBe(401);
    expect((await c.post('/api/auth/magic/verify', { headers: H, data: { token } })).status()).toBe(200);
    expect((await c.get('/api/me')).status()).toBe(200);
    const again = await ctx();
    expect((await again.post('/api/auth/magic/verify', { headers: H, data: { token } })).status()).toBe(410);
  });
});

test.describe('photographer boundaries', () => {
  test('sees only assigned projects', async () => {
    const a = await login('a@e2e.test');
    const list = (await (await a.get('/api/projects')).json()) as { projects: { id: string }[] };
    expect(list.projects.map((p) => p.id)).toEqual([S.p1]);
    expect((await a.get(`/api/projects/${S.p1}`)).status()).toBe(200);
    for (const id of [S.p2, S.p3, S.draft]) expect((await a.get(`/api/projects/${id}`)).status()).toBe(404);
  });

  test('cannot get an asset URL of another photographer\'s project', async () => {
    const a = await login('a@e2e.test');
    expect((await a.get(`/api/assets/${S.assetP2}/url`)).status()).toBe(404);
    expect((await a.get(`/api/assets/${S.assetFinal}/url`)).status()).toBe(200);
  });

  test('cannot see or create client links', async () => {
    const a = await login('a@e2e.test');
    expect((await a.get('/api/admin/links')).status()).toBe(403);
    expect((await staffPost(a, '/api/admin/links', { clientId: S.clientX })).status()).toBe(403);
  });
});

test.describe('client link + PIN', () => {
  test('the PIN is stored hashed, never in clear', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const db = sql();
    const [row] = await db<{ pin_hash: string }[]>`select pin_hash from links where id = ${l.id}`;
    await db.end();
    expect(row!.pin_hash.startsWith('$argon2id$')).toBe(true);
    expect(row!.pin_hash).not.toContain(l.pin);
  });

  test('5 wrong PINs lock the link for 10 minutes; the right PIN is refused during the lock', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    for (let i = 1; i <= 4; i++) {
      const { r } = await openLink(l.token, wrongPin(l.pin));
      expect(r.status()).toBe(401);
      expect(((await r.json()) as { remaining: number }).remaining).toBe(5 - i);
    }
    expect((await openLink(l.token, wrongPin(l.pin))).r.status()).toBe(423);
    const { r } = await openLink(l.token, l.pin);
    expect(r.status()).toBe(423);
    expect(new Date(((await r.json()) as { until: string }).until).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
  });

  test('parallel guessing cannot exceed 5 attempts', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const guesses = Array.from({ length: 40 }, (_, i) => String(i).padStart(4, '0')).filter((p) => p !== l.pin);
    const results = await Promise.all(guesses.map(async (pin) => (await openLink(l.token, pin)).r.status()));
    expect(results.filter((s) => s === 401)).toHaveLength(4);
    expect(results.filter((s) => s === 423)).toHaveLength(guesses.length - 4);
    expect((await openLink(l.token, l.pin)).r.status()).toBe(423);
  });

  test('a client sees only its own published, unexpired projects; raw needs permission', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const { c, r } = await openLink(l.token, l.pin);
    expect(r.status()).toBe(200);
    expect(((await r.json()) as { next: string }).next).toBe('/library');
    const lib = (await (await c.get('/api/library')).json()) as { projects: { id: string }[] };
    expect(lib.projects.map((p) => p.id).sort()).toEqual([S.p1, S.p2].sort());
    for (const id of [S.p3, S.draft, S.expired]) expect((await c.get(`/api/projects/${id}`)).status()).toBe(404);
    expect((await c.get(`/api/assets/${S.assetFinal}/url`)).status()).toBe(200);
    expect((await c.get(`/api/assets/${S.assetRaw}/url`)).status()).toBe(403);
    // a viewer session is not a staff session
    expect((await c.get('/api/projects')).status()).toBe(401);
    expect((await c.get('/api/admin/links')).status()).toBe(401);
  });

  test('the PIN accepts Arabic-Indic digits', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const arabic = l.pin.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
    expect((await openLink(l.token, arabic)).r.status()).toBe(200);
  });

  test('revoking or expiring a link ends its sessions; an expired link refuses even the right PIN', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const { c } = await openLink(l.token, l.pin);
    expect((await c.get('/api/library')).status()).toBe(200);
    const db = sql();
    await db`update links set revoked_at = now() where id = ${l.id}`;
    expect((await c.get('/api/library')).status()).toBe(401);
    const l2 = await newLink(admin, { clientId: S.clientX });
    await db`update links set expires_at = now() - interval '1 minute' where id = ${l2.id}`;
    await db.end();
    expect((await openLink(l2.token, l2.pin)).r.status()).toBe(410);
  });

  test('forged tokens open nothing (alg:none, tampered signature, other secret)', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const [h, p, sig] = l.token.split('.') as [string, string, string];
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`;
    const otherClient = `${h}.${b64({ ...claims, cid: S.clientY })}.${sig}`;
    const flipped = `${h}.${p}.${sig.slice(0, -2)}${sig.endsWith('A') ? 'BB' : 'AA'}`;
    for (const t of [none, otherClient, flipped]) expect((await openLink(t, l.pin)).r.status()).toBe(404);
  });

  test('the viewer cookie is httpOnly and a per-session CSRF token is issued for later writes', async () => {
    const admin = await login('admin@e2e.test');
    const l = await newLink(admin, { clientId: S.clientX });
    const { c } = await openLink(l.token, l.pin);
    const cookies = (await c.storageState()).cookies;
    expect(cookies.find((k) => k.name === 'ml_viewer')!.httpOnly).toBe(true);
    expect(await csrfOf(c, 'ml_vcsrf')).not.toBe('');
  });
});

test.describe('guest link', () => {
  test('view only: never a signed asset URL, only its one project', async () => {
    const admin = await login('admin@e2e.test');
    expect((await staffPost(admin, '/api/admin/links', { clientId: S.clientX, kind: 'guest' })).status()).toBe(400);
    const l = await newLink(admin, { clientId: S.clientX, projectId: S.p1, kind: 'guest' });
    const { c, r } = await openLink(l.token, l.pin);
    expect(((await r.json()) as { next: string }).next).toBe(`/p/${S.p1}`);
    expect((await c.get(`/api/projects/${S.p1}`)).status()).toBe(200);
    expect((await c.get(`/api/projects/${S.p2}`)).status()).toBe(404);
    expect((await c.get(`/api/assets/${S.assetFinal}/url`)).status()).toBe(403);
    expect((await c.get(`/api/assets/${S.assetP2}/url`)).status()).toBe(403);
    const lib = (await (await c.get('/api/library')).json()) as { projects: { id: string }[] };
    expect(lib.projects.map((p) => p.id)).toEqual([S.p1]);
  });

  test('a guest link cannot be pointed at another client\'s project', async () => {
    const admin = await login('admin@e2e.test');
    expect((await staffPost(admin, '/api/admin/links', { clientId: S.clientX, projectId: S.p3, kind: 'guest' })).status()).toBe(400);
  });
});
