import 'server-only';
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand,
  HeadObjectCommand, ListPartsCommand, UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSql } from '@/db';
import type { Staff } from './auth/session';
import { staffCanAccessProject } from './authz';
import { audit } from './server/audit';
import { HttpError } from './server/http';
import { can } from './settings';
import { bucket, s3 } from './storage';
import { classify, MAX_FILE_BYTES, partCount, partSizeFor, safeName } from './upload-rules';

/*
 * Direct-to-R2 multipart uploads. The server opens every multipart upload itself and hands the
 * browser its (key, uploadId); afterwards it signs only four operations — UploadPart, ListParts,
 * Complete, Abort — and only for a (key, uploadId) pair belonging to an active upload of the caller.
 * It never signs a PutObject, a DeleteObject or a new CreateMultipartUpload for the browser.
 */

export const OpenInput = z.object({
  projectId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  mime: z.string().max(120).default('application/octet-stream'),
  fingerprint: z.string().min(8).max(300),
  group: z.enum(['final', 'footage']).default('final'),
  lastModified: z.number().int().optional(),
  /** «رفع نسخة معدّلة»: this file replaces that asset when it completes (same project, same section) */
  replaces: z.string().uuid().optional(),
  /** an album of the project («مونتاج», …); absent/null = the main «الصور»/«الفيديو» */
  albumId: z.string().uuid().nullish(),
});

interface UploadRow {
  id: string; project_id: string; user_id: string; s3_upload_id: string; key: string; filename: string; size: string;
  mime: string; section: 'photos' | 'videos'; group: 'final' | 'raw' | 'footage'; status: string; part_size: number; asset_id: string | null;
  replaces_asset_id: string | null; album_id: string | null;
}

async function mayUpload(staff: Staff, projectId: string) {
  if (!(await staffCanAccessProject(staff, projectId))) throw new HttpError(404, 'not_found');
  if (!(await can(staff.role, 'upload'))) throw new HttpError(403, 'forbidden');
  const [p] = await getSql()<{ status: string; archived_at: string | null }[]>`select status, archived_at from projects where id = ${projectId}`;
  if (p?.archived_at) throw new HttpError(409, 'project_archived');
}

const view = (r: UploadRow) => ({
  id: r.id, key: r.key, uploadId: r.s3_upload_id, partSize: r.part_size, section: r.section, group: r.group, size: Number(r.size), filename: r.filename,
});

/** Opens (or, for the same file by the same person, re-opens) an upload. Re-opening is how a closed tab resumes. */
export async function openUpload(staff: Staff, input: z.infer<typeof OpenInput>) {
  await mayUpload(staff, input.projectId);
  let c = classify(input.filename, input.group);
  if (!c) throw new HttpError(415, 'unsupported_type');
  const sql = getSql();
  let albumId = input.albumId ?? null;
  if (albumId && !(await sql`select 1 from project_albums where id = ${albumId} and project_id = ${input.projectId}`).length) {
    throw new HttpError(404, 'album_not_found');
  }
  if (input.replaces) {
    // a revised version lands in the old one's place: same project, same section, same group, same album
    const [old] = await sql<{ section: 'photos' | 'videos'; group: 'final' | 'raw' | 'footage'; replaced_by: string | null; album_id: string | null }[]>`
      select section, "group", replaced_by, album_id from assets where id = ${input.replaces} and project_id = ${input.projectId}`;
    if (!old) throw new HttpError(404, 'not_found');
    albumId = old.album_id;
    if (old.replaced_by) throw new HttpError(409, 'already_replaced');
    if (old.section !== c.section) throw new HttpError(415, 'section_mismatch');
    c = { ...c, group: c.raw ? 'raw' : old.group === 'raw' ? 'final' : old.group };
  }
  const [existing] = await sql<UploadRow[]>`select * from uploads where user_id = ${staff.id} and project_id = ${input.projectId}
    and fingerprint = ${input.fingerprint} and size = ${input.size} and status = 'active' order by created_at desc limit 1`;
  if (existing) return { ...view(existing), resumed: true };

  const prefix = (process.env.S3_PREFIX ?? 'media-library/').replace(/^\/+/, '');
  const key = `${prefix}${input.projectId}/${randomUUID()}/${safeName(input.filename)}`;
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(input.mime) ? input.mime : 'application/octet-stream';
  const created = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: mime }));
  if (!created.UploadId) throw new HttpError(502, 'storage_unavailable');
  const [row] = await sql<UploadRow[]>`
    insert into uploads (project_id, user_id, s3_upload_id, key, filename, size, mime, fingerprint, section, "group", part_size, replaces_asset_id, album_id)
    values (${input.projectId}, ${staff.id}, ${created.UploadId}, ${key}, ${input.filename}, ${input.size}, ${mime}, ${input.fingerprint},
      ${c.section}, ${c.group}, ${partSizeFor(input.size)}, ${input.replaces ?? null}, ${albumId})
    returning *`;
  await sql`update projects set status = 'uploading', updated_at = now() where id = ${input.projectId} and status = 'draft'`;
  return { ...view(row!), resumed: false };
}

