import { expect, test } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { E2E_ENV } from './env';
import { ctx, H, login, mails, write } from './helpers';
import { seed, sql, type Seed } from './seed';

/*
 * M2 boundaries over HTTP, against the production build: every admin-only write refuses a team
 * member; the role matrix is enforced on the server; locked permissions cannot be switched on.
 */

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await rm(E2E_ENV.MAIL_DIR, { recursive: true, force: true }); });

test('every admin-only write refuses a photographer', async () => {
  const a = await login('a@e2e.test');
  const client = { nameAr: 'عميل', kind: 'partner', locale: 'ar', defaultLinkDays: 30, allowRaw: false, expiryReminder: true };
  const calls: [Parameters<typeof write>[1], string, unknown][] = [
    ['POST', '/api/admin/clients', client],
    ['PATCH', `/api/admin/clients/${S.clientX}`, client],
    ['POST', `/api/admin/clients/${S.clientX}/archive`, { archived: true }],
    ['POST', '/api/admin/team/invite', { name: 'x y', email: 'x@e2e.test', role: 'photographer' }],
    ['PATCH', `/api/admin/team/${S.photoB}`, { disabled: true }],
    ['PUT', `/api/admin/team/${S.photoB}/password`, { password: 'twelve chars ok' }],
    ['PUT', '/api/admin/settings/rolePermissions', {}],
    ['PUT', '/api/admin/settings/identity', { nameAr: 'x', nameTr: 'y' }],
    ['POST', '/api/admin/projects/bulk', { ids: [S.p1], action: 'archive' }],
  ];
  for (const [m, url, body] of calls) expect((await write(a, m, url, body)).status(), `${m} ${url}`).toBe(403);
  const db = sql();
  const [l] = await db<{ id: string }[]>`insert into links (client_id, kind, jti, pin_hash, expires_at) values (${S.clientX}, 'client', 'j-sec', 'x', now() + interval '1 day') returning id`;
  await db.end();
  for (const a2 of ['revoke', 'pin', 'send']) expect((await write(a, 'POST', `/api/admin/links/${l!.id}/${a2}`, {})).status()).toBe(403);
});

test('admin pages are not even rendered for a photographer', async () => {
  const a = await login('a@e2e.test');
  for (const p of ['/admin/clients', '/admin/team', '/admin/settings', '/admin/import']) expect((await a.get(p)).status(), p).toBe(404);
  expect((await a.get(`/admin/projects/${S.p2}`)).status()).toBe(404);
  expect((await a.get(`/admin/projects/${S.p1}`)).status()).toBe(200);
});

test('a photographer edits only own projects and cannot move one to another client', async () => {
  const a = await login('a@e2e.test');
  expect((await write(a, 'PATCH', `/api/admin/projects/${S.p2}`, { title: 'hijack' })).status()).toBe(404);
  expect((await write(a, 'PATCH', `/api/admin/projects/${S.p1}`, { title: 'عنوان جديد', clientId: S.clientY })).status()).toBe(200);
  const db = sql();
  const [p] = await db<{ title: string; client_id: string }[]>`select title, client_id from projects where id = ${S.p1}`;
  await db.end();
  expect(p).toEqual({ title: 'عنوان جديد', client_id: S.clientX });
});

test('a team member creates a project only with the permission, into «بانتظار التصنيف», as its member', async () => {
  const a = await login('a@e2e.test');
  const r = await write(a, 'POST', '/api/admin/projects', { title: 'مشروع ميداني', clientId: S.clientY });
  expect(r.status()).toBe(201);
  const { id } = (await r.json()) as { id: string };
  const db = sql();
  const [p] = await db<{ name_ar: string; member: boolean }[]>`select c.name_ar, exists (select 1 from project_members m where m.project_id = p.id and m.user_id = ${S.photoA}) as member
    from projects p join clients c on c.id = p.client_id where p.id = ${id}`;
  expect(p).toEqual({ name_ar: 'بانتظار التصنيف', member: true });
  // editors have no createProject by default
  const ed = await login('ed@e2e.test');
  expect((await write(ed, 'POST', '/api/admin/projects', { title: 'لا يجوز' })).status()).toBe(403);
  // the admin switches it off for photographers → refused at once
  const admin = await login('admin@e2e.test');
  const off = { photographer: { upload: true, createProject: false, publishWithoutReview: false, seeClientLinks: false, deleteAfterPublish: false } };
  expect((await write(admin, 'PUT', '/api/admin/settings/rolePermissions', off)).status()).toBe(200);
  expect((await write(a, 'POST', '/api/admin/projects', { title: 'بعد الإيقاف' })).status()).toBe(403);
  await db`delete from settings where key = 'rolePermissions'`;
  await db.end();
});

