import { z } from 'zod';
import { prepareBulk, requester } from '@/lib/downloads';
import { handle, json, readJson } from '@/lib/server/http';

const Body = z.object({
  projectId: z.string().uuid(),
  section: z.enum(['photos', 'videos']).optional(),
  group: z.enum(['final', 'raw', 'footage']).optional(),
  ids: z.array(z.string().uuid()).min(1).max(5000).optional(),
  label: z.string().min(1).max(200),
});

/** Bulk download: { mode: 'zip', url } to navigate to, or { mode: 'links', links } above the ZIP limit. */
export const POST = handle(async (req: Request) => {
  const r = await requester(req);
  const b = Body.parse(await readJson(req));
  return json(await prepareBulk(r, b.projectId, { section: b.section, group: b.group, ids: b.ids }, b.label));
});
