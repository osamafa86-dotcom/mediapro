'use client';
import justifiedLayout from 'justified-layout';
import { Check, Download, Film, Heart, Image as ImageIcon, Video, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { SegmentTab, Chip } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { postJson } from '@/lib/client/api';
import { clock } from '@/lib/clock';
import { formatBytes, ltr, normalizeSearch, searchTokens, type Digits } from '@/lib/format';
import { DownloadFeedback } from './DownloadFeedback';
import { PhotoViewer } from './PhotoViewer';
import { useDownloads } from './useDownloads';
import s from './portal.module.css';

export interface ViewAsset {
  id: string; name: string; section: 'photos' | 'videos'; group: 'final' | 'raw' | 'footage';
  w: number; h: number; size: number; duration: number | null; taken: string | null; hash: string | null;
  widths: number[]; web: boolean; quality: string | null;
}

type Sort = 'newest' | 'oldest' | 'name';
const GROUP_ORDER = ['final', 'footage', 'raw'] as const;

export function ProjectView({ projectId, title, assets, canDownload, guest = false, favourites = [], digits, initial }: {
  projectId: string; title: string; assets: ViewAsset[]; canDownload: boolean; guest?: boolean; favourites?: string[]; digits: Digits;
  initial: { tab: 'photos' | 'videos'; group?: string };
}) {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  const size = (b: number) => ltr(formatBytes(b, locale, digits));
  const [tab, setTab] = useState<'photos' | 'videos'>(initial.tab);
  const [sort, setSort] = useState<Sort>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);
  const dl = useDownloads();
  const [favs, setFavs] = useState(() => new Set(favourites));
  const [favOnly, setFavOnly] = useState(false);
  const setFav = async (id: string, on: boolean) => {
    setFavs((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
    const r = await postJson('/api/favourites', { assetId: id, on }, 'vcsrf');
    if (!r.ok) setFavs((cur) => { const n = new Set(cur); if (on) n.delete(id); else n.add(id); return n; });
  };

  const q = useSearchParams().get('q') ?? '';
  const toks = searchTokens(q);
  const found = toks.length ? assets.filter((a) => { const k = normalizeSearch(a.name); return toks.every((tk) => k.includes(tk)); }) : assets;
  const inTab = found.filter((a) => a.section === tab);
  const groups = GROUP_ORDER.filter((g) => inTab.some((a) => a.group === g));
  const [groupState, setGroup] = useState<string | undefined>(initial.group);
  const group = groupState && groups.includes(groupState as never) ? groupState : groups[0];
  const time = (a: ViewAsset) => (a.taken ? Date.parse(a.taken) : 0);
  const shown = (favOnly ? inTab.filter((a) => favs.has(a.id)) : inTab.filter((a) => a.group === group))
    .sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, locale) : (a, b) => (sort === 'newest' ? time(b) - time(a) : time(a) - time(b)));

  // the address bar follows the tab and group, so a link opens on the same view
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('tab', tab);
    if (group) u.searchParams.set('group', group); else u.searchParams.delete('group');
    window.history.replaceState(null, '', u);
  }, [tab, group]);

  const total = (list: ViewAsset[]) => list.reduce((n, a) => n + a.size, 0);
  const sel = assets.filter((a) => selected.has(a.id));
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const count = (sec: 'photos' | 'videos') => found.filter((a) => a.section === sec).length;

  return (
    <>
      <div className={s.toolbar}>
        <SegmentTab label={t('sectionsLabel')} selected={tab} onChange={(id) => { setTab(id as 'photos' | 'videos'); setGroup(undefined); }}
          items={[
            { id: 'photos', label: <span className={s.meta} style={{ color: 'inherit' }}><ImageIcon size={16} aria-hidden />{t('photos')}</span>, count: count('photos') },
            { id: 'videos', label: <span className={s.meta} style={{ color: 'inherit' }}><Video size={16} aria-hidden />{t('videos')}</span>, count: count('videos') },
          ]} />
        {groups.length > 1 || (!guest && inTab.some((a) => favs.has(a.id))) ? (
          <div className={s.chips} role="group" aria-label={t('groupsLabel')}>
            {!guest && inTab.some((a) => favs.has(a.id)) ? (
              <Chip isSelected={favOnly} onChange={() => setFavOnly(!favOnly)} data-testid="fav-chip"
                label={<>{t('fav.chip')} · <span className={s.num}>{inTab.filter((a) => favs.has(a.id)).length}</span></>} />
            ) : null}
            {groups.length > 1 ? groups.map((g) => (
              <Chip key={g} isSelected={!favOnly && g === group} onChange={() => { setFavOnly(false); setGroup(g); }}
                label={<>{t(`group.${g}`)} · <span className={s.num}>{inTab.filter((a) => a.group === g).length}</span></>} />
            )) : null}
          </div>
        ) : null}
        <div className={s.toolEnd}>
          {canDownload && shown.length && group && !favOnly ? (
            <button type="button" className={s.linkBtn} disabled={dl.busy} data-testid="download-group"
              onClick={() => dl.bulk({ projectId, section: tab, group, label: `${title} - ${t(tab)} - ${t(`group.${group}`)}` })}>
              <Download size={16} aria-hidden />{t('downloadGroup', { group: t(`group.${group}`), size: size(total(shown)) })}
            </button>
          ) : null}
          <label className="sr-only" htmlFor="sort">{t('sort.label')}</label>
          <select id="sort" className={s.select} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {(['newest', 'oldest', 'name'] as const).map((k) => <option key={k} value={k}>{t(`sort.${k}`)}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <section className={s.empty} data-testid={toks.length ? 'search-empty' : undefined}>
          <span className={s.emptyIcon} aria-hidden>{tab === 'photos' ? <ImageIcon size={22} /> : <Film size={22} />}</span>
          {toks.length ? (
            <><h2 className="t-heading">{t('search.none', { q })}</h2><p className={s.muted}>{t('search.hint')}</p></>
          ) : <p className={s.muted}>{t(tab === 'photos' ? 'emptyPhotos' : 'emptyVideos')}</p>}
        </section>
      ) : tab === 'photos' ? (
        <Justified items={shown} selected={selected} canSelect={canDownload} selecting={selected.size > 0} avif={!guest} favs={favs}
          onOpen={(i) => setViewing(i)} onToggle={toggle} />
      ) : (
        <ul className={s.vgrid} data-testid="video-grid">
          {shown.map((a) => (
            <li key={a.id} className={`${s.vcard} ${s.cell}`} data-asset-id={a.id} data-selected={selected.has(a.id)}>
              <Link href={`/p/${projectId}/v/${a.id}`} className={s.vthumb} data-selected={selected.has(a.id)} style={bg(a.hash)} aria-label={a.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- authorized /m route */}
                <img src={`/m/${a.id}/w640.webp`} srcSet={`/m/${a.id}/w640.webp 640w, /m/${a.id}/w1280.webp 1280w`} sizes="(max-width: 700px) 100vw, 320px" alt="" loading="lazy" decoding="async" />
                {a.duration ? <span className={s.dur}>{clock(a.duration)}</span> : null}
                <span className={s.tileScrim} />
              </Link>
              {canDownload ? <SelectBox a={a} on={selected.has(a.id)} toggle={toggle} label={t('select', { name: a.name })} /> : null}
              <Link href={`/p/${projectId}/v/${a.id}`} className={s.vtitle}><bdi>{a.name}</bdi></Link>
              <span className={s.meta}>{[t(`group.${a.group}`), a.quality, size(a.size)].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      {viewing !== null ? (
        <PhotoViewer items={shown} index={viewing} canDownload={canDownload} canNote={!guest} favs={favs} onFav={setFav} digits={digits} onClose={() => setViewing(null)} />
      ) : null}

      {favOnly && selected.size === 0 && canDownload && shown.length ? (
        <div className={s.bar} role="region" aria-label={t('fav.inFav', { n: shown.length })} data-testid="fav-bar">
          <button type="button" className={s.iconBtn} aria-label={t('clearSelection')} onClick={() => setFavOnly(false)}><X size={18} aria-hidden /></button>
          <span className={s.barCount}>{t('fav.inFav', { n: shown.length })}</span>
          <span className={`${s.mono} ${s.small} ${s.muted}`}>{size(total(shown))}</span>
          <button type="button" className={s.primary} aria-disabled={dl.busy}
            onClick={() => dl.bulk({ projectId, ids: shown.map((a) => a.id), label: `${title} - ${t('fav.chip')}` })}>
            <Download size={16} aria-hidden />{t('fav.download')}
          </button>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className={s.bar} role="region" aria-label={t('selected', { n: selected.size })} data-testid="selection-bar">
          <button type="button" className={s.iconBtn} aria-label={t('clearSelection')} onClick={() => setSelected(new Set())}><X size={18} aria-hidden /></button>
          <span className={s.barCount}>{t('selected', { n: selected.size })}</span>
          <span className={`${s.mono} ${s.small} ${s.muted}`}>{size(total(sel))}</span>
          <button type="button" className={s.primary} aria-disabled={dl.busy}
            onClick={() => dl.bulk({ projectId, ids: [...selected], label: title })}>
            <Download size={16} aria-hidden />{t('downloadSelected')}
          </button>
        </div>
      ) : null}

      <DownloadFeedback dl={dl} />
    </>
  );
}

function bg(hash: string | null) {
  if (!hash) return undefined;
  try {
    const bin = atob(hash);
    return { backgroundImage: `url(${thumbHashToDataURL(Uint8Array.from(bin, (c) => c.charCodeAt(0)))})` };
  } catch { return undefined; }
}


function SelectBox({ a, on, toggle, label }: { a: ViewAsset; on: boolean; toggle: (id: string) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} className={`${s.over} ${s.check}`}
      onClick={(e) => { e.stopPropagation(); toggle(a.id); }}>
      <span className={s.checkRing}>{on ? <Check size={14} strokeWidth={3} aria-hidden /> : null}</span>
    </button>
  );
}

/** Justified rows (justified-layout, MIT — docs/decisions/0001). Positions are logical, so RTL mirrors itself. */
function Justified({ items, selected, canSelect, selecting, avif, favs, onOpen, onToggle }: {
  items: ViewAsset[]; selected: Set<string>; canSelect: boolean; selecting: boolean; avif: boolean; favs: Set<string>; onOpen: (i: number) => void; onToggle: (id: string) => void;
}) {
  const t = useTranslations('portal');
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = useMemo(() => width ? justifiedLayout(items.map((a) => ({ width: a.w || 4, height: a.h || 3 })), {
    containerWidth: width, containerPadding: 0, boxSpacing: 8, targetRowHeight: width < 600 ? 130 : 240, targetRowHeightTolerance: 0.3,
  }) : null, [items, width]);
  return (
    <div ref={ref} className={`${s.grid} ${selecting ? s.selecting : ''}`} style={{ blockSize: layout?.containerHeight ?? 400 }} data-testid="photo-grid">
      {layout ? items.map((a, i) => {
        const b = layout.boxes[i]!;
        const on = selected.has(a.id);
        const sizes = `${Math.ceil(b.width)}px`;
        const grid = a.widths.filter((w) => w <= 1280);
        return (
          <div key={a.id} className={s.cell} data-asset-id={a.id} data-selected={on}
            style={{ position: 'absolute', insetBlockStart: b.top, insetInlineStart: b.left, inlineSize: b.width, blockSize: b.height }}>
            <button type="button" className={s.tile} style={{ inset: 0, ...bg(a.hash) }} data-selected={on} aria-label={a.name}
              onClick={() => (selecting && canSelect ? onToggle(a.id) : onOpen(i))}>
              <picture>
                {/* guests get watermarked copies only, which exist as WebP/JPEG */}
                {avif ? <source type="image/avif" srcSet={grid.map((w) => `/m/${a.id}/w${w}.avif ${w}w`).join(', ')} sizes={sizes} /> : null}
                <source type="image/webp" srcSet={grid.map((w) => `/m/${a.id}/w${w}.webp ${w}w`).join(', ')} sizes={sizes} />
                <img src={`/m/${a.id}/w640.jpg`} srcSet={grid.map((w) => `/m/${a.id}/w${w}.jpg ${w}w`).join(', ')} sizes={sizes} alt="" loading="lazy" decoding="async" />
              </picture>
              <span className={s.tileScrim} />
            </button>
            {favs.has(a.id) ? <span className={s.favBadge} data-testid="fav-badge" aria-label={t('fav.chip')}><Heart size={14} fill="currentColor" aria-hidden /></span> : null}
            {canSelect ? (
              <>
                <SelectBox a={a} on={on} toggle={onToggle} label={t('select', { name: a.name })} />
                <a className={`${s.over} ${s.dl}`} href={`/api/download/${a.id}`} download aria-label={t('download', { name: a.name })}>
                  <Download size={16} aria-hidden />
                </a>
              </>
            ) : null}
          </div>
        );
      }) : null}
    </div>
  );
}
