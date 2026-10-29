import 'server-only';
import { getSql } from '@/db';
import type { Staff } from './auth/session';
import { decrypt, encrypt } from './crypto';
import { env } from './env';
import { accessToken, children, DRIVE_FOLDER, exchangeCode, googleConfigured, whoAmI } from './google';
import { suggest, type ClientName } from './import-suggest';
import { HttpError } from './server/http';

/*
 * The admin side of the Drive import (M6): one Google connection per admin, its refresh token stored
 * encrypted (AES-256-GCM, key from SESSION_SECRET), never sent to the browser. Files move server-side
 * only — the worker streams Drive → R2 (src/worker/drive.ts); nothing passes through the admin's browser.
 */

export const redirectUri = () => `${env.appOrigin}/api/admin/drive/callback`;

export async function connection(userId: string) {
  const [g] = await getSql()<{ email: string | null; updated_at: string }[]>`select email, updated_at from google_tokens where user_id = ${userId}`;
  return { configured: googleConfigured(), connected: !!g, email: g?.email ?? null };
}

export async function connect(userId: string, code: string) {
  const t = await exchangeCode(code, redirectUri());
  if (!t.refresh_token) throw new HttpError(400, 'no_refresh_token'); // consent was not offline
  const email = await whoAmI(t.access_token!).catch(() => null);
  await getSql()`insert into google_tokens (user_id, refresh_token_enc, email) values (${userId}, ${encrypt(t.refresh_token)}, ${email})
    on conflict (user_id) do update set refresh_token_enc = excluded.refresh_token_enc, email = excluded.email, updated_at = now()`;
  return email;
}

export async function disconnect(userId: string) {
  await getSql()`delete from google_tokens where user_id = ${userId}`;
}

export async function accessFor(userId: string) {
  const [g] = await getSql()<{ refresh_token_enc: string }[]>`select refresh_token_enc from google_tokens where user_id = ${userId}`;
  if (!g) throw new HttpError(409, 'drive_not_connected');
  return accessToken(decrypt(g.refresh_token_enc));
}

async function clientNames(): Promise<ClientName[]> {
  return getSql()<ClientName[]>`select id, name_ar, name_tr from clients where archived_at is null`;
}

/** One level of folders, each with its suggestion and whether it was imported before. */
export async function browse(staff: Staff, parent: string) {
  const access = await accessFor(staff.id);
  const [items, clients] = await Promise.all([children(access, parent, true), clientNames()]);
  const prior = items.length
    ? await getSql()<{ folder_id: string; status: string }[]>`select distinct on (folder_id) folder_id, status from drive_imports where folder_id = any(${items.map((i) => i.id)}) order by folder_id, created_at desc`
    : [];
  return items.filter((i) => i.mimeType === DRIVE_FOLDER).map((i) => ({
    id: i.id, name: i.name, suggestion: suggest(i.name, clients), imported: prior.find((p) => p.folder_id === i.id)?.status ?? null,
  }));
}

export interface ImportItem { folderId: string; folderName: string; clientId: string; projectId?: string; title?: string; shotDate?: string | null }

/** Create the projects that do not exist yet and queue one job per folder — all in one transaction. */
export async function startImports(staff: Staff, items: ImportItem[]) {
  await accessFor(staff.id); // fail now, not in the background, if the connection is gone
  return getSql().begin(async (tx) => {
    const ids: string[] = [];
    for (const it of items) {
      const [c] = await tx<{ id: string }[]>`select id from clients where id = ${it.clientId}`;
      if (!c) throw new HttpError(400, 'unknown_client');
      let projectId = it.projectId;
      if (projectId) {
        const [p] = await tx`select 1 from projects where id = ${projectId} and client_id = ${it.clientId}`;
        if (!p) throw new HttpError(400, 'project_not_of_client');
      } else {
        const [p] = await tx<{ id: string }[]>`insert into projects (client_id, title, shot_date, status, created_by)
          values (${it.clientId}, ${(it.title || it.folderName).slice(0, 200)}, ${it.shotDate ?? null}, 'review', ${staff.id}) returning id`;
        projectId = p!.id;
      }
      const [imp] = await tx<{ id: string }[]>`insert into drive_imports (created_by, folder_id, folder_name, client_id, project_id)
        values (${staff.id}, ${it.folderId}, ${it.folderName}, ${it.clientId}, ${projectId}) returning id`;
      await tx`select graphile_worker.add_job('drive_import', json_build_object('importId', ${imp!.id}::text), max_attempts := 2, job_key := ${`drive:${imp!.id}`})`;
      ids.push(imp!.id);
    }
    return ids;
  });
}

export interface ImportRow {
  id: string; folder_name: string; status: string; total: number; done: number; failed: number; error: string | null;
  created_at: string; finished_at: string | null; project_id: string | null; project_title: string | null; client_name: string | null;
  report: { file: string; ok: boolean; error?: string }[];
}

export async function recentImports(): Promise<ImportRow[]> {
  return getSql()<ImportRow[]>`
    select d.id, d.folder_name, d.status, d.total, d.done, d.failed, d.error, d.created_at, d.finished_at, d.project_id, d.report,
      p.title as project_title, c.name_ar as client_name
    from drive_imports d left join projects p on p.id = d.project_id left join clients c on c.id = d.client_id
    order by d.created_at desc limit 50`;
}
