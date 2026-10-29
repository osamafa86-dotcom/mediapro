import 'server-only';
import { getSql } from '@/db';
import type { Staff } from './auth/session';
import type { Viewer } from './auth/viewer';
import { env } from './env';
import { sendMail } from './mail';
import { visibleAsset } from './portal';
import { HttpError } from './server/http';
import { getSettings } from './settings';

/*
 * M7: favourites and notes. Rules (DESIGN «الإصدار الثاني» and «صندوق ملاحظات العملاء»):
 *   · favourites belong to the client organisation (any of its links), never to a guest; staff see the counts
 *   · notes are between the client, the photographer and the admin — never shown to, or written by, a guest
 *   · a photographer sees only the notes assigned to them (decided in the query, not hidden in the UI)
 *   · states: open → in_progress → resolved (resolved notes are dimmed, never deleted)
 */

function noGuest(v: Viewer) {
  if (v.kind === 'guest') throw new HttpError(403, 'guest_view_only');
}

// ── favourites ─────────────────────────────────────────────────────

export async function favouritesIn(v: Viewer, projectId: string): Promise<string[]> {
  if (v.kind === 'guest') return [];
  const rows = await getSql()<{ asset_id: string }[]>`
    select distinct f.asset_id from favourites f join links l on l.id = f.link_id join assets a on a.id = f.asset_id
    where l.client_id = ${v.clientId} and a.project_id = ${projectId}`;
  return rows.map((r) => r.asset_id);
}

export async function setFavourite(v: Viewer, assetId: string, on: boolean) {
  noGuest(v);
  if (!(await visibleAsset(v, assetId))) throw new HttpError(404, 'not_found');
  const sql = getSql();
  if (on) {
    const [has] = await sql`select 1 from favourites f join links l on l.id = f.link_id where f.asset_id = ${assetId} and l.client_id = ${v.clientId}`;
    if (!has) await sql`insert into favourites (link_id, asset_id) values (${v.linkId}, ${assetId}) on conflict do nothing`;
  } else {
    await sql`delete from favourites f using links l where l.id = f.link_id and f.asset_id = ${assetId} and l.client_id = ${v.clientId}`;
  }
  return { on };
}

/** Staff: how many client organisations marked each asset (a selection signal for the admin). */
export async function favouriteCounts(projectId: string): Promise<Record<string, number>> {
  const rows = await getSql()<{ asset_id: string; n: number }[]>`
    select f.asset_id, count(distinct l.client_id)::int as n from favourites f join links l on l.id = f.link_id join assets a on a.id = f.asset_id
    where a.project_id = ${projectId} group by f.asset_id`;
  return Object.fromEntries(rows.map((r) => [r.asset_id, r.n]));
}

// ── notes ──────────────────────────────────────────────────────────

export interface Note {
  id: string; n: number; author: string; body: string; anchor: 'pin' | 'time' | null; x: number | null; y: number | null; t: number | null;
  status: 'open' | 'in_progress' | 'resolved'; createdAt: string; fromClient: boolean;
  replies: { id: string; author: string; body: string; createdAt: string; fromClient: boolean }[];
}

async function thread(assetId: string): Promise<Note[]> {
  const rows = await getSql()<{ id: string; parent_id: string | null; author_name: string; body: string; anchor_type: 'pin' | 'time' | null; x: number | null; y: number | null;
    t_seconds: number | null; status: Note['status']; created_at: string; link_id: string | null }[]>`
    select id, parent_id, author_name, body, anchor_type, x, y, t_seconds, status, created_at, link_id from comments
    where asset_id = ${assetId} order by created_at, id`;
  const tops = rows.filter((r) => !r.parent_id);
  return tops.map((r, i) => ({
    id: r.id, n: i + 1, author: r.author_name, body: r.body, anchor: r.anchor_type, x: r.x, y: r.y, t: r.t_seconds, status: r.status,
    createdAt: r.created_at, fromClient: !!r.link_id,
    replies: rows.filter((x) => x.parent_id === r.id).map((x) => ({ id: x.id, author: x.author_name, body: x.body, createdAt: x.created_at, fromClient: !!x.link_id })),
  }));
}

