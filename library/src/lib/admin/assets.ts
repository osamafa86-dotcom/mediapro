import 'server-only';
import { z } from 'zod';
import { getSql } from '@/db';
import type { AssetEdit } from '@/db/schema';
import type { Staff } from '../auth/session';
import { isUuid, staffCanAccessProject } from '../authz';
import { audit } from '../server/audit';
import { HttpError } from '../server/http';

/*
 * Managing a project's media from the admin panel: order, cover, delete.
 * Order and cover: the admin, and the project's members. Delete: the admin; a member only what they uploaded,
 * and only before the project is published (after that the client may already hold a link to it).
 */

const ids = z.array(z.string().refine(isUuid)).min(1).max(2000);
/** One list to order: a main section (`albumId` absent or null), or an album (every file in it, photos and videos). */
export const OrderInput = z.object({ section: z.enum(['photos', 'videos']), albumId: z.string().refine(isUuid).nullish(), ids });
export const CoverInput = z.object({ assetId: z.string().refine(isUuid).nullable() });
export const DeleteInput = z.object({ ids: ids.max(500) });

async function requireProject(staff: Staff, projectId: string) {
  if (!isUuid(projectId) || !(await staffCanAccessProject(staff, projectId))) throw new HttpError(404, 'not_found');
}

/** The new order of one section, as the full list of its ids: sort_order becomes 1..n. Any id that is not in it: 409. */
export async function reorder(staff: Staff, projectId: string, input: z.infer<typeof OrderInput>) {
  await requireProject(staff, projectId);
  const sql = getSql();
  const live = await sql<{ id: string }[]>`
    select id from assets where project_id = ${projectId} and replaced_by is null
      and ${input.albumId ? sql`album_id = ${input.albumId}` : sql`section = ${input.section} and album_id is null`}`;
  const known = new Set(live.map((r) => r.id));
  // the whole section, once each: a stale page (an upload or a delete since) must reload rather than half-apply
  if (input.ids.length !== known.size || new Set(input.ids).size !== input.ids.length || input.ids.some((x) => !known.has(x))) {
    throw new HttpError(409, 'stale_order');
  }
  await sql`
    update assets a set sort_order = o.n
    from unnest(${input.ids}::uuid[]) with ordinality as o(id, n)
    where a.id = o.id and a.project_id = ${projectId}`;
  await audit('user', staff.id, 'assets.reordered', { type: 'project', id: projectId }, { section: input.section, albumId: input.albumId ?? null, n: input.ids.length });
}

/** The project's cover (the card in the client's library); null = back to the automatic choice. */
export async function setCover(staff: Staff, projectId: string, assetId: string | null) {
  await requireProject(staff, projectId);
  const sql = getSql();
  if (assetId) {
    const [a] = await sql`select 1 from assets where id = ${assetId} and project_id = ${projectId} and section = 'photos' and status = 'ready' and replaced_by is null`;
    if (!a) throw new HttpError(400, 'not_a_photo');
  }
  await sql`update projects set cover_asset_id = ${assetId}, updated_at = now() where id = ${projectId}`;
  await audit('user', staff.id, 'project.cover_set', { type: 'project', id: projectId }, { assetId });
}

/**
 * Deletes the rows at once and hands the storage to the worker (`purge_objects`): the original key and the asset's
 * renditions folder, now and once more an hour later — a processing run already under way may still be writing.
 * Client notes and favourites go with it (cascade; the confirmation says so); the download history keeps its rows
 * (asset_id → null); an older version this one replaced returns.
 */
export async function deleteAssets(staff: Staff, input: z.infer<typeof DeleteInput>) {
  const sql = getSql();
  const rows = await sql<{ id: string; project_id: string; r2_key: string; uploaded_by: string | null; status: string }[]>`
    select a.id, a.project_id, a.r2_key, a.uploaded_by, p.status
    from assets a join projects p on p.id = a.project_id where a.id = any(${input.ids}::uuid[])`;
  if (rows.length !== new Set(input.ids).size) throw new HttpError(404, 'not_found');
  for (const r of rows) {
    if (!(await staffCanAccessProject(staff, r.project_id))) throw new HttpError(404, 'not_found');
    if (staff.role !== 'admin' && (r.uploaded_by !== staff.id || r.status === 'published')) throw new HttpError(403, 'forbidden');
  }
  const prefix = (process.env.S3_PREFIX ?? 'media-library/').replace(/^\/+/, '');
  await sql.begin(async (tx) => {
    const del = rows.map((r) => r.id);
    await tx`update projects set cover_asset_id = null where cover_asset_id = any(${del}::uuid[])`;
    await tx`update assets set replaced_by = null where replaced_by = any(${del}::uuid[])`;
    await tx`delete from assets where id = any(${del}::uuid[])`;
    for (const r of rows) {
      // a processing job not yet started has nothing left to do
      await tx`select graphile_worker.remove_job(${`asset:${r.id}`})`;
      const payload = { keys: [r.r2_key], prefixes: [`${prefix}renditions/${r.id}/`] };
      await tx`select graphile_worker.add_job('purge_objects', ${JSON.stringify(payload)}::json, max_attempts := 5, job_key := ${`purge:${r.id}`})`;
      await tx`select graphile_worker.add_job('purge_objects', ${JSON.stringify(payload)}::json, run_at := now() + interval '1 hour', max_attempts := 5, job_key := ${`purge-late:${r.id}`})`;
    }
  });
  for (const r of rows) await audit('user', staff.id, 'asset.deleted', { type: 'asset', id: r.id }, { projectId: r.project_id });
  return { deleted: rows.length };
}

