import { ClientInput, saveClient } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  return json({ id: await saveClient(staff, null, ClientInput.parse(await readJson(req))) }, 201);
});
