import 'server-only';
// Raw postgres.js queries take ISO strings for timestamps: drizzle replaces the shared client's Date serializer.
import { cookies } from 'next/headers';
import { getSql } from '@/db';
import { randomPin, randomToken, safeEqual, sha256 } from '../crypto';
import { endOfStudioDay, signLink, verifyLink, type LinkScope } from '../links';
import { cookieName, cookieOpts } from '../server/cookies';
import { HttpError, requireSameOrigin } from '../server/http';
import { hashSecret, verifySecret } from './password';
import { LOCK_MINUTES, MAX_FAILURES } from './throttle';

const VIEWER_MAX_DAYS = 30;

export async function issueLink(o: { clientId: string; projectId?: string | null; kind: LinkScope; days: number; createdBy: string }) {
  if (o.kind === 'guest' && !o.projectId) throw new HttpError(400, 'guest_needs_project');
  const sql = getSql();
  const jti = randomToken(16);
  const pin = randomPin();
  const expiresAt = endOfStudioDay(o.days);
  const [row] = await sql<{ id: string }[]>`
    insert into links (client_id, project_id, kind, jti, pin_hash, expires_at, created_by)
    values (${o.clientId}, ${o.projectId ?? null}, ${o.kind}, ${jti}, ${await hashSecret(pin)}, ${expiresAt.toISOString()}, ${o.createdBy})
    returning id`;
  const token = await signLink({ cid: o.clientId, scope: o.kind, pid: o.projectId ?? undefined, jti }, expiresAt);
  // The PIN is returned once, to the admin who created the link; only its hash is stored.
  return { id: row!.id, token, path: `/l/${token}`, pin, expiresAt };
}

export interface LinkRow {
  id: string; client_id: string; project_id: string | null; kind: LinkScope; pin_hash: string | null;
  expires_at: Date; revoked_at: Date | null; failed_attempts: number; locked_until: Date | null; created_by: string | null;
}

export type GateState =
  | { state: 'invalid' }
  | { state: 'expired'; link: LinkRow }
  | { state: 'locked'; link: LinkRow; until: Date }
  | { state: 'open'; link: LinkRow };

/** What the /l/<token> page should show. The DB row decides; the JWT only has to be authentic. */
export async function gateState(token: string): Promise<GateState> {
  const v = await verifyLink(token);
  if (!v.ok && v.reason === 'invalid') return { state: 'invalid' };
  const jti = v.ok ? v.claims.jti : v.jti;
  if (!jti) return { state: 'invalid' };
  const [link] = await getSql()<LinkRow[]>`select * from links where jti = ${jti}`;
  if (!link) return { state: 'invalid' };
  if (!v.ok || link.revoked_at || new Date(link.expires_at) <= new Date()) return { state: 'expired', link };
  if (link.locked_until && new Date(link.locked_until) > new Date()) return { state: 'locked', link, until: new Date(link.locked_until) };
  return { state: 'open', link };
}

export type PinResult =
  | { ok: true; next: string }
  | { ok: false; status: 401; remaining: number }
  | { ok: false; status: 423; until: Date }
  | { ok: false; status: 410 | 404 };

/**
 * One PIN attempt. The link row is locked FOR UPDATE for the whole check, so parallel guesses are
 * serialised: no more than 5 wrong PINs can ever be tried before the 10-minute lock, and a correct PIN
 * during the lock is still refused.
 */
export async function attemptPin(token: string, pin: string): Promise<PinResult> {
  const v = await verifyLink(token);
  if (!v.ok) return { ok: false, status: v.reason === 'expired' ? 410 : 404 };
  return getSql().begin(async (tx) => {
    const [link] = await tx<LinkRow[]>`select * from links where jti = ${v.claims.jti} for update`;
    if (!link || link.client_id !== v.claims.cid) return { ok: false, status: 404 } as const;
    if (link.revoked_at || new Date(link.expires_at) <= new Date()) return { ok: false, status: 410 } as const;
    if (link.locked_until && new Date(link.locked_until) > new Date()) return { ok: false, status: 423, until: new Date(link.locked_until) } as const;

    const good = /^\d{4}$/.test(pin) && (await verifySecret(link.pin_hash, pin));
    if (!good) {
      const failures = link.failed_attempts + 1;
      if (failures >= MAX_FAILURES) {
        const [r] = await tx<{ locked_until: Date }[]>`
          update links set failed_attempts = 0, locked_until = now() + make_interval(mins => ${LOCK_MINUTES})
          where id = ${link.id} returning locked_until`;
        await tx`insert into audit_log (actor_type, actor_id, action, target_type, target_id) values ('link', ${link.id}, 'link.pin_locked', 'link', ${link.id})`;
        return { ok: false, status: 423, until: new Date(r!.locked_until) } as const;
      }
      await tx`update links set failed_attempts = ${failures} where id = ${link.id}`;
      return { ok: false, status: 401, remaining: MAX_FAILURES - failures } as const;
    }

    await tx`update links set failed_attempts = 0, locked_until = null, opens = opens + 1, last_opened_at = now() where id = ${link.id}`;
    const vt = randomToken();
    const csrf = randomToken();
    const expiresAt = new Date(Math.min(new Date(link.expires_at).getTime(), Date.now() + VIEWER_MAX_DAYS * 86_400_000));
    await tx`insert into viewer_sessions (token_hash, link_id, csrf_token, expires_at) values (${sha256(vt)}, ${link.id}, ${csrf}, ${expiresAt.toISOString()})`;
    const jar = await cookies();
    jar.set(cookieName('viewer'), vt, cookieOpts(expiresAt));
    jar.set(cookieName('vcsrf'), csrf, cookieOpts(expiresAt, false));
    const next = link.kind === 'guest' || link.project_id ? `/p/${link.project_id}` : '/library';
    return { ok: true, next } as const;
  });
}

export interface Viewer { linkId: string; clientId: string; projectId: string | null; kind: LinkScope; csrf: string; linkExpiresAt: Date }

/** The client/guest behind the viewer cookie — only while its link is neither revoked nor expired. */
export async function getViewer(): Promise<Viewer | null> {
  const t = (await cookies()).get(cookieName('viewer'))?.value;
  if (!t) return null;
  const [r] = await getSql()<{ link_id: string; client_id: string; project_id: string | null; kind: LinkScope; csrf_token: string; expires_at: Date }[]>`
    select l.id as link_id, l.client_id, l.project_id, l.kind, v.csrf_token, l.expires_at
    from viewer_sessions v join links l on l.id = v.link_id
    where v.token_hash = ${sha256(t)} and v.expires_at > now() and l.revoked_at is null and l.expires_at > now()`;
  if (!r) return null;
  return { linkId: r.link_id, clientId: r.client_id, projectId: r.project_id, kind: r.kind, csrf: r.csrf_token, linkExpiresAt: new Date(r.expires_at) };
}

export async function requireViewer(req: Request): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new HttpError(401, 'unauthenticated');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requireSameOrigin(req);
    if (!safeEqual(req.headers.get('x-csrf-token') ?? '', v.csrf)) throw new HttpError(403, 'bad_csrf');
  }
  return v;
}
