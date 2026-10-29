import { describe, expect, it } from 'vitest';
import { ssoSign, ssoVerify } from '@/lib/sso-sign';

const SECRET = 'test-vector-secret-0123456789abcdef';
const base = { u: '42', e: 'sami@emdatra.org', n: 'سامي ع.', r: 'admin', exp: 1793300000, nonce: 'AbCdEfGh12345678' };
const q = (c: Record<string, string | number>, sig?: string) =>
  new URLSearchParams({ ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)])), sig: sig ?? ssoSign(c as typeof base, SECRET) });

describe('SSO links from the parent site', () => {
  it('the shared vector — PHP hash_hmac gives the same (docs/sso.md)', () => {
    expect(ssoSign(base, SECRET)).toBe('3046bfe1fd76c2d1204d0a9fa509f6856c2a408c263fbb7ab7688a7e9cca2b7f');
  });
  it('a fresh, well-signed link is accepted', () => {
    const r = ssoVerify(q(base), SECRET, base.exp - 60);
    expect(r).toEqual({ ok: true, claims: { ...base, exp: base.exp } });
  });
  it('any changed field breaks the signature (role, email, name, time)', () => {
    const sig = ssoSign(base, SECRET);
    for (const change of [{ r: 'photographer' }, { e: 'other@emdatra.org' }, { n: 'غيره' }, { exp: base.exp + 1 }, { u: '43' }]) {
      expect(ssoVerify(q({ ...base, ...change }, sig), SECRET, base.exp - 60), JSON.stringify(change)).toEqual({ ok: false, reason: 'bad_signature' });
    }
    expect(ssoVerify(q(base), 'another-secret-another-secret-00', base.exp - 60)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('time: expired, or minted too far ahead (a link is made at the click, not stored)', () => {
    expect(ssoVerify(q(base), SECRET, base.exp + 1)).toEqual({ ok: false, reason: 'expired' });
    expect(ssoVerify(q(base), SECRET, base.exp - 121)).toEqual({ ok: false, reason: 'too_far' });
  });
  it('only the library roles; a well-signed «client» or «viewer» is still refused', () => {
    expect(ssoVerify(q({ ...base, r: 'viewer' }), SECRET, base.exp - 60)).toEqual({ ok: false, reason: 'role' });
  });
  it('malformed input never reaches the HMAC comparison', () => {
    for (const bad of [{ nonce: 'short' }, { e: 'not-an-email' }, { n: '' }, { exp: 'soon' }, { u: 'a b' }]) {
      expect(ssoVerify(q({ ...base, ...bad }), SECRET, base.exp - 60).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(ssoVerify(new URLSearchParams({ ...Object.fromEntries(q(base)), sig: 'zz' }), SECRET, base.exp - 60)).toEqual({ ok: false, reason: 'malformed' });
  });
});
