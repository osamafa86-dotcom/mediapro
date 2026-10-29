import { destroySession, requireStaff } from '@/lib/auth/session';
import { handle, json } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  await requireStaff(req);
  await destroySession();
  return json({ ok: true });
});