test('a locked permission stays off whatever is sent', async () => {
  const admin = await login('admin@e2e.test');
  const on = { photographer: { upload: true, createProject: true, publishWithoutReview: true, seeClientLinks: true, deleteAfterPublish: true } };
  const r = await write(admin, 'PUT', '/api/admin/settings/rolePermissions', on);
  expect(r.status()).toBe(200);
  const v = ((await r.json()) as { value: { photographer: Record<string, boolean> } }).value;
  expect(v.photographer.seeClientLinks).toBe(false);
  expect(v.photographer.publishWithoutReview).toBe(true);
  // and a photographer still cannot see links
  const a = await login('a@e2e.test');
  expect((await a.get('/api/admin/links')).status()).toBe(403);
  const db = sql(); await db`delete from settings where key = 'rolePermissions'`; await db.end();
});

test('invite: one 7-day sign-in mail, duplicate refused, the invitee gets in once', async () => {
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'POST', '/api/admin/team/invite', { name: 'مها سليم', email: 'Maha@E2E.test', role: 'photographer' })).status()).toBe(201);
  expect((await write(admin, 'POST', '/api/admin/team/invite', { name: 'مها', email: 'maha@e2e.test', role: 'editor' })).status()).toBe(409);
  const m = (await mails()).filter((x) => x.to === 'maha@e2e.test');
  expect(m).toHaveLength(1);
  const token = /token=([\w-]+)/.exec(m[0]!.text)![1]!;
  const c = await ctx();
  expect((await c.post('/api/auth/magic/verify', { headers: H, data: { token } })).status()).toBe(200);
  expect(((await (await c.get('/api/me')).json()) as { role: string }).role).toBe('photographer');
  expect((await (await ctx()).post('/api/auth/magic/verify', { headers: H, data: { token } })).status()).toBe(410);
});

test('suspending a member signs them out at once', async () => {
  const b = await login('b@e2e.test');
  expect((await b.get('/api/me')).status()).toBe(200);
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'PATCH', `/api/admin/team/${S.photoB}`, { disabled: true })).status()).toBe(200);
  expect((await b.get('/api/me')).status()).toBe(401);
  expect((await write(admin, 'PATCH', `/api/admin/team/${S.admin}`, { disabled: true })).status()).toBe(404);
  await write(admin, 'PATCH', `/api/admin/team/${S.photoB}`, { disabled: false });
});

test('a password the admin chooses: no mail, the member signs in at once; under 12 characters refused', async () => {
  const admin = await login('admin@e2e.test');
  const short = await write(admin, 'POST', '/api/admin/team/invite', { name: 'قصير', email: 'short@e2e.test', role: 'editor', password: 'elevenchars' });
  expect(short.status()).toBe(400);
  expect(((await short.json()) as { error: string }).error).toBe('too_short');
  const db = sql();
  expect(await db`select 1 from users where email = 'short@e2e.test'`).toHaveLength(0); // refused before any row
  const r = await write(admin, 'POST', '/api/admin/team/invite', { name: 'رنا حداد', email: 'Rana@E2E.test', role: 'editor', password: 'رنا كلمة سر طويلة 2026' });
  expect(r.status()).toBe(201);
  expect((await mails()).filter((x) => x.to === 'rana@e2e.test')).toHaveLength(0);
  const c = await ctx();
  const li = await c.post('/api/auth/login', { headers: H, data: { email: 'rana@e2e.test', password: 'رنا كلمة سر طويلة 2026' } });
  expect(li.status()).toBe(200);
  expect(((await li.json()) as { next: string }).next).toBe('/upload');
  expect(((await (await c.get('/api/me')).json()) as { role: string }).role).toBe('editor');
  const [row] = await db<{ password_hash: string }[]>`select password_hash from users where email = 'rana@e2e.test'`;
  expect(row!.password_hash).toMatch(/^\$argon2id\$/); // stored as a hash, never as typed
  await db.end();
});

