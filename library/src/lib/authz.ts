import 'server-only';
import { getSql } from '@/db';
import type { Staff } from './auth/session';
import type { Viewer } from './auth/viewer';

/*
 * Server-side authorization — the only place that decides who sees what (PROMPT §5 M1).
 *   admin         → everything
 *   photographer  → only projects they are a member of; never client links
 *   client link   → its client's published, unexpired projects
 *   guest link    → its one project, view only, never a signed asset URL
 */

export interface ProjectRow { id: string; client_id: string; title: string; status: string; shot_date: string | null; expires_at: Date | null; published_at: Date | null }

export async function staffCanAccessProject(staff: Staff, projectId: string): Promise<boolean> {
  const sql = getSql();
  if (!isUuid(projectId)) return false;
  if (staff.role === 'admin') return (await sql`select 1 from projects where id = ${projectId}`).length > 0;
  return (await sql`select 1 from project_members where project_id = ${projectId} and user_id = ${staff.id}`).length > 0;
}

export async function listProjectsForStaff(staff: Staff): Promise<ProjectRow[]> {
  const sql = getSql();
  return staff.role === 'admin'
    ? sql<ProjectRow[]>`select id, client_id, title, status, shot_date, expires_at, published_at from projects order by created_at desc`
    : sql<ProjectRow[]>`select p.id, p.client_id, p.title, p.status, p.shot_date, p.expires_at, p.published_at
        from projects p join project_members m on m.project_id = p.id and m.user_id = ${staff.id} order by p.created_at desc`;
}

/** Same predicate, written once in SQL, for both "can see one" and "list". */
function viewerWhere(v: Viewer) {
  const sql = getSql();
  return sql`p.client_id = ${v.clientId} and p.status = 'published' and (p.expires_at is null or p.expires_at > now())
    ${v.kind === 'guest' ? sql`and p.id = ${v.projectId}` : sql``}`;
}

export async function viewerCanSeeProject(v: Viewer, projectId: string): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const sql = getSql();
  return (await sql`select 1 from projects p where p.id = ${projectId} and ${viewerWhere(v)}`).length > 0;
}

export async function listProjectsForViewer(v: Viewer): Promise<ProjectRow[]> {
  const sql = getSql();
  return sql<ProjectRow[]>`select p.id, p.client_id, p.title, p.status, p.shot_date, p.expires_at, p.published_at
    from projects p where ${viewerWhere(v)} order by coalesce(p.published_at, p.created_at) desc`;
}

export interface AssetRow { id: string; project_id: string; r2_key: string; original_name: string; group: string; status: string }

export async function getAsset(id: string): Promise<AssetRow | null> {
  if (!isUuid(id)) return null;
  const [a] = await getSql()<AssetRow[]>`select id, project_id, r2_key, original_name, "group", status from assets where id = ${id}`;
  return a ?? null;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
