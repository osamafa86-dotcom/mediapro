import { jwtVerify, SignJWT } from 'jose';
import { env } from './env';

/*
 * Client and guest links. The URL carries an HS256 JWT {cid, scope, pid?, jti, exp}; the jti points
 * to a `links` row, which is the source of truth (revocation, PIN, lock, real expiry). A valid
 * signature alone never opens anything.
 */

export type LinkScope = 'client' | 'guest';
export interface LinkClaims { cid: string; scope: LinkScope; pid?: string; jti: string; exp: number }

const ISS = 'emdatra-media';
const AUD = 'link';
const key = () => new TextEncoder().encode(env.linkSecret);

export async function signLink(c: Omit<LinkClaims, 'exp'>, expiresAt: Date): Promise<string> {
  const payload: Record<string, string> = { cid: c.cid, scope: c.scope };
  if (c.pid) payload.pid = c.pid;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISS).setAudience(AUD).setJti(c.jti).setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key());
}

export type VerifyResult =
  | { ok: true; claims: LinkClaims }
  | { ok: false; reason: 'expired'; jti: string | null }
  | { ok: false; reason: 'invalid' };

/** Algorithm pinned to HS256 (no `none`, no RS/HS confusion); issuer and audience required. */
export async function verifyLink(token: string): Promise<VerifyResult> {
  if (token.length > 2048) return { ok: false, reason: 'invalid' };
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], issuer: ISS, audience: AUD });
    const { cid, scope, pid, jti, exp } = payload as Record<string, unknown>;
    if (typeof cid !== 'string' || (scope !== 'client' && scope !== 'guest') || typeof jti !== 'string' || typeof exp !== 'number'
      || (pid !== undefined && typeof pid !== 'string') || (scope === 'guest' && !pid)) return { ok: false, reason: 'invalid' };
    return { ok: true, claims: { cid, scope, pid: pid as string | undefined, jti, exp } };
  } catch (e) {
    // jose checks the signature before the claims, so ERR_JWT_EXPIRED means "authentic but past exp".
    const err = e as { code?: string; payload?: { jti?: unknown } };
    if (err.code === 'ERR_JWT_EXPIRED') return { ok: false, reason: 'expired', jti: typeof err.payload?.jti === 'string' ? err.payload.jti : null };
    return { ok: false, reason: 'invalid' };
  }
}

/**
 * Links expire at 23:59:59 studio time (Asia/Hebron unless the library setting says otherwise) on the last day — "hidden at 23:59", the date
 * printed on the page. DST-safe: the offset is read for that very day.
 */
export function endOfStudioDay(daysFromNow: number, now = new Date(), tz = 'Asia/Hebron'): Date {
  const day = new Date(now.getTime() + daysFromNow * 86_400_000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(day);
  const guess = new Date(`${ymd}T23:59:59Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(off);
  const mins = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  return new Date(guess.getTime() - mins * 60_000);
}

/**
 * A project's delivery link (the owner's rule, 2026-10-30): one link per project, no PIN, no expiry date —
 * it works until an admin revokes it. «No expiry» is stored as this far date so every check that reads
 * expires_at keeps working unchanged; the pages show «دائم» instead of the date.
 */
export const PERMANENT_UNTIL = new Date('2099-12-31T21:59:59Z');
export const isPermanent = (expiresAt: string | Date) => new Date(expiresAt).getUTCFullYear() >= 2099;

/** Arabic-Indic and Eastern Arabic-Indic digits → ASCII; anything else is rejected later. */
export function normalizePin(raw: string): string {
  return raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
}
