import { requireStaff } from '@/lib/auth/session';
import { listProjectsForStaff } from '@/lib/authz';
import { handle, json } from '@/lib/server/http';

export const GET = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  return json({ projects: await listProjectsForStaff(staff) });
});
