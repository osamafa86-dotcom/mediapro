import { getSql } from '@/db';
import { getStaff } from '@/lib/auth/session';
import { getViewer } from '@/lib/auth/viewer';
import { getAsset, staffCanAccessProject, viewerCanSeeProject } from '@/lib/authz';
import { presignGet } from '@/lib/storage';
import { handle, HttpError, json } from '@/lib/server/http';

/**
 * Signed URL for an original. Staff with access to the project, or a *client* viewer of it.
 * A guest session never receives one (decision in DESIGN.md: guest = watermarked previews only),
 * and raw files go to a client only when the client is allowed raw.
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const staff = await getStaff();
  const viewer = staff ? null : await getViewer();
  if (!staff && !viewer) throw new HttpError(401, 'unauthenticated');
  if (viewer?.kind === 'guest') throw new HttpError(403, 'guest_view_only');
  const asset = await getAsset(id);
  if (!asset || asset.status !== 'ready') throw new HttpError(404, 'not_found');
  if (staff) {
    if (!(await staffCanAccessProject(staff, asset.project_id))) throw new HttpError(404, 'not_found');
  } else {
    if (!(await viewerCanSeeProject(viewer!, asset.project_id))) throw new HttpError(404, 'not_found');
    if (!viewer!.allowDownload) throw new HttpError(403, 'download_disabled');
    if (asset.group === 'raw') {
      const [c] = await getSql()<{ allow_raw: boolean }[]>`select allow_raw from clients where id = ${viewer!.clientId}`;
      if (!c?.allow_raw) throw new HttpError(403, 'raw_not_allowed');
    }
  }
  return json({ url: await presignGet(asset.r2_key, { filename: asset.original_name, seconds: 3600 }) });
});
