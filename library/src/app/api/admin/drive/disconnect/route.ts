import { requireStaff } from '@/lib/auth/session';
import { disconnect } from '@/lib/drive';
import { handle, json } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  await disconnect(staff.id);
  return json({ ok: true });
});
