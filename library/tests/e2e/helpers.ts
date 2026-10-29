import { expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { E2E_ENV } from './env';
import { ORIGIN, PASSWORD } from './seed';

export const H = { origin: ORIGIN };

export const ctx = () => pwRequest.newContext({ baseURL: ORIGIN });

export async function csrf(c: APIRequestContext) {
  return (await c.storageState()).cookies.find((k) => k.name === 'ml_csrf')?.value ?? '';
}

export async function login(email: string): Promise<APIRequestContext> {
  const c = await ctx();
  const r = await c.post('/api/auth/login', { headers: H, data: { email, password: PASSWORD } });
  expect(r.status(), `login ${email}`).toBe(200);
  return c;
}

/** A staff write with this session's CSRF token: method + JSON body. */
export async function write(c: APIRequestContext, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, data?: unknown) {
  return c.fetch(url, { method, headers: { ...H, 'x-csrf-token': await csrf(c) }, data });
}

export async function mails(): Promise<{ to: string; subject: string; text: string }[]> {
  const files = await readdir(E2E_ENV.MAIL_DIR).catch(() => [] as string[]);
  return Promise.all(files.sort().map(async (f) => JSON.parse(await readFile(join(E2E_ENV.MAIL_DIR, f), 'utf8'))));
}

/** Upload a real file through the M3 flow (open → signed part PUT → signed complete → app complete): the browser's work, over HTTP. */
export async function uploadFile(c: APIRequestContext, projectId: string, path: string, opts: { mime: string; group?: string }) {
  const bytes = await readFile(path);
  const name = path.split('/').pop()!;
  const o = await write(c, 'POST', '/api/uploads', { projectId, filename: name, size: bytes.length, mime: opts.mime, group: opts.group, fingerprint: `fx-${name}-${Date.now()}-${Math.random()}` });
  expect(o.status(), await o.text()).toBe(200);
  const u = (await o.json()) as { id: string; key: string; uploadId: string };
  const sign = async (body: Record<string, unknown>) => ((await (await write(c, 'POST', '/api/uploads/sign', { key: u.key, uploadId: u.uploadId, ...body })).json()) as { url: string }).url;
  const pr = await fetch(await sign({ method: 'PUT', partNumber: 1 }), { method: 'PUT', body: new Uint8Array(bytes) });
  const etag = pr.headers.get('etag');
  const cr = await fetch(await sign({ method: 'POST' }), { method: 'POST', body: `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${etag}</ETag></Part></CompleteMultipartUpload>` });
  expect(cr.status).toBe(200);
  const done = await write(c, 'POST', `/api/uploads/${u.id}/complete`);
  expect(done.status(), await done.text()).toBe(200);
  return ((await done.json()) as { assetId: string }).assetId;
}
