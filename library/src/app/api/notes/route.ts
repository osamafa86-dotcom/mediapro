import { z } from 'zod';
import { requireViewer } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { addClientNote, notesForViewer } from '@/lib/notes';
import { handle, HttpError, json, readJson } from '@/lib/server/http';

/** The notes on one asset, with replies — for the client (never a guest). */
export const GET = handle(async (req: Request) => {
  const v = await requireViewer(req);
  const id = new URL(req.url).searchParams.get('assetId') ?? '';
  if (!isUuid(id)) throw new HttpError(400, 'invalid_asset');
  return json({ notes: await notesForViewer(v, id) });
});

const Body = z.object({
  assetId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  t: z.number().min(0).max(24 * 3600).optional(),
}).refine((b) => (b.x == null) === (b.y == null), 'pin needs x and y');

/** A new note: a pin on a photo (x, y in 0..1) or a moment in a video (t seconds). */
export const POST = handle(async (req: Request) => {
  const v = await requireViewer(req);
  return json(await addClientNote(v, Body.parse(await readJson(req))), 201);
});
