import { openLink } from '@/lib/auth/viewer';
import { handle } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/**
 * A project's permanent link has no PIN: the gate page sends the browser here, the session cookie is set and
 * the client lands on the project. Anything else (revoked, a PIN link, a bad token) goes back to the gate,
 * which says why.
 */
export const GET = handle(async (req: Request) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const r = token.length >= 20 && token.length <= 2048 ? await openLink(token) : { ok: false as const };
  const to = r.ok ? r.next : `/l/${encodeURIComponent(token)}?pin=1`;
  return new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
});
