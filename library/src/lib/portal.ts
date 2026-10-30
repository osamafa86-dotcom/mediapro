import 'server-only';
import { getSql } from '@/db';
import type { Renditions } from '@/db/schema';
import type { Viewer } from './auth/viewer';
import type { ViewAsset } from '@/components/portal/ProjectView';

/*
 * What a client or guest sees (M5). One predicate decides which assets are visible, used by the pages,
 * the media gate and the downloads alike:
 *   ready, not replaced by a newer version; the «خام» group only for a client allowed raw, never a guest.
 */

export type Group = 'final' | 'raw' | 'footage';
export type Section = 'photos' | 'videos';

export async function clientAllowsRaw(clientId: string): Promise<boolean> {
  const [c] = await getSql()<{ allow_raw: boolean }[]>`select allow_raw from clients where id = ${clientId}`;
  return !!c?.allow_raw;
}

/** SQL fragment over alias `a` — the single visibility rule for viewers. */
export function visibleAssets(v: Viewer, allowRaw: boolean) {
  const sql = getSql();
  const raw = v.kind === 'client' && allowRaw;
  return sql`a.status = 'ready' and a.replaced_by is null ${raw ? sql`` : sql`and a."group" <> 'raw'`}`;
}

export interface LibraryProject {
  id: string; title: string; shot_date: string | null; place: string | null; expires_at: string | null; published_at: string | null;
  photos: number; videos: number; bytes: number; cover: string | null; cover_hash: string | null;
}

export async function libraryFor(v: Viewer) {
  const sql = getSql();
  const allowRaw = await clientAllowsRaw(v.clientId);
  const [client] = await sql<{ name_ar: string; name_tr: string | null }[]>`select name_ar, name_tr from clients where id = ${v.clientId}`;
  const projects = await sql<LibraryProject[]>`
    select p.id, p.title, p.shot_date, p.place, p.expires_at, p.published_at,
      count(a.id) filter (where a.section = 'photos')::int as photos,
      count(a.id) filter (where a.section = 'videos')::int as videos,
      coalesce(sum(a.size), 0)::float8 as bytes,
      coalesce(p.cover_asset_id, (array_agg(a.id order by (a.section = 'photos') desc, a."group" = 'final' desc, a.sort_order) filter (where a.id is not null))[1]) as cover,
      null::text as cover_hash
    from projects p
    left join assets a on a.project_id = p.id and ${visibleAssets(v, allowRaw)}
    where p.client_id = ${v.clientId} and p.status = 'published' and p.archived_at is null
      and (p.expires_at is null or p.expires_at > now()) ${v.kind === 'guest' ? sql`and p.id = ${v.projectId}` : sql``}
    group by p.id
    order by coalesce(p.shot_date::timestamptz, p.published_at, p.created_at) desc`;
  const covers = projects.map((p) => p.cover).filter(Boolean) as string[];
  if (covers.length) {
    const hashes = await sql<{ id: string; thumbhash: string | null }[]>`select id, thumbhash from assets where id = any(${covers}::uuid[])`;
    for (const p of projects) p.cover_hash = hashes.find((h) => h.id === p.cover)?.thumbhash ?? null;
  }
  return { client: client!, projects, allowRaw };
}

export interface PortalAsset {
  id: string; original_name: string; section: Section; group: Group; width: number | null; height: number | null;
  size: number; duration: number | null; taken_at: string | null; thumbhash: string | null; renditions: Renditions;
  capture_source: 'phone' | 'camera' | null;
}

export async function projectFor(v: Viewer, projectId: string) {
  const sql = getSql();
  const allowRaw = await clientAllowsRaw(v.clientId);
  const [p] = await sql<{ id: string; title: string; shot_date: string | null; place: string | null; expires_at: string | null; client_name_ar: string; client_name_tr: string | null }[]>`
    select p.id, p.title, p.shot_date, p.place, p.expires_at, c.name_ar as client_name_ar, c.name_tr as client_name_tr
    from projects p join clients c on c.id = p.client_id
    where p.id = ${projectId} and p.client_id = ${v.clientId} and p.status = 'published' and p.archived_at is null
      and (p.expires_at is null or p.expires_at > now()) ${v.kind === 'guest' ? sql`and p.id = ${v.projectId}` : sql``}`;
  if (!p) return null;
  const [people, assets] = await Promise.all([
    sql<{ name: string }[]>`select u.name from project_members m join users u on u.id = m.user_id where m.project_id = ${projectId} order by u.name`,
    sql<PortalAsset[]>`
      select a.id, a.original_name, a.section, a."group", a.width, a.height, a.size::float8 as size, a.duration, a.taken_at, a.thumbhash, a.renditions, a.capture_source
      from assets a where a.project_id = ${projectId} and ${visibleAssets(v, allowRaw)}
      order by a.sort_order, a.taken_at nulls last, a.original_name`,
  ]);
  return { project: p, photographers: people.map((x) => x.name), assets, allowRaw };
}

/** One visible asset for this viewer (or null) — used by the viewer, the player and the downloads. */
export async function visibleAsset(v: Viewer, assetId: string) {
  const sql = getSql();
  const allowRaw = await clientAllowsRaw(v.clientId);
  const [a] = await sql<(PortalAsset & { project_id: string; r2_key: string; mime: string })[]>`
    select a.id, a.project_id, a.r2_key, a.mime, a.original_name, a.section, a."group", a.width, a.height, a.size::float8 as size, a.duration,
      a.taken_at, a.thumbhash, a.renditions, a.capture_source
    from assets a join projects p on p.id = a.project_id
    where a.id = ${assetId} and ${visibleAssets(v, allowRaw)}
      and p.client_id = ${v.clientId} and p.status = 'published' and p.archived_at is null
      and (p.expires_at is null or p.expires_at > now()) ${v.kind === 'guest' ? sql`and p.id = ${v.projectId}` : sql``}`;
  return a ?? null;
}

/** The best playable height as a label: 4K / 1440p / 1080p / 720p / 360p. */
export const qualityOf = (a: PortalAsset) => {
  const top = Math.max(0, ...(a.renditions.hls?.rungs ?? []), Math.min(a.width ?? 0, a.height ?? 0));
  return a.section !== 'videos' || !top ? null : top >= 2160 ? '4K' : top >= 1440 ? '1440p' : `${[1080, 720, 360].find((h) => top >= h) ?? top}p`;
};

/** What the browser needs per asset (no storage keys). */
export function toView(a: PortalAsset): ViewAsset {
  return {
    id: a.id, name: a.original_name, section: a.section, group: a.group, w: a.width ?? 0, h: a.height ?? 0, size: a.renditions.edited?.size ?? a.size,
    duration: a.duration, taken: a.taken_at, hash: a.thumbhash, widths: (a.renditions.images ?? []).map((i) => i.w),
    web: !!(a.section === 'photos' ? a.renditions.web : a.renditions.mp4_1080), quality: qualityOf(a),
  };
}

