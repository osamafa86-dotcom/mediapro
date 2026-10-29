import { z } from 'zod';
import { requireStaff } from '@/lib/auth/session';
import { startImports } from '@/lib/drive';
import { audit } from '@/lib/server/audit';
import { handle, json, readJson } from '@/lib/server/http';

const Item = z.object({
  folderId: z.string().regex(/^[\w-]{1,200}$/),
  folderName: z.string().min(1).max(300),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  shotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
const Body = z.object({ items: z.array(Item).min(1).max(100) });

/** Queue the chosen folders. Each becomes a background job; this answers at once. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const { items } = Body.parse(await readJson(req));
  const ids = await startImports(staff, items);
  for (const id of ids) await audit('user', staff.id, 'drive.import_started', { type: 'drive_import', id });
  return json({ ids }, 201);
});
