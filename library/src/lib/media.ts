import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSql } from '@/db';
import type { Renditions } from '@/db/schema';
import { getStaff } from './auth/session';
import { getViewer } from './auth/viewer';
import { staffCanAccessProject, viewerCanSeeProject } from './authz';
import { bucket, s3 } from './storage';
export { keyFor } from './media-keys';
export type { Audience } from './media-keys';
import type { Audience } from './media-keys';

/*
 * Who may see which rendition. Checked on every request before a short signed URL is handed out
 * (DESIGN: «تحقق قبل الكاش؛ 302 إلى رابط موقّع»). Guests get watermarked previews and the stream
 * only; never the web download copy, the RAW preview at full size, or anything they could keep.
 */

export interface AssetForMedia { id: string; project_id: string; status: string; renditions: Renditions; section: string; group: string }

export async function audienceFor(asset: AssetForMedia): Promise<Audience | null> {
  const staff = await getStaff();
  if (staff) return (await staffCanAccessProject(staff, asset.project_id)) ? 'staff' : null;
  const viewer = await getViewer();
  if (!viewer || asset.status !== 'ready') return null;
  if (!(await viewerCanSeeProject(viewer, asset.project_id))) return null;
  if (viewer.kind !== 'guest') return 'client';
  return asset.group === 'raw' ? null : 'guest'; // no «خام» for guests (DESIGN.md)
}

export async function loadAsset(id: string): Promise<AssetForMedia | null> {
  const [a] = await getSql()<AssetForMedia[]>`select id, project_id, status, renditions, section, "group" from assets where id = ${id}`;
  return a ?? null;
}

async function text(key: string) {
  const o = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return o.Body!.transformToString();
}

/** Playlists are rewritten so each URI comes back through this gate (each segment is checked and signed). */
export async function playlist(key: string, base: string): Promise<string> {
  const dir = base.replace(/[^/]*$/, '');
  return (await text(key)).split('\n').map((line) => {
    if (line.startsWith('#EXT-X-MAP:')) return line.replace(/URI="([^"]+)"/, (_, u: string) => `URI="${dir}${u}"`);
    if (!line || line.startsWith('#')) return line;
    return `${dir}${line.trim()}`;
  }).join('\n');
}

/** The scrub track's cues name the sprite relatively; point them at the gate too. */
export async function scrubTrack(key: string, assetId: string): Promise<string> {
  return (await text(key)).replace(/^sprite\.jpg#/gm, `/m/${assetId}/sprite.jpg#`);
}
