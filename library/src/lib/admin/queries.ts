import 'server-only';
import type { PendingQuery, Row } from 'postgres';
import { getSql } from '@/db';
import type { Staff } from '../auth/session';
import { normalizeSearch } from '../format';

/* Read models for the admin panel. Team roles (photographer/editor/contributor) only ever see member projects. */

type Frag = PendingQuery<Row[]>;

/** SQL twin of normalizeSearch() in lib/format.ts — keep them identical. */
export function normSql(col: Frag): Frag {
  const sql = getSql();
  return sql`regexp_replace(translate(lower(${col}), 'أإآٱىةı', 'اااايهi'), '[ـً-ْٰ̇]', '', 'g')`;
}

function scope(staff: Staff): Frag {
  const sql = getSql();
  return staff.role === 'admin' ? sql`true` : sql`exists (select 1 from project_members m where m.project_id = p.id and m.user_id = ${staff.id})`;
}

export const STATUSES = ['draft', 'uploading', 'review', 'published', 'expired'] as const;
export const PERIODS = ['3m', '6m', '12m'] as const;

export interface ArchiveFilters {
  q?: string; client?: string; photographer?: string; type?: string; media?: 'photos' | 'videos';
  status?: (typeof STATUSES)[number]; period?: (typeof PERIODS)[number]; tag?: string;
  archived?: boolean; sort?: 'date_desc' | 'date_asc'; page?: number;
}

export const PAGE_SIZE = 50;

export interface ArchiveRow {
  id: string; title: string; status: string; type: string | null; shot_date: string | null; place: string | null;
  client_id: string; client_name_ar: string; client_name_tr: string | null; photographers: string[] | null;
  photos: number; videos: number; bytes: string; archived_at: string | null; expires_at: string | null;
  link_expires_at: string | null; link_opens: number | null; downloads: number; uploads_total: number; uploads_done: number;
}

export async function archive(staff: Staff, f: ArchiveFilters) {
  const sql = getSql();
  const conds: Frag[] = [scope(staff), f.archived ? sql`p.archived_at is not null` : sql`p.archived_at is null`];
  if (f.q) {
    const like = `%${normalizeSearch(f.q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`(${normSql(sql`p.title`)} like ${like} or ${normSql(sql`coalesce(p.place, '')`)} like ${like}
      or ${normSql(sql`c.name_ar`)} like ${like} or ${normSql(sql`coalesce(c.name_tr, '')`)} like ${like}
      or exists (select 1 from assets a where a.project_id = p.id and ${like} like any (select '%' || ${normSql(sql`t`)} || '%' from unnest(a.tags) t)))`);
  }
  if (f.client) conds.push(sql`p.client_id = ${f.client}`);
  if (f.photographer) conds.push(sql`exists (select 1 from project_members m where m.project_id = p.id and m.user_id = ${f.photographer})`);
  if (f.type) conds.push(sql`p.type = ${f.type}`);
  if (f.media) conds.push(sql`exists (select 1 from assets a where a.project_id = p.id and a.section = ${f.media})`);
  if (f.status) conds.push(sql`p.status = ${f.status}`);
  if (f.tag) conds.push(sql`exists (select 1 from assets a where a.project_id = p.id and ${f.tag} = any(a.tags))`);
  if (f.period) {
    const months = { '3m': 3, '6m': 6, '12m': 12 }[f.period];
    conds.push(sql`coalesce(p.shot_date, p.created_at::date) >= (now() - make_interval(months => ${months}))::date`);
  }
  const where = conds.reduce((a, b) => sql`${a} and ${b}`);
  const order = f.sort === 'date_asc' ? sql`coalesce(p.shot_date, p.created_at::date) asc, p.created_at asc` : sql`coalesce(p.shot_date, p.created_at::date) desc, p.created_at desc`;
  const page = Math.max(1, f.page ?? 1);

  const [rows, [totals], [all]] = await Promise.all([
    sql<ArchiveRow[]>`
      select p.id, p.title, p.status, p.type, p.shot_date, p.place, p.client_id, p.archived_at, p.expires_at,
        c.name_ar as client_name_ar, c.name_tr as client_name_tr,
        (select array_agg(u.name order by u.name) from project_members m join users u on u.id = m.user_id where m.project_id = p.id) as photographers,
        coalesce(s.photos, 0)::int as photos, coalesce(s.videos, 0)::int as videos, coalesce(s.bytes, 0)::text as bytes,
        l.expires_at as link_expires_at, l.opens as link_opens,
        (select count(*) from downloads d where d.project_id = p.id)::int as downloads,
        coalesce(u.total, 0)::int as uploads_total, coalesce(u.done, 0)::int as uploads_done
      from projects p
      join clients c on c.id = p.client_id
      left join lateral (select count(*) filter (where a.section = 'photos') photos, count(*) filter (where a.section = 'videos') videos,
        sum(a.size) bytes from assets a where a.project_id = p.id and a.replaced_by is null) s on true
      left join lateral (select expires_at, opens from links where (project_id = p.id or (project_id is null and client_id = p.client_id))
        and revoked_at is null order by created_at desc limit 1) l on true
      left join lateral (select count(*) total, count(*) filter (where status = 'completed') done from uploads where project_id = p.id) u on true
      where ${where}
      order by ${order}
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    sql<{ n: number; bytes: string }[]>`
      select count(*)::int as n, coalesce(sum((select coalesce(sum(a.size), 0) from assets a where a.project_id = p.id and a.replaced_by is null)), 0)::text as bytes
      from projects p join clients c on c.id = p.client_id where ${where}`,
    sql<{ n: number }[]>`select count(*)::int as n from projects p where ${scope(staff)} and p.archived_at is null`,
  ]);
  return { rows, total: totals!.n, bytes: Number(totals!.bytes), all: all!.n, page, pages: Math.max(1, Math.ceil(totals!.n / PAGE_SIZE)) };
}

