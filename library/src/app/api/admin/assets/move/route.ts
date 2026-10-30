import { MoveInput, moveToAlbum } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  return json(await moveToAlbum(staff, MoveInput.parse(await readJson(req))));
});
