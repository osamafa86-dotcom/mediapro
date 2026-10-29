import { z } from 'zod';
import { requireViewer } from '@/lib/auth/viewer';
import { setFavourite } from '@/lib/notes';
import { handle, json, readJson } from '@/lib/server/http';

const Body = z.object({ assetId: z.string().uuid(), on: z.boolean() });

/** Heart on / off for the client organisation. Guests: 403. */
export const POST = handle(async (req: Request) => {
  const v = await requireViewer(req);
  const b = Body.parse(await readJson(req));
  return json(await setFavourite(v, b.assetId, b.on));
});
