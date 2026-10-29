import { deleteAssets, DeleteInput } from '@/lib/admin/assets';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

/** POST with a body (a list of ids), not DELETE: the same CSRF-checked JSON path as every other admin write. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  return json(await deleteAssets(staff, DeleteInput.parse(await readJson(req))));
});
