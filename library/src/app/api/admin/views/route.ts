import { z } from 'zod';
import { getSql } from '@/db';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

/** Saved archive views, per user: a name and the filter query string. */
const View = z.object({ name: z.string().trim().min(1).max(40), query: z.string().max(600).regex(/^[\w=&%.+\-~]*$/) });

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  const v = View.parse(await readJson(req));
  const key = `views:${staff.id}`;
  const sql = getSql();
  const [r] = await sql<{ value: { name: string; query: string }[] }[]>`select value from settings where key = ${key}`;
  const list = (r?.value ?? []).filter((x) => x.name !== v.name).concat(v).slice(-12);
  await sql`insert into settings (key, value) values (${key}, ${JSON.stringify(list)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return json({ views: list });
});

export const DELETE = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const key = `views:${staff.id}`;
  const sql = getSql();
  const [r] = await sql<{ value: { name: string; query: string }[] }[]>`select value from settings where key = ${key}`;
  const list = (r?.value ?? []).filter((x) => x.name !== name);
  await sql`insert into settings (key, value) values (${key}, ${JSON.stringify(list)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return json({ views: list });
});
