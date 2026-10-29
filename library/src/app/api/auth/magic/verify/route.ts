import { z } from 'zod';
import { getSql } from '@/db';
import { createSession } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json, readJson, requireSameOrigin } from '@/lib/server/http';

const Body = z.object({ token: z.string().min(20).max(200) });

/**
 * POST, not GET: mail scanners prefetch links, so opening the e-mail link only shows a button.
 * The token is consumed atomically — a second use (or a race) finds nothing.
 */
export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { token } = Body.parse(await readJson(req));
  const [row] = await getSql()<{ user_id: string; role: string }[]>`
    update magic_links m set used_at = now()
    from users u
    where m.token_hash = ${sha256(token)} and m.used_at is null and m.expires_at > now()
      and u.id = m.user_id and u.disabled_at is null
    returning m.user_id, u.role`;
  if (!row) throw new HttpError(410, 'magic_invalid');
  await createSession(row.user_id, req);
  await audit('user', row.user_id, 'auth.login_magic');
  return json({ ok: true, next: row.role === 'admin' ? '/admin' : '/upload' });
});
