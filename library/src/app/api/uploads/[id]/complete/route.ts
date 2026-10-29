import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json } from '@/lib/server/http';
import { finishUpload } from '@/lib/uploads';

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  return json((await finishUpload(staff, id)) ?? { ok: true });
});
