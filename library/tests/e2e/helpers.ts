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
