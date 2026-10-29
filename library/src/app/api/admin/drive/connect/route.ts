import { cookies } from 'next/headers';
import { requireStaff } from '@/lib/auth/session';
import { randomToken } from '@/lib/crypto';
import { redirectUri } from '@/lib/drive';
import { env } from '@/lib/env';
import { authUrl, googleConfigured } from '@/lib/google';
import { handle, HttpError } from '@/lib/server/http';

/** «ربط Google Drive»: to Google's consent screen with a one-time state bound to this browser. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, ['admin']);
  if (!googleConfigured()) throw new HttpError(409, 'google_not_configured');
  const state = randomToken(24);
  (await cookies()).set(env.secureCookies ? '__Host-ml_gstate' : 'ml_gstate', state, {
    httpOnly: true, secure: env.secureCookies, sameSite: 'lax', path: '/', maxAge: 600,
  });
  return new Response(null, { status: 302, headers: { Location: authUrl(state, redirectUri()), 'Cache-Control': 'no-store' } });
});
