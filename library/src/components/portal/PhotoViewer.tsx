'use client';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import type { Locale } from '@/i18n/config';
import { formatBytes, ltr, type Digits } from '@/lib/format';
import type { ViewAsset } from './ProjectView';
import s from './portal.module.css';

const PLUGINS = [Zoom, Thumbnails, Counter];

/**
 * The photo viewer: pure black, swipe/arrows to move, pinch/wheel to zoom into the 3840px layer, the
 * explicit download buttons (DESIGN §6.5, §6.7). RAW shows through its embedded preview. Guests: no buttons.
 */
export function PhotoViewer({ items, index, canDownload, digits, onClose }: { items: ViewAsset[]; index: number; canDownload: boolean; digits: Digits; onClose: () => void }) {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  const [at, setAt] = useState(index);
  const cur = items[at];
  // stable slides: a new array on every render makes the lightbox reset to `index`
  const slides = useMemo(() => items.map((a) => {
    const widths = a.widths.length ? a.widths : [640];
    const ratio = a.h && a.w ? a.h / a.w : 2 / 3;
    return {
      src: `/m/${a.id}/w${widths.filter((w) => w <= 2048).at(-1) ?? widths[0]}.webp`,
      alt: a.name, width: a.w || undefined, height: a.h || undefined,
      srcSet: widths.map((w) => ({ src: `/m/${a.id}/w${w}.webp`, width: w, height: Math.round(w * ratio) })),
    };
  }), [items]);
  return (
    <Lightbox
      open
      close={onClose}
      index={at}
      slides={slides}
      plugins={PLUGINS}
      counter={{ container: { style: { direction: 'ltr', unicodeBidi: 'isolate' } } }}
      on={{ view: ({ index: i }) => setAt(i) }}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
      thumbnails={{ width: 64, height: 44, gap: 8, border: 0, borderRadius: 4, padding: 0, imageFit: 'cover', showToggle: false }}
      carousel={{ finite: false, preload: 2 }}
      animation={{ fade: 200, swipe: 320 }}
      controller={{ closeOnPullDown: true, closeOnBackdropClick: false }}
      styles={{ container: { backgroundColor: '#000' }, thumbnailsContainer: { backgroundColor: '#000', paddingBottom: canDownload ? 112 : 64 } }}
      labels={{ Previous: t('viewer.prev'), Next: t('viewer.next'), Close: t('viewer.close'), 'Zoom in': t('viewer.zoomIn'), 'Zoom out': t('viewer.zoomOut') } as Record<string, string>}
      render={{
        controls: () => cur ? (
          <div className={s.viewerFoot} data-testid="viewer-footer">
            <div className={s.viewerInfo}>
              <span className={s.mono} dir="ltr">{cur.name}</span>
              <span className={s.viewerMeta}>
                {cur.w && cur.h ? <><bdi dir="ltr">{cur.w}×{cur.h}</bdi><span aria-hidden>·</span></> : null}
                <bdi dir="ltr">{formatBytes(cur.size, locale, digits)}</bdi><span aria-hidden>·</span>
                <span>{t(`group.${cur.group}`)}</span>
              </span>
            </div>
            {canDownload ? (
              <div className={s.viewerActions}>
                {cur.web ? <a className={s.secondary} href={`/api/download/${cur.id}?v=web`} download>{t('webPhoto')}</a> : null}
                <a className={`${s.primary} ${s.primarySq}`} href={`/api/download/${cur.id}`} download>
                  <Download size={16} aria-hidden />{t('original', { size: ltr(formatBytes(cur.size, locale, digits)) })}
                </a>
              </div>
            ) : null}
          </div>
        ) : null,
      }}
    />
  );
}
