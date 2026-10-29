import { getSql } from '@/db';
import { getStaff } from '@/lib/auth/session';
import { getViewer } from '@/lib/auth/viewer';
import { staffCanAccessProject, viewerCanSeeProject } from '@/lib/authz';
import { handle, HttpError, json } from '@/lib/server/http';

/**
 * One project, for whoever is signed in: staff (admin, or a photographer who is a member) or a
 * client/guest viewer whose link covers it. Anything else is 404 — not 403 — so ids cannot be probed.
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const staff = await getStaff();
  const viewer = staff ? null : await getViewer();
  if (!staff && !viewer) throw new HttpError(401, 'unauthenticated');
  const allowed = staff ? await staffCanAccessProject(staff, id) : await viewerCanSeeProject(viewer!, id);
  if (!allowed) throw new HttpError(404, 'not_found');
  const [p] = await getSql()`select id, client_id, title, type, team, shot_date, place, status, expires_at, published_at from projects where id = ${id}`;
  return json({ project: p });
});
