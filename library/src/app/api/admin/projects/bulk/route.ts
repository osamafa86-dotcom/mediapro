import { bulkProjects, BulkInput } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  return json({ changed: await bulkProjects(staff, BulkInput.parse(await readJson(req))) });
});
