import { z } from 'zod';
import { getSql } from '@/db';
import { requireStaff } from '@/lib/auth/session';
import { issueLink } from '@/lib/auth/viewer';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json, readJson } from '@/lib/server/http';
import { getSettings } from '@/lib/settings';

const Body = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullish(),
  kind: z.enum(['client', 'guest']).default('client'),
  days: z.number().int().min(1).max(365).optional(),
  allowDownload: z.boolean().optional(),
  notifyFirstDownload: z.boolean().optional(),
});

/** Admin only — photographers never see or create client links. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, ['admin']);
  const rows = await getSql()`select id, client_id, project_id, kind, expires_at, revoked_at, opens, last_opened_at, locked_until, created_at
    from links order by created_at desc limit 200`;
  return json({ links: rows });
});

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const b = Body.parse(await readJson(req));
  const sql = getSql();
  const [c] = await sql<{ default_link_days: number }[]>`select default_link_days from clients where id = ${b.clientId} and archived_at is null`;
  if (!c) throw new HttpError(404, 'client_not_found');
  if (b.projectId && !(await sql`select 1 from projects where id = ${b.projectId} and client_id = ${b.clientId}`).length) {
    throw new HttpError(400, 'project_not_of_client');
  }
  const tz = (await getSettings()).region.timeZone;
  const link = await issueLink({
    clientId: b.clientId, projectId: b.projectId, kind: b.kind, days: b.days ?? c.default_link_days, createdBy: staff.id,
    allowDownload: b.allowDownload, notifyFirstDownload: b.notifyFirstDownload, timeZone: tz,
  });
  await audit('user', staff.id, 'link.created', { type: 'link', id: link.id }, { kind: b.kind });
  return json({ id: link.id, path: link.path, shortPath: link.shortPath, pin: link.pin, expiresAt: link.expiresAt.toISOString() }, 201);
});
