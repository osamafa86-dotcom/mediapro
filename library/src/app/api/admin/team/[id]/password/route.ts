import { PasswordInput, setMemberPassword } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  await setMemberPassword(staff, id, PasswordInput.parse(await readJson(req)).password);
  return json({ ok: true });
});
