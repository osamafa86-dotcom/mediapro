import { deleteProjects } from '@/lib/admin/assets';
import { bulkProjects, BulkInput } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const b = BulkInput.parse(await readJson(req));
  return json({ changed: b.action === 'delete' ? await deleteProjects(staff, b.ids) : await bulkProjects(staff, b) });
});
