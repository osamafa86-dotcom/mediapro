import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/authz';
import { requester, streamZip } from '@/lib/downloads';
import { handle, HttpError } from '@/lib/server/http';
import { contentDisposition } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** The prepared ZIP64, streamed as it is read from storage (STORE: no recompression, no buffering). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ ticket: string }> }) => {
  const { ticket } = await ctx.params;
  if (!isUuid(ticket)) throw new HttpError(404, 'not_found');
  const t = await getTranslations('portal');
  const folders = { photos: t('photos'), videos: t('videos'), final: t('group.final'), raw: t('group.raw'), footage: t('group.footage') };
  const z = await streamZip(await requester(req), ticket, folders);
  return new Response(z.stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(z.length),
      'Content-Disposition': contentDisposition(z.filename),
      'Cache-Control': 'private, no-store',
    },
  });
});
