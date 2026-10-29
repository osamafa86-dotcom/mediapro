import { AlertTriangle, Film, Heart, Loader } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Renditions } from '@/db/schema';
import { ltr } from '@/lib/format';
import { placeholder } from '@/lib/thumb';
import s from './media.module.css';

export interface TileAsset {
  id: string; original_name: string; status: string; error: string | null; section: string;
  thumbhash: string | null; duration: number | null; renditions: Renditions;
}

const REASONS = ['type_mismatch', 'decode_failed', 'raw_no_preview', 'transcode_failed', 'source_missing', 'too_large'] as const;

const clock = (sec: number) => {
  const t = Math.round(sec);
  const [h, m, x] = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60];
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + `:${String(x).padStart(2, '0')}`;
};

/**
 * One grid tile. Every image comes through /m/<id>/… (authorized, then a short signed redirect):
 * AVIF → WebP → JPEG at the grid widths, over a ThumbHash placeholder so nothing jumps while it loads.
 */
export async function MediaTile({ a, sizes = '(max-width: 600px) 50vw, 220px', favs = 0 }: { a: TileAsset; sizes?: string; favs?: number }) {
  const t = await getTranslations('media');
  const grid = (a.renditions.images ?? []).filter((i) => i.w <= 1280);
  const set = (ext: 'avif' | 'webp' | 'jpg') => grid.filter((i) => (ext === 'avif' ? i.avif : true)).map((i) => `/m/${a.id}/w${i.w}.${ext} ${i.w}w`).join(', ');
  const bg = placeholder(a.thumbhash);
  const name = <span className={s.name} dir="auto">{a.original_name}</span>;

  if (a.status === 'failed') {
    const code = REASONS.find((r) => a.error?.startsWith(r));
    return (
      <div className={`${s.tile} ${s.failed}`} data-status="failed" data-reason={code ?? 'other'}>
        <AlertTriangle size={18} aria-hidden />
        <span className={s.why}>{t('failed', { reason: t(`reason.${code ?? 'other'}`) })}</span>
        {name}
      </div>
    );
  }
  if (a.status === 'ready' && !grid.length) {
    // ready but nothing to show (e.g. a record without previews): just the name, no false «processing»
    return <div className={`${s.tile} ${s.pending}`} data-status="no-preview">{name}</div>;
  }
  if (a.status !== 'ready') {
    return (
      <div className={`${s.tile} ${s.pending}`} data-status="pending" data-asset-status={a.status}>
        <Loader size={18} aria-hidden className={s.spin} />
        <span className={s.why}>{t(a.status === 'uploading' ? 'uploading' : 'processing')}</span>
        {name}
      </div>
    );
  }
  const largest = grid[grid.length - 1]!;
  return (
    <div className={s.tile} data-status="ready" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
        <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
        <img src={`/m/${a.id}/w${grid[Math.min(1, grid.length - 1)]!.w}.jpg`} srcSet={set('jpg')} sizes={sizes} alt={a.original_name}
          width={largest.w} height={largest.h} loading="lazy" decoding="async" className={s.img} />
      </picture>
      {favs ? <span className={s.fav} data-testid="client-fav" title={t('favs', { n: favs })}><Heart size={12} fill="currentColor" aria-hidden /><span className={s.num}>{favs}</span></span> : null}
      {a.section === 'videos' && a.duration ? (
        <span className={s.badge}><Film size={12} aria-hidden /><span className={s.num}>{ltr(clock(a.duration))}</span></span>
      ) : null}
    </div>
  );
}