test('setting a password: the member is signed out everywhere, a lock is lifted, the old one stops; SSO accounts refused', async () => {
  const db = sql();
  const [u] = await db<{ id: string }[]>`select id from users where email = 'rana@e2e.test'`;
  const old = 'رنا كلمة سر طويلة 2026';
  const fresh = 'a new one handed over 2026';
  const member = await ctx();
  expect((await member.post('/api/auth/login', { headers: H, data: { email: 'rana@e2e.test', password: old } })).status()).toBe(200);
  // five wrong attempts lock the email
  const guess = await ctx();
  let last = 0;
  for (let i = 0; i < 5; i++) last = (await guess.post('/api/auth/login', { headers: H, data: { email: 'rana@e2e.test', password: `wrong ${i}` } })).status();
  expect(last).toBe(423);
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'PUT', `/api/admin/team/${u!.id}/password`, { password: 'too short' })).status()).toBe(400);
  expect((await write(admin, 'PUT', `/api/admin/team/${u!.id}/password`, { password: fresh })).status()).toBe(200);
  expect((await member.get('/api/me')).status()).toBe(401);
  const after = await ctx();
  expect((await after.post('/api/auth/login', { headers: H, data: { email: 'rana@e2e.test', password: old } })).status()).toBe(401);
  expect((await after.post('/api/auth/login', { headers: H, data: { email: 'rana@e2e.test', password: fresh } })).status()).toBe(200);
  // the admin's own password is not reachable here, and an SSO account has no local password
  expect((await write(admin, 'PUT', `/api/admin/team/${S.admin}/password`, { password: fresh })).status()).toBe(404);
  const [sso] = await db<{ id: string }[]>`insert into users (name, email, role, auth_provider, external_id) values ('من الموقع الأم', 'sso-pw@e2e.test', 'editor', 'emdatra', 'ext-pw-1') returning id`;
  const refused = await write(admin, 'PUT', `/api/admin/team/${sso!.id}/password`, { password: fresh });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: string }).error).toBe('sso_account');
  await db.end();
});

