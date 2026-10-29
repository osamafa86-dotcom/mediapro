import { z } from 'zod';
import { getSql } from '@/db';
import { verifyLink } from '@/lib/links';
import { notifyAdmins } from '@/lib/notify';
import { audit } from '@/lib/server/audit';
import { handle, json, readJson, requireSameOrigin } from '@/lib/server/http';

const Body = z.object({ token: z.string().min(20).max(2048) });

/**
 * "Ask for a new link" on the expired page. Needs an authentic (possibly expired) client token; one
 * open request per link at a time, so the button cannot flood the admin.
 */
export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { token } = Body.parse(await readJson(req));
  const v = await verifyLink(token);
  const jti = v.ok ? v.claims.jti : v.reason === 'expired' ? v.jti : null;
  if (!jti) return json({ error: 'invalid' }, 404);
  const sql = getSql();
  const [l] = await sql<{ id: string }[]>`select id from links where jti = ${jti}`;
  if (!l) return json({ error: 'invalid' }, 404);
  const inserted = await sql`insert into renewal_requests (link_id)
    select ${l.id} where not exists (select 1 from renewal_requests where link_id = ${l.id} and handled_at is null) returning id`;
  if (inserted.length) {
    await audit('link', l.id, 'link.renewal_requested', { type: 'link', id: l.id });
    const [c] = await sql<{ name_ar: string }[]>`select c.name_ar from links l join clients c on c.id = l.client_id where l.id = ${l.id}`;
    await notifyAdmins('onRenewalRequest', { client: c?.name_ar });
  }
  return json({ ok: true });
});
