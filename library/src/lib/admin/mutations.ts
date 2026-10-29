import 'server-only';
import { z } from 'zod';
import { getSql } from '@/db';
import { hashSecret, passwordProblem } from '../auth/password';
import { randomToken, sha256 } from '../crypto';
import { env } from '../env';
import { endOfStudioDay } from '../links';
import { sendMail } from '../mail';
import { audit } from '../server/audit';
import { HttpError } from '../server/http';
import { can, getSettings } from '../settings';
import type { Staff } from '../auth/session';
import { staffCanAccessProject } from '../authz';

/* Every write of the admin panel, with its authorization. Route handlers only parse and call these. */

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);

// ── projects ─────────────────────────────────────────────────────
export const ProjectInput = z.object({
  title: text(200).min(2),
  clientId: uuid.nullish(),
  type: text(60).nullish(),
  shotDate: day.nullish(),
  place: text(120).nullish(),
  memberIds: z.array(uuid).max(20).optional(),
});

/** Projects a team member creates go to «بانتظار التصنيف» — they never pick from (and so never see) the client list. */
async function inboxClient(): Promise<string> {
  const sql = getSql();
  const [s] = await sql<{ value: string }[]>`select value #>> '{}' as value from settings where key = 'inbox_client_id'`;
  if (s && (await sql`select 1 from clients where id = ${s.value}`).length) return s.value;
  const [c] = await sql<{ id: string }[]>`insert into clients (name_ar, name_tr) values ('بانتظار التصنيف', 'Sınıflandırma bekliyor') returning id`;
  await sql`insert into settings (key, value) values ('inbox_client_id', ${JSON.stringify(c!.id)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return c!.id;
}

export async function createProject(staff: Staff, input: z.infer<typeof ProjectInput>) {
  if (!(await can(staff.role, 'createProject'))) throw new HttpError(403, 'forbidden');
  const sql = getSql();
  const clientId = staff.role === 'admin' ? input.clientId : await inboxClient();
  if (!clientId) throw new HttpError(400, 'client_required');
  if (staff.role === 'admin' && !(await sql`select 1 from clients where id = ${clientId} and archived_at is null`).length) throw new HttpError(400, 'client_not_found');
  return sql.begin(async (tx) => {
    const [p] = await tx<{ id: string }[]>`insert into projects (client_id, title, type, shot_date, place, created_by)
      values (${clientId}, ${input.title}, ${input.type ?? null}, ${input.shotDate ?? null}, ${input.place ?? null}, ${staff.id}) returning id`;
    const members = staff.role === 'admin' ? (input.memberIds ?? []) : [staff.id];
    for (const m of members) await tx`insert into project_members (project_id, user_id) select ${p!.id}, id from users where id = ${m} and role <> 'admin' on conflict do nothing`;
    await tx`insert into audit_log (actor_type, actor_id, action, target_type, target_id) values ('user', ${staff.id}, 'project.created', 'project', ${p!.id})`;
    return p!.id;
  });
}

export async function updateProject(staff: Staff, id: string, input: Partial<z.infer<typeof ProjectInput>>) {
  if (!(await staffCanAccessProject(staff, id))) throw new HttpError(404, 'not_found');
  const sql = getSql();
  const [cur] = await sql<{ client_id: string }[]>`select client_id from projects where id = ${id}`;
  const clientId = staff.role === 'admin' && input.clientId ? input.clientId : cur!.client_id;
  if (clientId !== cur!.client_id && !(await sql`select 1 from clients where id = ${clientId}`).length) throw new HttpError(400, 'client_not_found');
  await sql`update projects set
    title = coalesce(${input.title ?? null}, title), client_id = ${clientId},
    type = ${input.type === undefined ? sql`type` : input.type}, shot_date = ${input.shotDate === undefined ? sql`shot_date` : input.shotDate},
    place = ${input.place === undefined ? sql`place` : input.place}, updated_at = now()
    where id = ${id}`;
  if (staff.role === 'admin' && input.memberIds) {
    await sql.begin(async (tx) => {
      await tx`delete from project_members where project_id = ${id}`;
      for (const m of input.memberIds!) await tx`insert into project_members (project_id, user_id) select ${id}, id from users where id = ${m} and role <> 'admin' on conflict do nothing`;
    });
  }
  await audit('user', staff.id, 'project.updated', { type: 'project', id });
}

export const BulkInput = z.object({
  ids: z.array(uuid).min(1).max(500),
  action: z.enum(['publish', 'extend', 'archive', 'unarchive']),
  days: z.number().int().min(1).max(730).optional(),
});

/** Admin only. Returns how many projects actually changed (drafts with no media are not published). */
export async function bulkProjects(staff: Staff, b: z.infer<typeof BulkInput>): Promise<number> {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const sql = getSql();
  let rows: { id: string }[] = [];
  if (b.action === 'publish') {
    rows = await sql`update projects p set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
      where id = any(${b.ids}) and status in ('review', 'uploading', 'draft', 'expired')
        and exists (select 1 from assets a where a.project_id = p.id and a.status = 'ready') returning id`;
  } else if (b.action === 'extend') {
    if (!b.days) throw new HttpError(400, 'days_required');
    const tz = (await getSettings()).region.timeZone;
    rows = await sql`update projects set expires_at = ${endOfStudioDay(b.days, new Date(), tz).toISOString()},
      status = case when status = 'expired' then 'published'::project_status else status end, updated_at = now()
      where id = any(${b.ids}) returning id`;
  } else {
    rows = await sql`update projects set archived_at = ${b.action === 'archive' ? sql`now()` : null}, updated_at = now() where id = any(${b.ids}) returning id`;
  }
  for (const r of rows) await audit('user', staff.id, `project.${b.action === 'publish' ? 'published' : b.action}`, { type: 'project', id: r.id });
  return rows.length;
}

// ── clients ──────────────────────────────────────────────────────
export const ClientInput = z.object({
  nameAr: text(160).min(2),
  nameTr: text(160).nullish(),
  kind: z.enum(['partner', 'beneficiary']),
  contactName: text(120).nullish(),
  contactPhone: z.string().trim().regex(/^[+\d\s()-]{6,24}$/).nullish().or(z.literal('')),
  contactEmail: z.string().trim().toLowerCase().email().max(254).nullish().or(z.literal('')),
  locale: z.enum(['ar', 'tr']),
  defaultLinkDays: z.number().int().min(1).max(365),
  allowRaw: z.boolean(),
  expiryReminder: z.boolean(),
});

const blank = (v: string | null | undefined) => (v ? v : null);

export async function saveClient(staff: Staff, id: string | null, c: z.infer<typeof ClientInput>) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const sql = getSql();
  const vals = {
    name_ar: c.nameAr, name_tr: blank(c.nameTr), kind: c.kind, contact_name: blank(c.contactName), contact_phone: blank(c.contactPhone),
    contact_email: blank(c.contactEmail), locale: c.locale, default_link_days: c.defaultLinkDays, allow_raw: c.allowRaw, expiry_reminder: c.expiryReminder,
  };
  if (id) {
    const r = await sql`update clients set ${sql(vals)} where id = ${id} returning id`;
    if (!r.length) throw new HttpError(404, 'not_found');
    await audit('user', staff.id, 'client.updated', { type: 'client', id });
    return id;
  }
  const [r] = await sql<{ id: string }[]>`insert into clients ${sql(vals)} returning id`;
  await audit('user', staff.id, 'client.created', { type: 'client', id: r!.id });
  return r!.id;
}

export async function archiveClient(staff: Staff, id: string, archived: boolean) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const r = await getSql()`update clients set archived_at = ${archived ? getSql()`now()` : null} where id = ${id} returning id`;
  if (!r.length) throw new HttpError(404, 'not_found');
  await audit('user', staff.id, archived ? 'client.archived' : 'client.restored', { type: 'client', id });
}

// ── team ─────────────────────────────────────────────────────────
export const InviteInput = z.object({
  name: text(120).min(2),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['photographer', 'editor', 'contributor']),
  title: text(80).nullish(),
  /** chosen by the admin and handed over by them: no mail is sent. Absent → the emailed invite link, as before. */
  password: z.string().max(256).optional(),
});

/** 400 with the reason, so the form can say it (12+ characters). */
function checkPassword(p: string) {
  const problem = passwordProblem(p);
  if (problem) throw new HttpError(400, problem);
}

async function sendInvite(userId: string, email: string, locale: 'ar' | 'tr', inviter: string) {
  const token = randomToken();
  await getSql()`insert into magic_links (token_hash, user_id, expires_at, purpose) values (${sha256(token)}, ${userId}, ${new Date(Date.now() + 7 * 86_400_000).toISOString()}, 'invite')`;
  const url = `${env.appOrigin}/auth/magic?token=${token}`;
  await sendMail(locale === 'ar'
    ? { to: email, subject: 'دعوة إلى مكتبة المرئيات', text: `دعاك ${inviter} إلى مكتبة المرئيات في إمداترا.\nافتح الرابط خلال 7 أيام للدخول:\n${url}` }
    : { to: email, subject: 'Medya Kütüphanesine davet', text: `${inviter} sizi EMDATRA Medya Kütüphanesine davet etti.\nGiriş için bağlantıyı 7 gün içinde açın:\n${url}` });
}

export async function invite(staff: Staff, i: z.infer<typeof InviteInput>) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const sql = getSql();
  if ((await sql`select 1 from users where lower(email) = ${i.email}`).length) throw new HttpError(409, 'email_taken');
  if (i.password !== undefined) checkPassword(i.password);
  const hash = i.password === undefined ? null : await hashSecret(i.password);
  const [u] = await sql<{ id: string }[]>`insert into users (name, email, role, title, locale, password_hash)
    values (${i.name}, ${i.email}, ${i.role}, ${blank(i.title)}, ${staff.locale}, ${hash}) returning id`;
  if (hash) {
    await audit('user', staff.id, 'team.created_with_password', { type: 'user', id: u!.id });
  } else {
    await sendInvite(u!.id, i.email, staff.locale, staff.name);
    await audit('user', staff.id, 'team.invited', { type: 'user', id: u!.id });
  }
  return u!.id;
}

export const PasswordInput = z.object({ password: z.string().max(256) });

/**
 * The admin sets a member's password (a new member who lost it, or a handover). The member is signed out
 * everywhere, and a lock from wrong attempts on this email is lifted, so the new password works at once.
 * Accounts that sign in through the parent site (SSO) have no local password: 409.
 */
export async function setMemberPassword(staff: Staff, id: string, password: string) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  checkPassword(password);
  const sql = getSql();
  const [u] = await sql<{ email: string | null; auth_provider: 'local' | 'emdatra' }[]>`
    select email, auth_provider from users where id = ${id} and role <> 'admin'`;
  if (!u) throw new HttpError(404, 'not_found');
  if (u.auth_provider !== 'local') throw new HttpError(409, 'sso_account');
  await sql`update users set password_hash = ${await hashSecret(password)} where id = ${id}`;
  await sql`delete from sessions where user_id = ${id}`;
  if (u.email) {
    // both lock keys of the login route: `login:<email>` and `login-ip:<ip>:<email>` (matched by suffix: an email may hold `_`)
    const e = u.email.toLowerCase();
    await sql`delete from login_throttle where key = ${`login:${e}`} or (key like 'login-ip:%' and right(key, ${e.length + 1}) = ${`:${e}`})`;
  }
  await audit('user', staff.id, 'team.password_set', { type: 'user', id });
}

export async function resendInvite(staff: Staff, id: string) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const [u] = await getSql()<{ email: string | null; locale: 'ar' | 'tr' }[]>`select email, locale from users where id = ${id} and role <> 'admin' and last_login_at is null and disabled_at is null`;
  if (!u?.email) throw new HttpError(404, 'not_found');
  await sendInvite(id, u.email, u.locale, staff.name);
  await audit('user', staff.id, 'team.invite_resent', { type: 'user', id });
}

export const MemberInput = z.object({
  role: z.enum(['photographer', 'editor', 'contributor']).optional(),
  title: text(80).nullish(),
  disabled: z.boolean().optional(),
});

export async function updateMember(staff: Staff, id: string, m: z.infer<typeof MemberInput>) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const sql = getSql();
  const r = await sql`update users set
      role = coalesce(${m.role ?? null}::role, role),
      title = ${m.title === undefined ? sql`title` : blank(m.title)},
      disabled_at = ${m.disabled === undefined ? sql`disabled_at` : m.disabled ? sql`coalesce(disabled_at, now())` : null}
    where id = ${id} and role <> 'admin' returning id`;
  if (!r.length) throw new HttpError(404, 'not_found');
  // a suspended member is signed out at once
  if (m.disabled) await sql`delete from sessions where user_id = ${id}`;
  await audit('user', staff.id, m.disabled === true ? 'team.suspended' : m.disabled === false ? 'team.reactivated' : 'team.updated', { type: 'user', id });
}

// ── links ────────────────────────────────────────────────────────
export async function revokeLink(staff: Staff, id: string) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const r = await getSql()`update links set revoked_at = coalesce(revoked_at, now()) where id = ${id} returning id`;
  if (!r.length) throw new HttpError(404, 'not_found');
  await getSql()`delete from viewer_sessions where link_id = ${id}`;
  await audit('user', staff.id, 'link.revoked', { type: 'link', id });
}

export async function sendLinkMail(staff: Staff, id: string) {
  if (staff.role !== 'admin') throw new HttpError(403, 'forbidden');
  const [l] = await getSql()<{ code: string; email: string | null; locale: 'ar' | 'tr'; name_ar: string; name_tr: string | null; expires_at: string; title: string | null }[]>`
    select l.code, c.contact_email as email, c.locale, c.name_ar, c.name_tr, l.expires_at, p.title
    from links l join clients c on c.id = l.client_id left join projects p on p.id = l.project_id
    where l.id = ${id} and l.revoked_at is null`;
  if (!l) throw new HttpError(404, 'not_found');
  if (!l.email) throw new HttpError(400, 'client_has_no_email');
  const url = `${env.appOrigin}/c/${l.code}`;
  const { formatDay } = await import('../format');
  const until = formatDay(l.expires_at, l.locale);
  // The PIN never travels with the link (DESIGN.md): this mail carries the URL only.
  await sendMail(l.locale === 'ar'
    ? { to: l.email, subject: l.title ? `موادكم جاهزة: ${l.title}` : 'مكتبتكم في إمداترا', text: `السلام عليكم،\n\nموادكم جاهزة للمشاهدة والتنزيل:\n${url}\n\nيصلكم رمز الدخول في رسالة منفصلة. الرابط صالح حتى ${until}.\n\nإمداترا` }
    : { to: l.email, subject: l.title ? `Dosyalarınız hazır: ${l.title}` : 'EMDATRA kütüphaneniz', text: `Merhaba,\n\nDosyalarınız görüntülemeye ve indirmeye hazır:\n${url}\n\nGiriş kodu ayrı bir mesajla gelecek. Bağlantı ${until} tarihine kadar geçerli.\n\nEMDATRA` });
  await audit('user', staff.id, 'link.sent', { type: 'link', id });
}
