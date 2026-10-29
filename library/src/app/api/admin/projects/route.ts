import { createProject, ProjectInput } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  const id = await createProject(staff, ProjectInput.parse(await readJson(req)));
  return json({ id }, 201);
});
