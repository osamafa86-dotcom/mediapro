import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => { process.env.LINK_SIGNING_SECRET = 'unit-only-link-secret-0123456789abcdef'; process.env.SESSION_SECRET = 'unit-only-session-secret-0123456789abcdef'; });

describe('link tokens', async () => {
  const { signLink, verifyLink, endOfStudioDay, normalizePin } = await import('@/lib/links');
  const future = new Date(Date.now() + 86_400_000);

  it('round-trips claims', async () => {
    const t = await signLink({ cid: 'c1', scope: 'client', jti: 'j1' }, future);
    const v = await verifyLink(t);
    expect(v.ok && v.claims).toMatchObject({ cid: 'c1', scope: 'client', jti: 'j1' });
  });

  it('rejects a token signed with another secret', async () => {
    const t = await new SignJWT({ cid: 'c1', scope: 'client' }).setProtectedHeader({ alg: 'HS256' })
      .setIssuer('emdatra-media').setAudience('link').setJti('j').setExpirationTime('1h').sign(new TextEncoder().encode('another-secret-another-secret-123456'));
    expect((await verifyLink(t)).ok).toBe(false);
  });

  it('rejects alg:none', async () => {
    const t = await signLink({ cid: 'c1', scope: 'client', jti: 'j1' }, future);
    const [, p] = t.split('.');
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
    expect(await verifyLink(none)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('a guest token without a project is invalid', async () => {
    const t = await signLink({ cid: 'c1', scope: 'guest', jti: 'j1' }, future);
    expect((await verifyLink(t)).ok).toBe(false);
  });

  it('an authentic expired token reports its jti (for the renewal page) — a forged one does not', async () => {
    const t = await signLink({ cid: 'c1', scope: 'client', jti: 'jx' }, new Date(Date.now() - 60_000));
    expect(await verifyLink(t)).toEqual({ ok: false, reason: 'expired', jti: 'jx' });
    const [h, p] = t.split('.');
    expect(await verifyLink(`${h}.${p}.AAAA`)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('expires at 23:59:59 studio time (Asia/Hebron), across DST', () => {
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hebron', dateStyle: 'short', timeStyle: 'medium' }).format(d);
    expect(fmt(endOfStudioDay(0, new Date('2026-10-12T10:00:00Z')))).toBe('12/10/2026, 23:59:59');
    expect(fmt(endOfStudioDay(0, new Date('2026-01-15T10:00:00Z')))).toBe('15/01/2026, 23:59:59');
    expect(fmt(endOfStudioDay(90, new Date('2026-10-12T10:00:00Z')))).toBe('10/01/2027, 23:59:59');
  });

  it('normalises Arabic-Indic and Persian digits', () => {
    expect(normalizePin('٤٨٢٧')).toBe('4827');
    expect(normalizePin('۴۸۲۷')).toBe('4827');
  });
});

describe('secrets at rest', async () => {
  const { encrypt, decrypt, randomPin } = await import('@/lib/crypto');
  it('AES-GCM round trip, and tampering is detected', () => {
    const blob = encrypt('refresh-token-value');
    expect(decrypt(blob)).toBe('refresh-token-value');
    const parts = blob.split('.');
    parts[2] = Buffer.from('x'.repeat(10)).toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('PINs are 4 digits', () => {
    for (let i = 0; i < 200; i++) expect(randomPin()).toMatch(/^\d{4}$/);
  });
});
