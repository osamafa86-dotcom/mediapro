import { z } from 'zod';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { noteThreadForStaff, updateNote } from '@/lib/notes';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  return json({ notes: await noteThreadForStaff(staff, id) });
});

const Patch = z.object({ status: z.enum(['open', 'in_progress', 'resolved']).optional(), assigneeId: z.string().uuid().nullable().optional() });

/** Status (team) and assignee (admin only). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  await updateNote(staff, id, Patch.parse(await readJson(req)));
  return json({ ok: true });
});
