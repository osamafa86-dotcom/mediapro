import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as WebStream } from 'node:stream/web';
import type { JobHelpers } from 'graphile-worker';
import { getSql } from '@/db';
import { decrypt } from '@/lib/crypto';
import { accessToken, download, GoogleError, isGoogleNative, walk } from '@/lib/google';
import { groupFromPath } from '@/lib/import-suggest';
import { classify, safeName } from '@/lib/upload-rules';
import { bucket, prefix, s3 } from './s3io';

/*
 * One Drive folder → one project (DESIGN §6.6). Files stream Drive → R2 (multipart, 16 MiB parts) and
 * never sit whole in memory or on disk. Each file then becomes an asset with its process_asset job, so
 * it goes through exactly what an upload goes through. A file that fails is reported and skipped; a
 * re-run skips what already arrived (assets.source_ref = drive:<fileId>).
 */

interface ImportRow { id: string; created_by: string | null; folder_id: string; project_id: string | null; status: string }
type Entry = { file: string; ok: boolean; error?: string };

export async function driveImport(payload: unknown, helpers: JobHelpers) {
  const { importId } = payload as { importId: string };
  const sql = getSql();
  const [imp] = await sql<ImportRow[]>`select id, created_by, folder_id, project_id, status from drive_imports where id = ${importId}`;
  if (!imp || imp.status === 'done' || !imp.project_id) return;
  const stop = async (error: string) => {
    await sql`update drive_imports set status = 'failed', error = ${error}, finished_at = now() where id = ${importId}`;
  };
  const [g] = imp.created_by ? await sql<{ refresh_token_enc: string }[]>`select refresh_token_enc from google_tokens where user_id = ${imp.created_by}` : [];
  if (!g) return stop('drive_not_connected');
  let access: string;
  try {
    access = await accessToken(decrypt(g.refresh_token_enc));
  } catch (e) {
    return stop(e instanceof GoogleError ? 'drive_reconnect' : 'drive_unavailable');
  }

  let files;
  try {
    files = await walk(access, imp.folder_id);
  } catch (e) {
    return stop(e instanceof GoogleError && e.status === 404 ? 'folder_not_found' : 'drive_unavailable');
  }
  await sql`update drive_imports set status = 'running', started_at = coalesce(started_at, now()), total = ${files.length}, error = null where id = ${importId}`;

  const report: Entry[] = [];
  let done = 0, failed = 0;
  const save = () => sql`update drive_imports set done = ${done}, failed = ${failed}, report = ${JSON.stringify(report)}::jsonb where id = ${importId}`;

  for (const f of files) {
    const label = [...f.path, f.name].join('/');
    const fail = async (error: string) => { failed++; report.push({ file: label, ok: false, error }); await save(); };
    if (isGoogleNative(f.mimeType)) { await fail('not_media'); continue; }
    const kind = classify(f.name);
    if (!kind) { await fail('unsupported_type'); continue; }
    // photos: RAW by their extension (a JPEG must stay «نهائي» even inside a RAW folder — the bytes decide later);
    // videos: anything under a RAW/footage folder is «رشزات»
    const group = kind.section === 'photos' ? kind.group : groupFromPath(f.path) ? 'footage' : 'final';
    const ref = `drive:${f.id}`;
    const [exists] = await sql`select 1 from assets where project_id = ${imp.project_id} and source_ref = ${ref}`;
    if (exists) { done++; report.push({ file: label, ok: true }); await save(); continue; }

    const key = `${prefix()}${imp.project_id}/${randomUUID()}/${safeName(f.name)}`;
    try {
      const res = await download(access, f.id);
      let bytes = 0;
      const body = Readable.fromWeb(res.body as unknown as WebStream<Uint8Array>);
      body.on('data', (c: Buffer) => { bytes += c.length; });
      await new Upload({
        client: s3(), partSize: 16 * 1024 * 1024, queueSize: 2, leavePartsOnError: false,
        params: { Bucket: bucket(), Key: key, Body: body, ContentType: f.mimeType || 'application/octet-stream' },
      }).done();
      await sql.begin(async (tx) => {
        const [a] = await tx<{ id: string }[]>`
          insert into assets (project_id, section, "group", r2_key, original_name, mime, size, uploaded_by, status, sort_order, source_ref)
          values (${imp.project_id}, ${kind.section}, ${group}, ${key}, ${f.name}, ${f.mimeType || 'application/octet-stream'}, ${bytes}, ${imp.created_by}, 'processing',
            (select coalesce(max(sort_order), 0) + 1 from assets where project_id = ${imp.project_id}), ${ref})
          on conflict (project_id, source_ref) do nothing
          returning id`;
        if (a) await tx`select graphile_worker.add_job('process_asset', json_build_object('assetId', ${a.id}::text), max_attempts := 3, job_key := ${`asset:${a.id}`})`;
      });
      done++;
      report.push({ file: label, ok: true });
      await save();
    } catch (e) {
      helpers.logger.error(`drive import ${importId}: ${label}: ${(e as Error).message}`);
      await fail(e instanceof GoogleError ? (e.status === 404 ? 'not_found' : 'drive_error') : 'copy_failed');
    }
  }
  await sql`update drive_imports set status = 'done', done = ${done}, failed = ${failed}, report = ${JSON.stringify(report)}::jsonb, finished_at = now() where id = ${importId}`;
}
