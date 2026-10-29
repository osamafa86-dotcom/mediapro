import { requireViewer } from '@/lib/auth/viewer';
import { listProjectsForViewer } from '@/lib/authz';
import { handle, json } from '@/lib/server/http';

export const GET = handle(async (req: Request) => {
  const v = await requireViewer(req);
  return json({ kind: v.kind, projects: await listProjectsForViewer(v) });
});
