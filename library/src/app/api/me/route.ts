import { requireStaff } from '@/lib/auth/session';
import { handle, json } from '@/lib/server/http';

export const GET = handle(async (req: Request) => {
  const s = await requireStaff(req);
  return json({ id: s.id, name: s.name, role: s.role, locale: s.locale });
});
