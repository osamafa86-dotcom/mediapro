import { AlbumInput, deleteAlbum, renameAlbum } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  await renameAlbum(staff, (await ctx.params).id, AlbumInput.parse(await readJson(req)).name);
  return json({ ok: true });
});

/** The album only: its files return to «الصور»/«الفيديو». */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  return json(await deleteAlbum(staff, (await ctx.params).id));
});
