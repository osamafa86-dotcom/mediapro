'use client';
import { Download, Heart, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import type { Locale } from '@/i18n/config';
import { formatBytes, ltr, type Digits } from '@/lib/format';
import { NotesPanel, type ClientNote } from './NotesPanel';
import type { ViewAsset } from './ProjectView';
import n from './notes.module.css';
import s from './portal.module.css';

const PLUGINS = [Zoom, Thumbnails, Counter];

/**
 * The photo viewer: pure black, swipe/arrows to move, pinch/wheel to zoom into the 3840px layer, the
 * explicit download buttons (DESIGN §6.5, §6.7). RAW shows through its embedded preview. Guests: no buttons,
 * no heart, no notes. Clients: the heart and the notes; with the notes open, a tap on the photo drops a pin.
 */
export function PhotoViewer({ items, index, canDownload, canNote = false, favs, onFav, digits, onClose, extraButtons, onIndex }: {
  items: ViewAsset[]; index: number; canDownload: boolean; canNote?: boolean; favs?: Set<string>; onFav?: (id: string, on: boolean) => void;
  digits: Digits; onClose: () => void;
  /** toolbar buttons for the photo on screen (the admin's cover and delete), before «close» */
  extraButtons?: (cur: ViewAsset) => React.JSX.Element[];
  /** the photo on screen changed (the admin keeps its selection in step) */
  onIndex?: (i: number) => void;
}) {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  const [at, setAt] = useState(index);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const cur = items[at];
  const fav = !!(cur && favs?.has(cur.id));
  const openCount = notes.filter((x) => x.status !== 'resolved').length;
  // stable slides: a new array on every render makes the lightbox reset to `index`
  const slides = useMemo(() => items.map((a) => {
    const widths = a.widths.length ? a.widths : [640];
    const ratio = a.h && a.w ? a.h / a.w : 2 / 3;
    return {
      src: `/m/${a.id}/w${widths.filter((w) => w <= 2048).at(-1) ?? widths[0]}.webp`,
      alt: a.name, width: a.w || undefined, height: a.h || undefined, assetId: a.id,
      srcSet: widths.map((w) => ({ src: `/m/${a.id}/w${w}.webp`, width: w, height: Math.round(w * ratio) })),
    };
  }), [items]);

  const buttons = canNote && cur ? [
    <button key="fav" type="button" className="yarl__button" aria-pressed={fav} aria-label={fav ? t('fav.remove') : t('fav.add')} data-testid="viewer-fav"
      onClick={() => onFav?.(cur.id, !fav)}>
      <Heart size={22} aria-hidden fill={fav ? '#1fc9c2' : 'none'} color={fav ? '#1fc9c2' : 'currentColor'} />
    </button>,
    <button key="notes" type="button" className="yarl__button" aria-pressed={notesOpen} aria-label={t('notes.open')} data-testid="viewer-notes"
      onClick={() => { setNotesOpen((o) => !o); setPin(null); }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <MessageSquare size={22} aria-hidden />
        {openCount ? <span className={s.dotCount}>{openCount}</span> : null}
      </span>
    </button>,
    'close',
  ] : ['close'];
  if (extraButtons && cur) buttons.splice(buttons.length - 1, 0, ...extraButtons(cur));

  return (
    <Lightbox
      open
      close={onClose}
      index={at}
      slides={slides}
      plugins={PLUGINS}
      counter={{ container: { style: { direction: 'ltr', unicodeBidi: 'isolate' } } }}
      on={{ view: ({ index: i }) => { setAt(i); setPin(null); onIndex?.(i); }, zoom: ({ zoom }) => setZoomed(zoom > 1.01) }}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
      thumbnails={{ width: 64, height: 44, gap: 8, border: 0, borderRadius: 4, padding: 0, imageFit: 'cover', showToggle: false }}
      carousel={{ finite: false, preload: 2 }}
      animation={{ fade: 200, swipe: 320 }}
      controller={{ closeOnPullDown: !notesOpen, closeOnBackdropClick: false }}
      toolbar={{ buttons }}
      styles={{ container: { backgroundColor: '#000' }, thumbnailsContainer: { backgroundColor: '#000', paddingBottom: canDownload ? 112 : 64 } }}
      labels={{ Previous: t('viewer.prev'), Next: t('viewer.next'), Close: t('viewer.close'), 'Zoom in': t('viewer.zoomIn'), 'Zoom out': t('viewer.zoomOut') } as Record<string, string>}
      render={{
        slideContainer: ({ slide, children }) => (
          <div style={{ position: 'relative', inlineSize: '100%', blockSize: '100%' }}>
            {children}
            {canNote && !zoomed && (slide as Slide & { assetId?: string }).assetId === cur?.id ? (
              <PinLayer slide={slide} notes={notes} pending={pin} placing={notesOpen} onPlace={setPin} />
            ) : null}
          </div>
        ),
        controls: () => cur ? (
          <>
            {canNote ? (
              // mounted even while closed, so the toolbar count and the pins are there from the start
              <div className={s.viewerNotes} hidden={!notesOpen}>
                <NotesPanel key={cur.id} assetId={cur.id} kind="photo" pin={pin} onClearPin={() => setPin(null)} onNotes={setNotes}
                  onClose={() => { setNotesOpen(false); setPin(null); }} />
              </div>
            ) : null}
            {!notesOpen ? (
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
            ) : null}
          </>
        ) : null,
      }}
    />
  );
}

/**
 * Pins over the photo as it is drawn (object-fit: contain inside the slide), so x, y stay relative to the
 * image itself (0..1) at any screen size. While placing, a tap anywhere on the image sets the new pin.
 */
function PinLayer({ slide, notes, pending, placing, onPlace }: {
  slide: Slide; notes: ClientNote[]; pending: { x: number; y: number } | null; placing: boolean; onPlace: (p: { x: number; y: number }) => void;
}) {
  const t = useTranslations('portal.notes');
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const ar = (slide.width ?? 3) / (slide.height ?? 2);
      const w = Math.min(W, H * ar), h = w / ar;
      setBox({ l: (W - w) / 2, t: (H - h) / 2, w, h });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slide.width, slide.height]);
  return (
    <div ref={ref} className={n.pins} data-placing={placing} data-testid="pin-layer"
      style={box ? { left: box.l, top: box.t, width: box.w, height: box.h } : { inset: 0, visibility: 'hidden' }}
      onClick={(e) => {
        if (!placing || !box) return;
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        onPlace({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
      }}>
      {notes.filter((x) => x.anchor === 'pin' && x.x != null && x.y != null).map((x) => (
        <span key={x.id} className={n.pin} data-resolved={x.status === 'resolved'} style={{ left: `${x.x! * 100}%`, top: `${x.y! * 100}%` }}
          aria-label={t('pinN', { n: x.n })} role="img" data-pin={x.n}>{x.n}</span>
      ))}
      {pending ? <span className={n.pin} data-pending="true" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} aria-hidden>+</span> : null}
    </div>
  );
}