export const SignInput = z.object({
  method: z.enum(['PUT', 'GET', 'POST', 'DELETE']),
  key: z.string().min(1).max(1024),
  uploadId: z.string().min(1).max(1024).optional(),
  partNumber: z.number().int().min(1).max(10_000).optional(),
});

/** Presigned URL for one of the four allowed operations on the caller's own active upload. */
export async function signRequest(staff: Staff, r: z.infer<typeof SignInput>): Promise<{ url: string }> {
  if (!r.uploadId) throw new HttpError(403, 'operation_not_allowed'); // no PutObject / DeleteObject / CreateMultipartUpload
  const [row] = await getSql()<UploadRow[]>`select * from uploads where key = ${r.key} and s3_upload_id = ${r.uploadId}
    and user_id = ${staff.id} and status = 'active'`;
  if (!row) throw new HttpError(403, 'not_your_upload');
  const base = { Bucket: bucket(), Key: row.key, UploadId: row.s3_upload_id };
  const ttl = { expiresIn: 15 * 60 };
  let url: string;
  if (r.method === 'PUT') {
    if (!r.partNumber || r.partNumber > partCount(Number(row.size))) throw new HttpError(400, 'bad_part_number');
    url = await getSignedUrl(s3(), new UploadPartCommand({ ...base, PartNumber: r.partNumber }), ttl);
  } else if (r.method === 'GET') url = await getSignedUrl(s3(), new ListPartsCommand(base), ttl);
  else if (r.method === 'POST') url = await getSignedUrl(s3(), new CompleteMultipartUploadCommand(base), ttl);
  else url = await getSignedUrl(s3(), new AbortMultipartUploadCommand(base), ttl);
  return { url };
}

/**
 * After the browser completed the multipart upload: the object's real size must equal the declared
 * size, or the object is deleted and the upload fails. Only then does it become an asset.
 */