const unit = z.number().min(0).max(1);
export const EditInput = z.union([
  z.object({
    rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    crop: z.object({ x: unit, y: unit, w: unit.min(0.01), h: unit.min(0.01) })
      .refine((c) => c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, 'crop_outside').nullable(),
  }),
  z.object({ reset: z.literal(true) }),
]);

/**
 * Saves a photo's edit (or its reset to the original) and queues `apply_edit`. Photos only, finished and not RAW
 * (a RAW download is the camera file itself); the admin and the project's members, like the order. The original
 * upload is never touched: a reset just renders it again.
 */
export async function setEdit(staff: Staff, assetId: string, input: z.infer<typeof EditInput>) {
  const sql = getSql();
  const [a] = await sql<{ project_id: string; section: string; group: string; status: string; edit: AssetEdit | null }[]>`
    select project_id, section, "group", status, edit from assets where id = ${assetId} and replaced_by is null`;
  if (!a || !(await staffCanAccessProject(staff, a.project_id))) throw new HttpError(404, 'not_found');
  if (a.section !== 'photos' || a.group === 'raw' || a.status !== 'ready') throw new HttpError(400, 'not_editable');
  const reset = 'reset' in input;
  if (reset && !a.edit) return { v: 0 }; // never edited: nothing to undo
  const v = (a.edit?.v ?? 0) + 1;
  const edit: AssetEdit = { v, rotate: reset ? 0 : input.rotate, crop: reset ? null : input.crop, state: 'pending' };
  await sql.begin(async (tx) => {
    await tx`update assets set edit = ${JSON.stringify(edit)}::jsonb where id = ${assetId}`;
    await tx`select graphile_worker.add_job('apply_edit', ${JSON.stringify({ assetId, v })}::json, max_attempts := 3,
      job_key := ${`edit:${assetId}`}, job_key_mode := 'replace')`;
  });
  await audit('user', staff.id, reset ? 'asset.edit_reset' : 'asset.edited', { type: 'asset', id: assetId }, { v, rotate: edit.rotate, crop: edit.crop });
  return { v };
}

/**
 * Deletes whole projects, for good (the admin only): the rows at once — media, albums, notes, favourites and the
 * project's own links go with them (cascade); the download history and Drive imports keep their rows (→ null) —
 * and the storage through `purge_objects`: every original under `<prefix><projectId>/` and each asset's renditions,
 * now and once more an hour later, like a single delete.
 */
export async function deleteProjects(staff: Staff, ids: string[]) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const sql = getSql();
  const prefix = (process.env.S3_PREFIX ?? 'media-library/').replace(/^\/+/, '');
  const projects = await sql<{ id: string; title: string }[]>`select id, title from projects where id = any(${ids}::uuid[])`;
  const done: { id: string; title: string; assets: number }[] = [];
  for (const p of projects) {
    await sql.begin(async (tx) => {
      const assets = await tx<{ id: string }[]>`select id from assets where project_id = ${p.id}`;
      for (const a of assets) {
        await tx`select graphile_worker.remove_job(${`asset:${a.id}`})`;
        await tx`select graphile_worker.remove_job(${`edit:${a.id}`})`;
      }
      await tx`delete from projects where id = ${p.id}`;
      const payload = { keys: [], prefixes: [`${prefix}${p.id}/`, ...assets.map((a) => `${prefix}renditions/${a.id}/`)] };
      await tx`select graphile_worker.add_job('purge_objects', ${JSON.stringify(payload)}::json, max_attempts := 5, job_key := ${`purge-project:${p.id}`})`;
      await tx`select graphile_worker.add_job('purge_objects', ${JSON.stringify(payload)}::json, run_at := now() + interval '1 hour', max_attempts := 5, job_key := ${`purge-project-late:${p.id}`})`;
      done.push({ ...p, assets: assets.length });
    });
  }
  for (const p of done) await audit('user', staff.id, 'project.deleted', { type: 'project', id: p.id }, { title: p.title, assets: p.assets });
  return done.length;
}

