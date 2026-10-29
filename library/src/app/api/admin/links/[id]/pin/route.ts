import { requireStaff } from '@/lib/auth/session';
import { resetPin } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json } from '@/lib/server/http';

/** New PIN (and unlock). Returned once; only its hash is kept. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'not_found');
  const pin = await resetPin(id);
  if (!pin) throw new HttpError(404, 'not_found');
  await audit('user', staff.id, 'link.pin_reset', { type: 'link', id });
  return json({ pin });
});
