import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Phase 2 single sign-on (DESIGN §9 «الدخول الموحّد»): the parent site (wallt.emdatra.org) signs a
 * short-lived link with a shared secret, in the style of its media_sig_lib — HMAC-SHA256 over the fields
 * joined with «|». Pure functions, so both sides can be tested against the same vectors (docs/sso.md).
 */

export const SSO_ROLES = ['admin', 'photographer', 'editor', 'contributor'] as const;
export type SsoRole = (typeof SSO_ROLES)[number];
export interface SsoClaims { u: string; e: string; n: string; r: SsoRole; exp: number; nonce: string }

/** At most this far in the future: a link is minted at the click, not stored. */
export const SSO_MAX_TTL = 120;

export function ssoPayload(c: { u: string; e: string; n: string; r: string; exp: number | string; nonce: string }) {
  return ['media-sso', 'v1', c.u, c.e, c.n, c.r, String(c.exp), c.nonce].join('|');
}

export function ssoSign(c: Parameters<typeof ssoPayload>[0], secret: string) {
  return createHmac('sha256', secret).update(ssoPayload(c)).digest('hex');
}

export type SsoCheck = { ok: true; claims: SsoClaims } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'too_far' | 'role' };

/** Shape → signature (constant time) → time window → role. The nonce's single use is checked by the caller. */
export function ssoVerify(q: URLSearchParams, secret: string, now = Math.floor(Date.now() / 1000)): SsoCheck {
  const g = (k: string) => q.get(k) ?? '';
  const c = { u: g('u'), e: g('e').trim().toLowerCase(), n: g('n').trim(), r: g('r'), exp: g('exp'), nonce: g('nonce') };
  const sig = g('sig');
  if (!/^[\w.:-]{1,64}$/.test(c.u) || !/^[^@\s]{1,64}@[^@\s]{1,190}$/.test(c.e) || !c.n || c.n.length > 120
    || !/^\d{9,11}$/.test(c.exp) || !/^[A-Za-z0-9_-]{16,64}$/.test(c.nonce) || !/^[0-9a-f]{64}$/.test(sig)) {
    return { ok: false, reason: 'malformed' };
  }
  // the signature covers the fields exactly as sent (e and n before trimming/lower-casing would differ → refuse)
  const raw = { u: g('u'), e: g('e'), n: g('n'), r: g('r'), exp: g('exp'), nonce: g('nonce') };
  const want = Buffer.from(ssoSign(raw, secret), 'hex');
  if (!timingSafeEqual(want, Buffer.from(sig, 'hex'))) return { ok: false, reason: 'bad_signature' };
  const exp = Number(c.exp);
  if (exp < now) return { ok: false, reason: 'expired' };
  if (exp > now + SSO_MAX_TTL) return { ok: false, reason: 'too_far' };
  if (!SSO_ROLES.includes(c.r as SsoRole)) return { ok: false, reason: 'role' };
  return { ok: true, claims: { ...c, r: c.r as SsoRole, exp } };
}
