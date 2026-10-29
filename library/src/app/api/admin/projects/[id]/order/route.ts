import { OrderInput, reorder } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  await reorder(staff, (await ctx.params).id, OrderInput.parse(await readJson(req)));
  return json({ ok: true });
});
