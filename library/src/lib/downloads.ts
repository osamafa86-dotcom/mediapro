import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { makeZip, predictLength } from 'client-zip';
import { getSql } from '@/db';
import type { Renditions } from '@/db/schema';
import { getStaff, type Staff } from './auth/session';
import { getViewer, type Viewer } from './auth/viewer';
import { staffCanAccessProject } from './authz';
import { notifyAdmins } from './notify';
import { visibleAssets, clientAllowsRaw } from './portal';
import { HttpError, requireSameOrigin } from './server/http';
import { safeEqual } from './crypto';
import { bucket, presignGet, s3 } from './storage';

/*
 * Downloads (M5). One rule for who may: staff with access to the project (the admin export bypasses
 * PINs — DESIGN §6.7), or a client viewer whose link allows downloads. A guest never downloads.
 * Bulk = a streamed ZIP64 in STORE mode (nothing is recompressed, nothing is buffered); above
 * ZIP_LINKS_LIMIT the browser gets one signed link per file instead (DESIGN §9).
 */

export const ZIP_LINKS_LIMIT = Number(process.env.ZIP_LINKS_LIMIT_BYTES ?? 20 * 1024 ** 3);
const TICKET_MINUTES = 60;

export type Requester = { kind: 'staff'; staff: Staff } | { kind: 'viewer'; viewer: Viewer };

/** Who is downloading. Writes (preparing a bulk download) also need same Origin + the session's CSRF token. */
export async function requester(req: Request): Promise<Requester> {
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  const staff = await getStaff();
  const viewer = staff ? null : await getViewer();
  if (!staff && !viewer) throw new HttpError(401, 'unauthenticated');
  if (write) {
    requireSameOrigin(req);
    if (!safeEqual(req.headers.get('x-csrf-token') ?? '', (staff ?? viewer)!.csrf)) throw new HttpError(403, 'bad_csrf');
  }
  if (staff) return { kind: 'staff', staff };
  if (viewer!.kind === 'guest') throw new HttpError(403, 'guest_view_only');
  if (!viewer!.allowDownload) throw new HttpError(403, 'download_disabled');
  return { kind: 'viewer', viewer: viewer! };
}

interface DlAsset { id: string; project_id: string; r2_key: string; original_name: string; section: 'photos' | 'videos'; group: string; size: number; renditions: Renditions; taken_at: string | null }

/** The project's downloadable assets for this requester, optionally narrowed. 404 if the project is not theirs. */
export async function downloadable(r: Requester, projectId: string, f: { section?: string; group?: string; ids?: string[] } = {}): Promise<DlAsset[]> {
  const sql = getSql();
  let scope;
  if (r.kind === 'staff') {
    if (!(await staffCanAccessProject(r.staff, projectId))) throw new HttpError(404, 'not_found');
    scope = sql`a.status = 'ready' and a.replaced_by is null`;
  } else {
    const v = r.viewer;
    const [p] = await sql`select 1 from projects p where p.id = ${projectId} and p.client_id = ${v.clientId} and p.status = 'published'
      and p.archived_at is null and (p.expires_at is null or p.expires_at > now())`;
    if (!p) throw new HttpError(404, 'not_found');
    scope = visibleAssets(v, await clientAllowsRaw(v.clientId));
  }
  return sql<DlAsset[]>`
    select a.id, a.project_id, a.r2_key, a.original_name, a.section, a."group", a.size::float8 as size, a.renditions, a.taken_at
    from assets a where a.project_id = ${projectId} and ${scope}
      ${f.section ? sql`and a.section = ${f.section}` : sql``}
      ${f.group ? sql`and a."group" = ${f.group}` : sql``}
      ${f.ids ? sql`and a.id = any(${f.ids}::uuid[])` : sql``}
    order by a.section, a."group", a.sort_order, a.original_name`;
}

/** Book-keeping for every download: a row, the per-asset counter, and the first-download mail. */
export async function record(r: Requester, projectId: string, assetIds: string[], kind: string, bytes: number) {
  const sql = getSql();
  const linkId = r.kind === 'viewer' ? r.viewer.linkId : null;
  const userId = r.kind === 'staff' ? r.staff.id : null;
  let first = false;
  if (linkId) {
    const [prev] = await sql<{ n: number }[]>`select count(*)::int as n from downloads where link_id = ${linkId}`;
    first = prev!.n === 0;
  }
  await sql`insert into downloads (link_id, user_id, asset_id, project_id, kind, bytes)
    values (${linkId}, ${userId}, ${assetIds.length === 1 ? assetIds[0]! : null}, ${projectId}, ${kind}, ${bytes})`;
  if (assetIds.length) await sql`update assets set downloads = downloads + 1 where id = any(${assetIds}::uuid[])`;
  if (first && linkId) {
    const [l] = await sql<{ notify: boolean; name: string }[]>`select l.notify_first_download as notify, c.name_ar as name from links l join clients c on c.id = l.client_id where l.id = ${linkId}`;
    if (l?.notify) await notifyAdmins('onFirstDownload', { projectId, client: l.name }, { force: true });
  }
}

