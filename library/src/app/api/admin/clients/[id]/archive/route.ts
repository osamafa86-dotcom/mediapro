import { z } from 'zod';
import { archiveClient } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  const { archived } = z.object({ archived: z.boolean() }).parse(await readJson(req));
  await archiveClient(staff, id, archived);
  return json({ ok: true });
});