export async function notesForViewer(v: Viewer, assetId: string) {
  noGuest(v);
  if (!(await visibleAsset(v, assetId))) throw new HttpError(404, 'not_found');
  return thread(assetId);
}

export interface NewNote { assetId: string; body: string; x?: number; y?: number; t?: number }

/** A client note; assigned to whoever uploaded the asset when that is a team member (the admin can change it). */
export async function addClientNote(v: Viewer, input: NewNote) {
  noGuest(v);
  const a = await visibleAsset(v, input.assetId);
  if (!a) throw new HttpError(404, 'not_found');
  const sql = getSql();
  const anchor = input.x != null && input.y != null ? 'pin' : input.t != null ? 'time' : null;
  if (anchor === 'pin' && a.section !== 'photos') throw new HttpError(400, 'pin_on_photo_only');
  if (anchor === 'time' && a.section !== 'videos') throw new HttpError(400, 'time_on_video_only');
  const [c] = await sql<{ contact_name: string | null; name_ar: string }[]>`select contact_name, name_ar from clients where id = ${v.clientId}`;
  const author = c?.contact_name || c?.name_ar || '—';
  const [up] = await sql<{ id: string; email: string | null; role: string }[]>`
    select u.id, u.email, u.role from assets a join users u on u.id = a.uploaded_by where a.id = ${a.id} and u.disabled_at is null`;
  const [row] = await sql<{ id: string }[]>`
    insert into comments (asset_id, link_id, author_name, body, anchor_type, x, y, t_seconds, assignee_id)
    values (${a.id}, ${v.linkId}, ${author}, ${input.body}, ${anchor}, ${anchor === 'pin' ? input.x! : null}, ${anchor === 'pin' ? input.y! : null},
      ${anchor === 'time' ? input.t! : null}, ${up && up.role !== 'admin' ? up.id : null})
    returning id`;
  void mailNewNote(a.project_id, a.original_name, author, input.body, up && up.role !== 'admin' ? up.email : null);
  return { id: row!.id };
}

async function mailNewNote(projectId: string, file: string, author: string, body: string, assigneeEmail: string | null) {
  try {
    const sql = getSql();
    const [p] = await sql<{ title: string }[]>`select title from projects where id = ${projectId}`;
    const url = `${env.appOrigin}/admin/notes`;
    const to = new Set<string>();
    if ((await getSettings()).notifications.onComment) {
      for (const a of await sql<{ email: string }[]>`select email from users where role = 'admin' and disabled_at is null and email is not null`) to.add(a.email);
    }
    if (assigneeEmail) to.add(assigneeEmail);
    for (const email of to) await sendMail({ to: email, subject: `ملاحظة جديدة: ${p?.title ?? ''} · ${file}`, text: `${author}: ${body}\n\n${url}` });
  } catch (e) {
    console.warn('[notes] mail', e instanceof Error ? e.message : e);
  }
}

// ── the staff side ─────────────────────────────────────────────────

const scope = (staff: Staff) => {
  const sql = getSql();
  return staff.role === 'admin' ? sql`true` : sql`c.assignee_id = ${staff.id}`;
};

export interface InboxItem {
  id: string; asset_id: string; project_id: string; project_title: string; client_name: string; file: string; section: 'photos' | 'videos';
  author: string; body: string; anchor: 'pin' | 'time' | null; x: number | null; y: number | null; t: number | null; status: Note['status'];
  created_at: string; assignee_id: string | null; assignee_name: string | null; replaced: boolean; thumbhash: string | null; has_thumb: boolean;
}

