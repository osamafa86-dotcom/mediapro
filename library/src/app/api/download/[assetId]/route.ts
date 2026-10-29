import { isUuid } from '@/lib/authz';
import { requester, singleFile } from '@/lib/downloads';
import { handle, HttpError } from '@/lib/server/http';

/** One file. `?v=web` for the 2048px JPEG / 1080p MP4 copy; otherwise the original. 302 to a 10-minute signed URL. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ assetId: string }> }) => {
  const { assetId } = await ctx.params;
  if (!isUuid(assetId)) throw new HttpError(404, 'not_found');
  const variant = new URL(req.url).searchParams.get('v') === 'web' ? 'web' : 'original';
  const url = await singleFile(await requester(req), assetId, variant);
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
});