export async function finishUpload(staff: Staff, id: string) {
  const sql = getSql();
  const [row] = await sql<UploadRow[]>`select * from uploads where id = ${id} and user_id = ${staff.id}`;
  if (!row) throw new HttpError(404, 'not_found');
  if (row.status === 'completed') return { assetId: row.asset_id };
  if (row.status !== 'active') throw new HttpError(409, 'upload_not_active');
  let length: number | undefined;
  try {
    length = (await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: row.key }))).ContentLength;
  } catch {
    throw new HttpError(409, 'not_completed');
  }
  if (length !== Number(row.size)) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: row.key })).catch(() => {});
    await sql`update uploads set status = 'aborted', error = ${`size_mismatch:${length}`} where id = ${id}`;
    await audit('user', staff.id, 'upload.size_mismatch', { type: 'upload', id }, { expected: Number(row.size), got: length ?? null });
    throw new HttpError(409, 'size_mismatch', { expected: Number(row.size), got: length ?? null });
  }
  return sql.begin(async (tx) => {
    const [a] = await tx<{ id: string }[]>`
      insert into assets (project_id, section, "group", r2_key, original_name, mime, size, uploaded_by, status, sort_order, album_id)
      values (${row.project_id}, ${row.section}, ${row.group}, ${row.key}, ${row.filename}, ${row.mime}, ${row.size}, ${staff.id}, 'processing',
        (select coalesce(max(sort_order), 0) + 1 from assets where project_id = ${row.project_id}),
        (select id from project_albums where id = ${row.album_id}))
      returning id`;
    await tx`update uploads set status = 'completed', completed_at = now(), asset_id = ${a!.id} where id = ${id}`;
    if (row.replaces_asset_id) {
      // the revised version takes the old one's place for the client; the old one stays in the record,
      // and its open notes close with a line saying why (DESIGN: «هذا هو المسار الطبيعي لإغلاق ملاحظة»)
      await tx`update assets set sort_order = o.sort_order, tags = o.tags, album_id = o.album_id from assets o where assets.id = ${a!.id} and o.id = ${row.replaces_asset_id}`;
      await tx`update assets set replaced_by = ${a!.id} where id = ${row.replaces_asset_id} and replaced_by is null`;
      const open = await tx<{ id: string }[]>`update comments set status = 'resolved', resolved_at = now()
        where asset_id = ${row.replaces_asset_id} and parent_id is null and status <> 'resolved' returning id`;
      for (const c of open) {
        await tx`insert into comments (asset_id, user_id, author_name, body, parent_id, status)
          values (${row.replaces_asset_id}, ${staff.id}, ${staff.name}, ${`replaced:${a!.id}`}, ${c.id}, 'resolved')`;
      }
    }
    // processing job in the same transaction: an asset can never exist without its job
    await tx`select graphile_worker.add_job('process_asset', json_build_object('assetId', ${a!.id}::text), max_attempts := 3, job_key := ${`asset:${a!.id}`})`;
    return { assetId: a!.id };
  });
}

export async function abortUpload(staff: Staff, id: string) {
  const sql = getSql();
  const [row] = await sql<UploadRow[]>`select * from uploads where id = ${id} and user_id = ${staff.id} and status = 'active'`;
  if (!row) throw new HttpError(404, 'not_found');
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: row.key, UploadId: row.s3_upload_id })).catch(() => {});
  await sql`update uploads set status = 'aborted' where id = ${id}`;
}

/** Uploads this person left unfinished in a project — shown so they can re-add the file and resume. */
export async function unfinished(staff: Staff, projectId: string) {
  return getSql()<{ id: string; filename: string; size: string; created_at: string }[]>`
    select id, filename, size, created_at from uploads where user_id = ${staff.id} and project_id = ${projectId} and status = 'active' order by created_at`;
}

/**
 * «جاهز للمراجعة». Refused while uploads are still open. With «publish without review» the project
 * goes straight to the client; otherwise it waits for the admin.
 */
export async function markReady(staff: Staff, projectId: string) {
  if (!(await staffCanAccessProject(staff, projectId))) throw new HttpError(404, 'not_found');
  const sql = getSql();
  const [open] = await sql<{ n: number }[]>`select count(*)::int as n from uploads where project_id = ${projectId} and status = 'active'`;
  if (open!.n > 0) throw new HttpError(409, 'uploads_pending', { pending: open!.n });
  const [has] = await sql<{ n: number }[]>`select count(*)::int as n from assets where project_id = ${projectId}`;
  if (has!.n === 0) throw new HttpError(409, 'nothing_uploaded');
  const direct = staff.role !== 'admin' && (await can(staff.role, 'publishWithoutReview'));
  const [p] = await sql<{ status: string }[]>`update projects set
      status = ${direct ? 'published' : 'review'}, published_at = ${direct ? sql`coalesce(published_at, now())` : sql`published_at`}, updated_at = now()
    where id = ${projectId} and status in ('draft', 'uploading', 'review') returning status`;
  if (!p) throw new HttpError(409, 'wrong_status');
  await audit('user', staff.id, direct ? 'project.published' : 'project.review', { type: 'project', id: projectId });
  return { status: p.status };
}
