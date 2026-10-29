import 'server-only';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db';
import { sessions, users } from '@/db/schema';
import { randomToken, safeEqual, sha256 } from '../crypto';
import { cookieName, cookieOpts } from '../server/cookies';
import { HttpError, requireSameOrigin } from '../server/http';

const ABSOLUTE_DAYS = 30;
const IDLE_DAYS = 7;

export type Role = 'admin' | 'photographer' | 'editor' | 'contributor';
export const TEAM_ROLES = ['photographer', 'editor', 'contributor'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface Staff { id: string; name: string; email: string | null; role: Role; locale: 'ar' | 'tr'; csrf: string; tokenHash: string }

export async function createSession(userId: string, req: Request) {
  const token = randomToken();
  const csrf = randomToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_DAYS * 86_400_000);
  await getDb().insert(sessions).values({
    tokenHash: sha256(token), userId, csrfToken: csrf, expiresAt,
    ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  });
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(cookieName('session'), token, cookieOpts(expiresAt));
  // Readable by our JS so fetch() can echo it in X-CSRF-Token; the server compares with the DB copy, not the cookie.
  jar.set(cookieName('csrf'), csrf, cookieOpts(expiresAt, false));
}

/** Current staff user, or null. Disabled users and idle/expired sessions are treated as signed out. */
export async function getStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(cookieName('session'))?.value;
  if (!token) return null;
  const h = sha256(token);
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, locale: users.locale, csrf: sessions.csrfToken, lastSeenAt: sessions.lastSeenAt })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, h), gt(sessions.expiresAt, sql`now()`),
      gt(sessions.lastSeenAt, sql`now() - make_interval(days => ${IDLE_DAYS})`), isNull(users.disabledAt)))
    .limit(1);
  if (!row) return null;
  if (Date.now() - new Date(row.lastSeenAt).getTime() > 5 * 60_000) {
    await getDb().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.tokenHash, h));
  }
  const { lastSeenAt: _, ...staff } = row;
  return { ...staff, tokenHash: h };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName('session'))?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(cookieName('session'));
  jar.delete(cookieName('csrf'));
}

/** For route handlers. Reads: session only. Writes: session + same Origin + X-CSRF-Token bound to this session. */
export async function requireStaff(req: Request, roles?: Role[]): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new HttpError(401, 'unauthenticated');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requireSameOrigin(req);
    if (!safeEqual(req.headers.get('x-csrf-token') ?? '', staff.csrf)) throw new HttpError(403, 'bad_csrf');
  }
  if (roles && !roles.includes(staff.role)) throw new HttpError(403, 'forbidden');
  return staff;
}

/**
 * For server pages. Call it in every protected page, not only its layout: layouts and pages render
 * in parallel in the App Router, so a layout check does not stop the page from running.
 */
export async function requireStaffPage(roles?: Role[]): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/login');
  if (roles && !roles.includes(staff.role)) notFound();
  return staff;
}
