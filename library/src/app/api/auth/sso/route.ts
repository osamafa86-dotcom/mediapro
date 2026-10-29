import { HttpError } from '@/lib/server/http';
import { ssoSignIn } from '@/lib/sso';

/**
 * The parent site opens the library with a signed link (window.open, no iframe): verify, spend the
 * nonce, sign in, go home. Any refusal goes to the login page with a reason, never to a blank error.
 */
export async function GET(req: Request) {
  const to = (path: string) => new Response(null, { status: 302, headers: { Location: path, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  try {
    const u = await ssoSignIn(req);
    return to(u.role === 'admin' ? '/admin' : '/upload');
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return new Response('Not Found', { status: 404 });
    const code = e instanceof HttpError ? e.code : 'sso_failed';
    if (!(e instanceof HttpError)) console.error('[sso]', e instanceof Error ? e.message.split('\n')[0] : e);
    return to(`/login?sso=${encodeURIComponent(code)}`);
  }
}