test('short link → signed gate; download rights are per link; a guest never downloads', async () => {
  const admin = await login('admin@e2e.test');
  const mk = async (body: Record<string, unknown>) => (await (await write(admin, 'POST', '/api/admin/links', body)).json()) as { id: string; shortPath: string; pin: string };
  const l = await mk({ clientId: S.clientX, allowDownload: false });
  expect(l.shortPath).toMatch(/^\/c\/[2-9a-zA-Z]{5}-[2-9a-zA-Z]{5}$/);
  const c = await ctx();
  const res = await c.get(l.shortPath, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const gate = res.headers().location!;
  expect(gate).toMatch(/\/l\/ey/);
  expect((await c.get('/c/zzzzz-zzzzz')).status()).toBe(404);
  const token = gate.split('/l/')[1]!;
  expect((await c.post('/api/link/pin', { headers: H, data: { token, pin: l.pin } })).status()).toBe(200);
  expect((await c.get(`/api/projects/${S.p1}`)).status()).toBe(200);
  expect((await c.get(`/api/assets/${S.assetFinal}/url`)).status()).toBe(403);

  const g = await mk({ clientId: S.clientX, projectId: S.p1, kind: 'guest', allowDownload: true });
  const db = sql();
  const [row] = await db<{ allow_download: boolean }[]>`select allow_download from links where id = ${g.id}`;
  await db.end();
  expect(row!.allow_download).toBe(false);
});

test('the link mail carries the link, never the PIN', async () => {
  const admin = await login('admin@e2e.test');
  const l = (await (await write(admin, 'POST', '/api/admin/links', { clientId: S.clientX, projectId: S.p1 })).json()) as { id: string; pin: string; shortPath: string };
  expect((await write(admin, 'POST', `/api/admin/links/${l.id}/send`, {})).status()).toBe(200);
  const m = (await mails()).filter((x) => x.to === 'heba@alnoor.test').at(-1)!;
  expect(m.text).toContain(l.shortPath);
  expect(m.text).not.toContain(l.pin);
  const noMail = (await (await write(admin, 'POST', '/api/admin/links', { clientId: S.clientY })).json()) as { id: string };
  expect((await write(admin, 'POST', `/api/admin/links/${noMail.id}/send`, {})).status()).toBe(400);
});

test('new PIN unlocks a locked link; the old PIN stops working', async () => {
  const admin = await login('admin@e2e.test');
  const l = (await (await write(admin, 'POST', '/api/admin/links', { clientId: S.clientX })).json()) as { id: string; path: string; pin: string };
  const token = l.path.slice(3);
  const c = await ctx();
  for (let i = 0; i < 5; i++) await c.post('/api/link/pin', { headers: H, data: { token, pin: String((Number(l.pin) + 1) % 10000).padStart(4, '0') } });
  expect((await c.post('/api/link/pin', { headers: H, data: { token, pin: l.pin } })).status()).toBe(423);
  const { pin } = (await (await write(admin, 'POST', `/api/admin/links/${l.id}/pin`, {})).json()) as { pin: string };
  if (pin !== l.pin) expect((await c.post('/api/link/pin', { headers: H, data: { token, pin: l.pin } })).status()).toBe(401);
  expect((await c.post('/api/link/pin', { headers: H, data: { token, pin } })).status()).toBe(200);
});

test('bulk publish skips projects with nothing ready', async () => {
  const pre = sql();
  await pre`update projects set status = 'review' where id = ${S.p3}`;
  await pre`insert into assets (project_id, section, "group", r2_key, original_name, mime, size, status) values (${S.p3}, 'photos', 'final', 'k/p3.jpg', 'p3.jpg', 'image/jpeg', 10, 'ready')`;
  await pre.end();
  const admin = await login('admin@e2e.test');
  const r = await write(admin, 'POST', '/api/admin/projects/bulk', { ids: [S.draft, S.p3], action: 'publish' });
  expect(((await r.json()) as { changed: number }).changed).toBe(1);
  const db = sql();
  const rows = await db<{ id: string; status: string }[]>`select id, status from projects where id in (${S.draft}, ${S.p3})`;
  await db.end();
  expect(Object.fromEntries(rows.map((x) => [x.id, x.status]))).toEqual({ [S.draft]: 'draft', [S.p3]: 'published' });
});

test('logo: SVG and fakes refused, PNG served same-origin with nosniff', async () => {
  const admin = await login('admin@e2e.test');
  const csrfTok = (await admin.storageState()).cookies.find((k) => k.name === 'ml_csrf')!.value;
  const up = (name: string, mimeType: string, buffer: Buffer) =>
    admin.post('/api/admin/settings/logo', { headers: { ...H, 'x-csrf-token': csrfTok }, multipart: { logo: { name, mimeType, buffer } } });
  expect((await up('x.svg', 'image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status()).toBe(415);
  expect((await up('x.png', 'image/png', Buffer.from('<script>alert(1)</script>'))).status()).toBe(415);
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  expect((await up('logo.png', 'image/png', png)).status()).toBe(200);
  const r = await (await ctx()).get('/api/branding/logo');
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toBe('image/png');
  expect(r.headers()['x-content-type-options']).toBe('nosniff');
});

test('saved views belong to their user', async () => {
  const admin = await login('admin@e2e.test');
  expect((await write(admin, 'POST', '/api/admin/views', { name: 'منشور', query: 'status=published' })).status()).toBe(200);
  expect((await write(admin, 'POST', '/api/admin/views', { name: 'x', query: '"><script>' })).status()).toBe(400);
  const a = await login('a@e2e.test');
  const page = await (await a.get('/admin/archive')).text();
  expect(page).not.toContain('status=published');
});
