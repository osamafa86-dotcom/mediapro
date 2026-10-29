import { z } from 'zod';
import { attemptPin } from '@/lib/auth/viewer';
import { normalizePin } from '@/lib/links';
import { handle, json, readJson, requireSameOrigin } from '@/lib/server/http';

const Body = z.object({ token: z.string().min(20).max(2048), pin: z.string().max(16) });

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const b = Body.parse(await readJson(req));
  const r = await attemptPin(b.token, normalizePin(b.pin));
  if (r.ok) return json({ ok: true, next: r.next });
  if (r.status === 423) return json({ error: 'locked', until: r.until.toISOString() }, 423);
  if (r.status === 401) return json({ error: 'wrong_pin', remaining: r.remaining }, 401);
  return json({ error: r.status === 410 ? 'expired' : 'invalid' }, r.status);
});
