import { invite, InviteInput } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  return json({ id: await invite(staff, InviteInput.parse(await readJson(req))) }, 201);
});