export async function inbox(staff: Staff, f: { state: 'open' | 'resolved'; assignee?: string }) {
  const sql = getSql();
  const open = f.state === 'open';
  const items = await sql<InboxItem[]>`
    select c.id, c.asset_id, p.id as project_id, p.title as project_title, cl.name_ar as client_name, a.original_name as file, a.section,
      c.author_name as author, c.body, c.anchor_type as anchor, c.x, c.y, c.t_seconds as t, c.status, c.created_at, c.assignee_id,
      u.name as assignee_name, a.replaced_by is not null as replaced, a.thumbhash, (a.renditions ? 'images') as has_thumb
    from comments c join assets a on a.id = c.asset_id join projects p on p.id = a.project_id join clients cl on cl.id = p.client_id
    left join users u on u.id = c.assignee_id
    where c.parent_id is null and ${scope(staff)}
      and ${open ? sql`c.status <> 'resolved'` : sql`c.status = 'resolved'`}
      ${f.assignee && staff.role === 'admin' ? sql`and c.assignee_id = ${f.assignee}` : sql``}
    order by p.title, c.created_at
    limit 500`;
  const [counts] = await sql<{ open: number; resolved: number }[]>`
    select count(*) filter (where c.status <> 'resolved')::int as open, count(*) filter (where c.status = 'resolved')::int as resolved
    from comments c where c.parent_id is null and ${scope(staff)}`;
  return { items, counts: counts! };
}

export async function openNotesCount(staff: Staff) {
  const [r] = await getSql()<{ n: number }[]>`select count(*)::int as n from comments c where c.parent_id is null and c.status <> 'resolved' and ${scope(staff)}`;
  return r!.n;
}

async function staffNote(staff: Staff, id: string) {
  const sql = getSql();
  const [c] = await sql<{ id: string; asset_id: string; project_id: string; status: string; assignee_id: string | null; link_id: string | null; parent_id: string | null }[]>`
    select c.id, c.asset_id, a.project_id, c.status, c.assignee_id, c.link_id, c.parent_id from comments c join assets a on a.id = c.asset_id where c.id = ${id}`;
  if (!c || c.parent_id) throw new HttpError(404, 'not_found');
  if (staff.role !== 'admin' && c.assignee_id !== staff.id) throw new HttpError(404, 'not_found');
  return c;
}

export async function noteThreadForStaff(staff: Staff, id: string) {
  const c = await staffNote(staff, id);
  return thread(c.asset_id);
}

/** A reply from the team: the note moves to «قيد التنفيذ», and the client gets it by mail too. */
export async function staffReply(staff: Staff, id: string, body: string) {
  const c = await staffNote(staff, id);
  const sql = getSql();
  await sql`insert into comments (asset_id, user_id, author_name, body, parent_id, status) values (${c.asset_id}, ${staff.id}, ${staff.name}, ${body}, ${id}, 'open')`;
  if (c.status === 'open') await sql`update comments set status = 'in_progress' where id = ${id}`;
  try {
    const [to] = await sql<{ email: string | null; title: string; file: string }[]>`
      select cl.contact_email as email, p.title, a.original_name as file from assets a join projects p on p.id = a.project_id join clients cl on cl.id = p.client_id
      where a.id = ${c.asset_id}`;
    if (to?.email) await sendMail({ to: to.email, subject: `رد على ملاحظتكم: ${to.title} · ${to.file}`, text: `${staff.name}: ${body}` });
  } catch (e) {
    console.warn('[notes] mail', e instanceof Error ? e.message : e);
  }
}

export async function updateNote(staff: Staff, id: string, patch: { status?: Note['status']; assigneeId?: string | null }) {
  const c = await staffNote(staff, id);
  const sql = getSql();
  if (patch.assigneeId !== undefined) {
    if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
    if (patch.assigneeId) {
      // an admin, or a team member of this very project — anyone else could not open the asset
      const [u] = await sql`select 1 from users u where u.id = ${patch.assigneeId} and u.disabled_at is null
        and (u.role = 'admin' or exists (select 1 from project_members m where m.project_id = ${c.project_id} and m.user_id = u.id))`;
      if (!u) throw new HttpError(400, 'not_a_member');
    }
    await sql`update comments set assignee_id = ${patch.assigneeId} where id = ${id}`;
  }
  if (patch.status) {
    await sql`update comments set status = ${patch.status}, resolved_at = ${patch.status === 'resolved' ? new Date().toISOString() : null} where id = ${id}`;
  }
}
