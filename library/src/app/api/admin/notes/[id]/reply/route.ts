import { z } from 'zod';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { staffReply } from '@/lib/notes';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

const Body = z.object({ body: z.string().trim().min(1).max(2000) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  await staffReply(staff, id, Body.parse(await readJson(req)).body);
  return json({ ok: true }, 201);
});