const stem = (n: string) => n.replace(/\.[^.]+$/, '');

/** One file: the original, or the web copy (2048px JPEG / 1080p MP4). Returns a signed URL with an attachment name. */
export async function singleFile(r: Requester, assetId: string, variant: 'original' | 'web') {
  const sql = getSql();
  const [row] = await sql<{ project_id: string }[]>`select project_id from assets where id = ${assetId}`;
  if (!row) throw new HttpError(404, 'not_found');
  const [a] = await downloadable(r, row.project_id, { ids: [assetId] });
  if (!a) throw new HttpError(404, 'not_found');
  let key = a.r2_key;
  let filename = a.original_name;
  if (variant === 'web') {
    const web = a.section === 'photos' ? a.renditions.web : a.renditions.mp4_1080;
    if (!web) throw new HttpError(404, 'no_web_copy');
    key = web;
    filename = a.section === 'photos' ? `${stem(a.original_name)}-2048.jpg` : `${stem(a.original_name)}-1080p.mp4`;
  }
  await record(r, a.project_id, [a.id], variant, variant === 'original' ? a.size : 0);
  return presignGet(key, { filename, seconds: 600 });
}

export interface Folders { photos: string; videos: string; final: string; raw: string; footage: string }

/** Names inside the ZIP: <section>/<group>/<file>, with (2), (3)… for duplicates. Exported for tests. */
export function zipNames(assets: { section: string; group: string; original_name: string }[], folders: Folders) {
  const seen = new Map<string, number>();
  return assets.map((a) => {
    const dir = `${folders[a.section as 'photos']}/${folders[a.group as 'final']}`;
    const base = a.original_name.replace(/[\\/]/g, '_').replace(/^\.+/, '_') || 'file';
    let name = `${dir}/${base}`;
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    if (n > 1) name = `${dir}/${stem(base)} (${n})${base.slice(stem(base).length)}`;
    return name;
  });
}

const safeZipName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'download';

/** Prepare a bulk download: a ticket the browser navigates to (ZIP), or signed links above the limit. */
export async function prepareBulk(r: Requester, projectId: string, f: { section?: string; group?: string; ids?: string[] }, label: string) {
  const assets = await downloadable(r, projectId, f);
  if (!assets.length) throw new HttpError(404, 'nothing_to_download');
  const bytes = assets.reduce((s, a) => s + a.size, 0);
  if (bytes > ZIP_LINKS_LIMIT) {
    const links = await Promise.all(assets.map(async (a) => ({ id: a.id, name: a.original_name, size: a.size, url: await presignGet(a.r2_key, { filename: a.original_name, seconds: 3 * 3600 }) })));
    await record(r, projectId, assets.map((a) => a.id), 'links', bytes);
    return { mode: 'links' as const, count: assets.length, bytes, links };
  }
  const [t] = await getSql()<{ id: string }[]>`
    insert into download_tickets (link_id, user_id, project_id, asset_ids, name, bytes, expires_at)
    values (${r.kind === 'viewer' ? r.viewer.linkId : null}, ${r.kind === 'staff' ? r.staff.id : null}, ${projectId},
      ${assets.map((a) => a.id)}::uuid[], ${safeZipName(label)}, ${bytes}, ${new Date(Date.now() + TICKET_MINUTES * 60_000).toISOString()})
    returning id`;
  return { mode: 'zip' as const, count: assets.length, bytes, url: `/api/download/zip/${t!.id}` };
}

/** Stream the ticket's ZIP. The ticket only works for the session that made it, and re-checks access now. */
export async function streamZip(r: Requester, ticketId: string, folders: Folders) {
  const sql = getSql();
  const [t] = await sql<{ project_id: string; asset_ids: string[]; name: string; link_id: string | null; user_id: string | null; expires_at: string }[]>`
    select project_id, asset_ids, name, link_id, user_id, expires_at from download_tickets where id = ${ticketId}`;
  const mine = t && (r.kind === 'viewer' ? t.link_id === r.viewer.linkId : t.user_id === r.staff.id);
  if (!t || !mine) throw new HttpError(404, 'not_found');
  if (new Date(t.expires_at).getTime() < Date.now()) throw new HttpError(410, 'ticket_expired');
  const assets = await downloadable(r, t.project_id, { ids: t.asset_ids }); // access may have changed since
  if (!assets.length) throw new HttpError(404, 'nothing_to_download');
  const names = zipNames(assets, folders);
  const meta = assets.map((a, i) => ({ name: names[i]!, size: a.size, lastModified: a.taken_at ? new Date(a.taken_at) : new Date(0) }));
  const length = predictLength(meta);
  async function* files() {
    for (const [i, a] of assets.entries()) {
      // opened one at a time, only when the ZIP writer reaches it
      const o = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: a.r2_key }));
      yield { ...meta[i]!, input: o.Body!.transformToWebStream() as ReadableStream<Uint8Array> };
    }
  }
  await record(r, t.project_id, assets.map((a) => a.id), 'zip', assets.reduce((s, a) => s + a.size, 0));
  return { stream: makeZip(files(), { buffersAreUTF8: true }), length, filename: `${t.name}.zip` };
}
