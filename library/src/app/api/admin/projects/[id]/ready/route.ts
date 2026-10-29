import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { handle, HttpError, json } from '@/lib/server/http';
import { markReady } from '@/lib/uploads';
import { notifyAdmins } from '@/lib/notify';

/** «جاهز للمراجعة» — from the photographer's upload page. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  const r = await markReady(staff, id);
  if (r.status === 'review') await notifyAdmins('onReview', { projectId: id, by: staff.name });
  return json(r);
});
