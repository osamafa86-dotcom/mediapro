import 'server-only';
import { getSql } from '@/db';
import { createSession } from './auth/session';
import { audit } from './server/audit';
import { HttpError } from './server/http';
import { ssoVerify, type SsoClaims } from './sso-sign';

/*
 * The library side of phase 2: a valid link from the parent site opens a library session — no second
 * password, no copied user list. The parent site is the source of truth for the person's name, email and
 * role, so they are refreshed at every sign-in (a demotion there is a demotion here). Off until
 * EMDATRA_SSO_ENABLED=true and a 32+ character EMDATRA_SSO_SECRET are set on both sides.
 */

export function ssoConfig() {
  const secret = process.env.EMDATRA_SSO_SECRET ?? '';
  return { enabled: process.env.EMDATRA_SSO_ENABLED === 'true' && secret.length >= 32, secret };
}

export async function ssoSignIn(req: Request) {
  const query = new URL(req.url).searchParams;
  const cfg = ssoConfig();
  if (!cfg.enabled) throw new HttpError(404, 'not_found');
  const v = ssoVerify(query, cfg.secret);
  if (!v.ok) throw new HttpError(v.reason === 'expired' ? 410 : 403, `sso_${v.reason}`);
  const c = v.claims;
  const sql = getSql();
  // single use: the nonce is spent in the same statement that checks it; old ones are swept
  await sql`delete from sso_nonces where expires_at < now()`;
  const spent = await sql`insert into sso_nonces (nonce, expires_at) values (${c.nonce}, ${new Date((c.exp + 60) * 1000).toISOString()})
    on conflict (nonce) do nothing returning nonce`;
  if (!spent.length) throw new HttpError(403, 'sso_replayed');
  const user = await upsertUser(c);
  await createSession(user.id, req);
  await audit('user', user.id, 'auth.sso', { type: 'user', id: user.id }, { external: c.u });
  return user;
}

async function upsertUser(c: SsoClaims) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [byExt] = await tx<{ id: string; disabled_at: string | null; role: string }[]>`
      select id, disabled_at, role from users where auth_provider = 'emdatra' and external_id = ${c.u}`;
    let id = byExt?.id;
    if (byExt?.disabled_at) throw new HttpError(403, 'disabled');
    if (!id) {
      // a local account with the same email is linked once — only if it is not already someone else's
      const [byEmail] = await tx<{ id: string; disabled_at: string | null; external_id: string | null }[]>`
        select id, disabled_at, external_id from users where lower(email) = ${c.e}`;
      if (byEmail?.disabled_at) throw new HttpError(403, 'disabled');
      if (byEmail && byEmail.external_id && byEmail.external_id !== c.u) throw new HttpError(409, 'email_taken');
      if (byEmail) {
        id = byEmail.id;
        await tx`update users set auth_provider = 'emdatra', external_id = ${c.u} where id = ${id}`;
      } else {
        const [n] = await tx<{ id: string }[]>`insert into users (name, email, role, auth_provider, external_id)
          values (${c.n}, ${c.e}, ${c.r}, 'emdatra', ${c.u}) returning id`;
        id = n!.id;
      }
    }
    const [u] = await tx<{ id: string; role: string }[]>`update users set name = ${c.n}, email = ${c.e}, role = ${c.r} where id = ${id} returning id, role`;
    return u!;
  });
}
