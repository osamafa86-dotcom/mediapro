import type { Renditions } from '@/db/schema';

/* Pure rules (unit-tested): which stored rendition a variant path names, for whom. */

export type Audience = 'staff' | 'client' | 'guest';

const FMT = { avif: 'avif', webp: 'webp', jpg: 'jpeg' } as const;

/**
 * Variant path → object key, or null if this audience may not have it.
 *   w640.webp | wm640.jpg | poster | web | raw | sprite.vtt | sprite.jpg | hls/master.m3u8 | hls/<height>/<file>
 * Guests: watermarked stills only (never AVIF, the web copy or the RAW preview); the stream is a preview, not an original.
 */
export function keyFor(r: Renditions, variant: string[], who: Audience): string | null {
  const v = variant.join('/');
  let m = /^(wm)?w?(\d{3,4})\.(avif|webp|jpg)$/.exec(v);
  if (m) {
    const [, wm, w, ext] = m;
    const width = Number(w);
    if (who === 'guest' || wm) {
      if (ext === 'avif') return null;
      // the largest watermarked copy not wider than asked (they stop at 1280)
      const e = [...(r.wm ?? [])].sort((a, b) => b.w - a.w).find((x) => x.w <= width) ?? r.wm?.[0];
      return e ? e[FMT[ext as 'webp' | 'jpg'] as 'webp' | 'jpeg'] : null;
    }
    const e = r.images?.find((x) => x.w === width);
    return e?.[FMT[ext as 'avif' | 'webp' | 'jpg']] ?? null;
  }
  if (v === 'poster') return who === 'guest' ? (r.wm?.at(-1)?.jpeg ?? null) : (r.poster ?? null);
  if (v === 'web') return who === 'guest' ? null : (r.web ?? r.mp4_1080 ?? null);
  if (v === 'raw') return who === 'guest' ? null : (r.rawPreview ?? null);
  if (v === 'sprite.vtt') return r.sprite?.vtt ?? null;
  if (v === 'sprite.jpg') return r.sprite?.image ?? null;
  if (v === 'hls/master.m3u8') return r.hls?.master ?? null;
  m = /^hls\/(\d{3,4})\/(index\.m3u8|init\.mp4|seg_\d{5}\.m4s)$/.exec(v);
  if (m && r.hls?.dir && r.hls.rungs.includes(Number(m[1]))) return `${r.hls.dir}/${m[1]}/${m[2]}`;
  return null;
}
