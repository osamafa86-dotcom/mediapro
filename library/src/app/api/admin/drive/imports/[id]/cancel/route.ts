import { requireStaff } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { cancelImport } from '@/lib/drive';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json } from '@/lib/server/http';

/** Stop a queued or running import; what already arrived stays in its project. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  await cancelImport(id);
  await audit('user', staff.id, 'drive.import_cancelled', { type: 'drive_import', id });
  return json({ ok: true });
});