/** Values for the filter chips. Team roles get only what their own projects use — never other clients. */
export async function archiveFacets(staff: Staff) {
  const sql = getSql();
  const sc = scope(staff);
  const [clients, people, types, tags] = await Promise.all([
    sql<{ id: string; name_ar: string; name_tr: string | null }[]>`select distinct c.id, c.name_ar, c.name_tr from clients c join projects p on p.client_id = c.id where ${sc} order by c.name_ar`,
    staff.role === 'admin'
      ? sql<{ id: string; name: string }[]>`select id, name from users where role <> 'admin' order by name`
      : sql<{ id: string; name: string }[]>`select id, name from users where id = ${staff.id}`,
    sql<{ type: string }[]>`select distinct p.type from projects p where ${sc} and p.type is not null order by 1`,
    sql<{ tag: string }[]>`select distinct t as tag from projects p join assets a on a.project_id = p.id, unnest(a.tags) t where ${sc} order by 1 limit 200`,
  ]);
  return { clients, people, types: types.map((r) => r.type), tags: tags.map((r) => r.tag) };
}

export async function navCounts(staff: Staff) {
  const sql = getSql();
  const [r] = await sql<{ projects: number; clients: number; team: number; imports: number }[]>`
    select (select count(*) from projects p where ${scope(staff)} and p.archived_at is null)::int as projects,
      (select count(*) from clients where archived_at is null)::int as clients,
      (select count(*) from users where role <> 'admin' and disabled_at is null)::int as team,
      (select count(*) from drive_imports where status in ('queued', 'running'))::int as imports`;
  return r!;
}

export async function dashboard(staff: Staff) {
  const sql = getSql();
  const sc = scope(staff);
  const [[stats], review, uploads, activity] = await Promise.all([
    sql<{ review: number; oldest_review: string | null; uploading: number; links30: number; links30_downloaded: number; bytes: string; bytes_month: string }[]>`
      select
        (select count(*) from projects p where ${sc} and p.status = 'review' and p.archived_at is null)::int as review,
        (select min(p.updated_at) from projects p where ${sc} and p.status = 'review' and p.archived_at is null) as oldest_review,
        (select count(*) from projects p where ${sc} and p.status = 'uploading' and p.archived_at is null)::int as uploading,
        (select count(*) from links where created_at > now() - interval '30 days')::int as links30,
        (select count(distinct l.id) from links l join downloads d on d.link_id = l.id where l.created_at > now() - interval '30 days')::int as links30_downloaded,
        (select coalesce(sum(a.size), 0) from assets a join projects p on p.id = a.project_id where ${sc})::text as bytes,
        (select coalesce(sum(a.size), 0) from assets a join projects p on p.id = a.project_id where ${sc} and a.created_at >= date_trunc('month', now()))::text as bytes_month`,
    sql<{ id: string; title: string; photographers: string[] | null; photos: number; videos: number; since: string }[]>`
      select p.id, p.title, p.updated_at as since,
        (select array_agg(u.name order by u.name) from project_members m join users u on u.id = m.user_id where m.project_id = p.id) as photographers,
        (select count(*) from assets a where a.project_id = p.id and a.section = 'photos')::int as photos,
        (select count(*) from assets a where a.project_id = p.id and a.section = 'videos')::int as videos
      from projects p where ${sc} and p.status = 'review' and p.archived_at is null order by p.updated_at asc limit 5`,
    sql<{ id: string; title: string; total: number; done: number; bytes_total: string; bytes_done: string }[]>`
      select p.id, p.title, count(*)::int as total, count(*) filter (where u.status = 'completed')::int as done,
        sum(u.size)::text as bytes_total, coalesce(sum(u.size) filter (where u.status = 'completed'), 0)::text as bytes_done
      from uploads u join projects p on p.id = u.project_id
      where ${sc} and u.status <> 'aborted' and p.status = 'uploading'
      group by p.id, p.title having count(*) filter (where u.status = 'active') > 0 order by max(u.created_at) desc limit 3`,
    staff.role === 'admin'
      ? sql<{ action: string; at: string; data: Record<string, unknown> | null; actor: string | null; target_type: string | null; target_id: string | null; project: string | null; client: string | null }[]>`
        select a.action, a.at, a.data, u.name as actor, a.target_type, a.target_id,
          coalesce(p.title, lp.title) as project, coalesce(c.name_ar, lc.name_ar) as client
        from audit_log a
        left join users u on a.actor_type = 'user' and u.id::text = a.actor_id
        left join projects p on a.target_type = 'project' and p.id::text = a.target_id
        left join clients c on c.id = p.client_id
        left join links l on a.target_type = 'link' and l.id::text = a.target_id
        left join projects lp on lp.id = l.project_id
        left join clients lc on lc.id = l.client_id
        where a.action in ('project.created', 'project.review', 'project.published', 'link.created', 'link.opened', 'link.pin_locked', 'link.renewal_requested', 'client.created', 'team.invited')
        order by a.at desc limit 6`
      : Promise.resolve([]),
  ]);
  return { stats: { ...stats!, bytes: Number(stats!.bytes), bytes_month: Number(stats!.bytes_month) }, review, uploads, activity };
}
