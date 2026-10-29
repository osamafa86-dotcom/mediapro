import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { hashSecret, verifySecret } from '@/lib/auth/password';
import { randomToken } from '@/lib/crypto';
import { createSession } from '@/lib/auth/session';
import { clearFailures, lockedUntil, recordFailure } from '@/lib/auth/throttle';
import { audit } from '@/lib/server/audit';
import { clientIp, handle, HttpError, json, readJson, requireSameOrigin } from '@/lib/server/http';

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });

// A real Argon2id hash of a random string: unknown emails cost the same time as known ones.
let dummy: Promise<string> | undefined;
const DUMMY = () => (dummy ??= hashSecret(randomToken()));

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { email, password } = Body.parse(await readJson(req));
  const keys = [`login:${email}`, `login-ip:${clientIp(req)}:${email}`];
  for (const k of keys) {
    const until = await lockedUntil(k);
    if (until) throw new HttpError(423, 'locked', { until: until.toISOString() });
  }
  const [u] = await getDb().select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  const ok = (await verifySecret(u?.passwordHash ?? (await DUMMY()), password)) && !!u && !u.disabledAt && u.authProvider === 'local';
  if (!ok) {
    let until: Date | null = null;
    for (const k of keys) until = (await recordFailure(k)) ?? until;
    await audit('system', null, 'auth.login_failed', u ? { type: 'user', id: u.id } : undefined);
    if (until) throw new HttpError(423, 'locked', { until: until.toISOString() });
    throw new HttpError(401, 'bad_credentials');
  }
  for (const k of keys) await clearFailures(k);
  await createSession(u.id, req);
  await audit('user', u.id, 'auth.login');
  return json({ ok: true, next: u.role === 'admin' ? '/admin' : '/upload' });
});
