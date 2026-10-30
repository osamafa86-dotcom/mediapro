import { AlbumInput, createAlbum } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  return json({ id: await createAlbum(staff, (await ctx.params).id, AlbumInput.parse(await readJson(req)).name) });
});
