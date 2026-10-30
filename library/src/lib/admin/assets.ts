import 'server-only';
import { z } from 'zod';
import { getSql } from '@/db';
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
export const OrderInput = z.object({ section: z.enum(['photos', 'videos']), ids });
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
    select id from assets where project_id = ${projectId} and section = ${input.section} and replaced_by is null`;
  const known = new Set(live.map((r) => r.id));
  // the whole section, once each: a stale page (an upload or a delete since) must reload rather than half-apply
  if (input.ids.length !== known.size || new Set(input.ids).size !== input.ids.length || input.ids.some((x) => !known.has(x))) {
    throw new HttpError(409, 'stale_order');
  }
  await sql`
    update assets a set sort_order = o.n
    from unnest(${input.ids}::uuid[]) with ordinality as o(id, n)
    where a.id = o.id and a.project_id = ${projectId}`;
  await audit('user', staff.id, 'assets.reordered', { type: 'project', id: projectId }, { section: input.section, n: input.ids.length });
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
