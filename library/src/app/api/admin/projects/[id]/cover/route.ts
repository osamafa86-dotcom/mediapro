import { CoverInput, setCover } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  await setCover(staff, (await ctx.params).id, CoverInput.parse(await readJson(req)).assetId);
  return json({ ok: true });
});
