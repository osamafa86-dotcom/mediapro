import { z } from 'zod';
import { getSql } from '@/db';
import { requireStaff } from '@/lib/auth/session';
import { projectLink } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

const Body = z.object({ allowDownload: z.boolean().optional() });

/** The project's one permanent delivery link (no PIN, no expiry): the same link every time; admin only. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  const b = Body.parse(await readJson(req));
  const [p] = await getSql()<{ client_id: string }[]>`select p.client_id from projects p join clients c on c.id = p.client_id
    where p.id = ${id} and c.archived_at is null`;
  if (!p) throw new HttpError(404, 'not_found');
  const l = await projectLink({ clientId: p.client_id, projectId: id, createdBy: staff.id, allowDownload: b.allowDownload });
  if (l.created) await audit('user', staff.id, 'link.created', { type: 'link', id: l.id }, { kind: 'permanent' });
  return json({ id: l.id, shortPath: l.shortPath, allowDownload: l.allowDownload });
});
