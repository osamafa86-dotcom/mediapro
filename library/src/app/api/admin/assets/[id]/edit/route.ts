import { EditInput, setEdit } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  return json(await setEdit(staff, id, EditInput.parse(await readJson(req))));
});
