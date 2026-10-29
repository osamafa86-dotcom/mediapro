import { ProjectInput, updateProject } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  await updateProject(staff, id, ProjectInput.partial().parse(await readJson(req)));
  return json({ ok: true });
});
