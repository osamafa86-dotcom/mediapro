import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isUuid } from '@/lib/authz';
import { audienceFor, keyFor, loadAsset, playlist, scrubTrack } from '@/lib/media';
import { bucket, s3 } from '@/lib/storage';

/** Renditions: authorize → 302 to a 10-minute signed URL (playlists and the scrub track are served rewritten). 404 for anything not allowed. */
export async function GET(_req: Request, ctx: { params: Promise<{ assetId: string; variant: string[] }> }) {
  const { assetId, variant } = await ctx.params;
  const nope = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!isUuid(assetId)) return nope();
  const asset = await loadAsset(assetId);
  if (!asset) return nope();
  const who = await audienceFor(asset);
  if (!who) return nope();
  const key = keyFor(asset.renditions, variant, who);
  if (!key) return nope();
  if (key.endsWith('.m3u8')) {
    return new Response(await playlist(key, `/m/${assetId}/${variant.join('/')}`), {
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'private, no-store' },
    });
  }
  if (key.endsWith('.vtt')) {
    return new Response(await scrubTrack(key, assetId), { headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  }
  const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 600 });
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=300' } });
}