// ── albums ───────────────────────────────────────────────────────
export const AlbumInput = z.object({ name: z.string().trim().min(1).max(60) });
export const MoveInput = z.object({ ids: ids.max(2000), albumId: z.string().refine(isUuid).nullable() });

async function albumOf(staff: Staff, albumId: string) {
  if (!isUuid(albumId)) throw new HttpError(404, 'not_found');
  const [a] = await getSql()<{ id: string; project_id: string; name: string; created_by: string | null }[]>`
    select id, project_id, name, created_by from project_albums where id = ${albumId}`;
  if (!a || !(await staffCanAccessProject(staff, a.project_id))) throw new HttpError(404, 'not_found');
  return a;
}

/** A new album at the end of the project's list: the admin and the project's members (whoever can work on it). */
export async function createAlbum(staff: Staff, projectId: string, name: string) {
  await requireProject(staff, projectId);
  const sql = getSql();
  const [dup] = await sql`select 1 from project_albums where project_id = ${projectId} and lower(name) = lower(${name})`;
  if (dup) throw new HttpError(409, 'album_exists');
  const [a] = await sql<{ id: string }[]>`
    insert into project_albums (project_id, name, sort_order, created_by)
    values (${projectId}, ${name}, coalesce((select max(sort_order) + 1 from project_albums where project_id = ${projectId}), 1), ${staff.id})
    returning id`;
  await audit('user', staff.id, 'album.created', { type: 'project', id: projectId }, { albumId: a!.id, name });
  return a!.id;
}

export async function renameAlbum(staff: Staff, albumId: string, name: string) {
  const a = await albumOf(staff, albumId);
  const sql = getSql();
  const [dup] = await sql`select 1 from project_albums where project_id = ${a.project_id} and id <> ${albumId} and lower(name) = lower(${name})`;
  if (dup) throw new HttpError(409, 'album_exists');
  await sql`update project_albums set name = ${name} where id = ${albumId}`;
  await audit('user', staff.id, 'album.renamed', { type: 'project', id: a.project_id }, { albumId, from: a.name, to: name });
}

/** The album goes; its files return to «الصور»/«الفيديو» (never deleted with it). The admin, or whoever made it. */
export async function deleteAlbum(staff: Staff, albumId: string) {
  const a = await albumOf(staff, albumId);
  if (staff.role !== 'admin' && a.created_by !== staff.id) throw new HttpError(403, 'forbidden');
  const sql = getSql();
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select count(*)::int as n from assets where album_id = ${albumId}`;
  await sql`delete from project_albums where id = ${albumId}`;
  await audit('user', staff.id, 'album.deleted', { type: 'project', id: a.project_id }, { albumId, name: a.name, returned: n });
  return { returned: n };
}

/** Moves files of one project into an album, or back to the main sections (null); they go to the end of it. */
export async function moveToAlbum(staff: Staff, input: z.infer<typeof MoveInput>) {
  const sql = getSql();
  const rows = await sql<{ project_id: string }[]>`select distinct project_id from assets where id = any(${input.ids}::uuid[])`;
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select count(*)::int as n from assets where id = any(${input.ids}::uuid[])`;
  if (rows.length !== 1 || n !== new Set(input.ids).size) throw new HttpError(404, 'not_found');
  const projectId = rows[0]!.project_id;
  await requireProject(staff, projectId);
  if (input.albumId) {
    const [al] = await sql`select 1 from project_albums where id = ${input.albumId} and project_id = ${projectId}`;
    if (!al) throw new HttpError(404, 'album_not_found');
  }
  await sql`
    update assets a set album_id = ${input.albumId},
      sort_order = coalesce((select max(b.sort_order) from assets b where b.project_id = ${projectId}
        and b.album_id is not distinct from ${input.albumId}::uuid and b.id <> all(${input.ids}::uuid[])), 0) + o.n
    from unnest(${input.ids}::uuid[]) with ordinality as o(id, n)
    where a.id = o.id`;
  await audit('user', staff.id, 'assets.moved', { type: 'project', id: projectId }, { albumId: input.albumId, n: input.ids.length });
  return { moved: input.ids.length };
}
