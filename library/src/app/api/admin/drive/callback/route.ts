import { cookies } from 'next/headers';
import { requireStaff } from '@/lib/auth/session';
import { safeEqual } from '@/lib/crypto';
import { connect } from '@/lib/drive';
import { env } from '@/lib/env';
import { audit } from '@/lib/server/audit';
import { handle } from '@/lib/server/http';

/** Back from Google: the state must be the one this browser got, then the code becomes an encrypted refresh token. */
export const GET = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const u = new URL(req.url);
  const jar = await cookies();
  const name = env.secureCookies ? '__Host-ml_gstate' : 'ml_gstate';
  const expected = jar.get(name)?.value ?? '';
  jar.delete(name);
  const back = (q: string) => new Response(null, { status: 302, headers: { Location: `/admin/import?drive=${q}`, 'Cache-Control': 'no-store' } });
  if (!expected || !safeEqual(u.searchParams.get('state') ?? '', expected)) return back('bad_state');
  const code = u.searchParams.get('code');
  if (!code) return back(u.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed');
  try {
    await connect(staff.id, code);
  } catch {
    return back('failed');
  }
  await audit('user', staff.id, 'drive.connected', { type: 'user', id: staff.id });
  return back('connected');
});
