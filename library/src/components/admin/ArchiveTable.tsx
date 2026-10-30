'use client';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Eye, Image as ImageIcon, LayoutGrid, List, MoreHorizontal, Play, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, StatusBadge, type ProjectStatus } from '@/components/ui';
import { ARCHIVE_VIEW_COOKIE, type ArchiveView } from '@/lib/archive-view';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

export interface ArchiveItem {
  id: string; title: string; client: string; date: string; people: string; counts: string; size: string;
  status: string; statusLabel: string; link: { text: string; tone: 'muted' | 'warn' }; archived: boolean;
  photos: string; videos: string; hasPhotos: boolean; hasVideos: boolean;
  /** the album's face: a ready photo, or a video's poster; `bg` is its ThumbHash placeholder */
  cover: { id: string; kind: 'photos' | 'videos'; bg?: string } | null;
}


/*
 * Records table (financial-tables rules): P1 = project/client, date, size, status; P2 = people, counts,
 * link activity — folded into a second line under the title when the container is narrow; phone =
 * record list. Checkbox value is the row id, never its index. The selection bar replaces nothing:
 * it appears in the same toolbar when rows are selected.
 */
export function ArchiveTable({ items, summary, sort, sortHref, admin, archivedView, emptyFiltered, pager, view, viewHref }: {
  items: ArchiveItem[]; summary: string; sort: 'date_desc' | 'date_asc'; sortHref: string; admin: boolean; archivedView: boolean;
  emptyFiltered: boolean; pager: { text: string; prev: string | null; next: string | null } | null;
  view: ArchiveView; viewHref: Record<ArchiveView, string>;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [extendOpen, setExtendOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // albums open on a tap, like Photos; «تحديد» turns a tap into a pick
  const [selecting, setSelecting] = useState(false);
  const allOn = items.length > 0 && items.every((i) => sel.has(i.id));
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(action: 'publish' | 'extend' | 'archive' | 'unarchive', extra: Record<string, unknown> = {}) {
    setBusy(true); setMsg(null);
    const r = await postJson<{ changed?: number }>('/api/admin/projects/bulk', { ids: [...sel], action, ...extra });
    setBusy(false);
    if (!r.ok) { setMsg(t('common.error')); return; }
    const n = r.data.changed ?? 0;
    setMsg(t('archive.changed', { n }) + (action === 'publish' && n < sel.size ? ` ${t('archive.publishSkipped')}` : ''));
    setSel(new Set());
    setSelecting(false);
    router.refresh();
  }
  // the choice outlives the visit: the page reads it when the address names no view
  const remember = (v: ArchiveView) => { document.cookie = `${ARCHIVE_VIEW_COOKIE}=${v}; path=/admin; max-age=31536000; samesite=lax`; };
  const empty = emptyFiltered || items.length === 0;

  return (
    <>
      <div className={s.tableBar}>
        <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }} data-testid="archive-summary">{summary}</p>
        {sel.size > 0 ? (
          <div className={s.selBar} role="toolbar" aria-label={t('archive.selected', { n: sel.size })} data-testid="selection-bar">
            <span>{t('archive.selected', { n: sel.size })}</span>
            {archivedView ? <button type="button" disabled={busy} onClick={() => void bulk('unarchive')}>{t('archive.unarchive')}</button> : (
              <>
                <button type="button" disabled={busy} onClick={() => void bulk('publish')}>{t('archive.publish')}</button>
                <button type="button" disabled={busy} onClick={() => setExtendOpen(true)}>{t('archive.extend')}</button>
                <button type="button" disabled={busy} onClick={() => void bulk('archive')}>{t('archive.archive')}</button>
              </>
            )}
            <button type="button" onClick={() => setSel(new Set())}>{t('archive.clearSelection')}</button>
          </div>
        ) : null}
        <span className={s.barEnd}>
          {admin && view === 'cards' && !empty ? (
            selecting ? (
              <>
                <button type="button" className={s.btnLink} onClick={() => setSel(allOn ? new Set() : new Set(items.map((i) => i.id)))}>{allOn ? t('archive.clearSelection') : t('media.selectAll')}</button>
                <button type="button" className={s.btnSecondary} onClick={() => { setSelecting(false); setSel(new Set()); }} data-testid="select-done">{t('media.done')}</button>
              </>
            ) : <button type="button" className={s.btnSecondary} onClick={() => setSelecting(true)} data-testid="archive-select">{t('media.selectMode')}</button>
          ) : null}
          <span className={s.segmented} role="group" aria-label={t('archive.view.label')}>
            <Link href={viewHref.cards} scroll={false} aria-current={view === 'cards' ? 'true' : undefined} aria-label={t('archive.view.cards')} title={t('archive.view.cards')}
              onClick={() => remember('cards')} data-testid="view-cards"><LayoutGrid size={16} aria-hidden /></Link>
            <Link href={viewHref.table} scroll={false} aria-current={view === 'table' ? 'true' : undefined} aria-label={t('archive.view.table')} title={t('archive.view.table')}
              onClick={() => remember('table')} data-testid="view-table"><List size={16} aria-hidden /></Link>
          </span>
        </span>
      </div>
      {msg ? <p className={s.formMsg} data-kind="ok" role="status">{msg}</p> : null}
      <section className={view === 'cards' && !empty ? s.albumsWrap : `${s.card} ${s.tableWrap}`}>
        {empty ? (
          <div className={s.emptyState} data-testid="archive-empty">
            <h2>{t('archive.empty')}</h2>
            <p>{t('archive.emptyHint')}</p>
          </div>
        ) : view === 'cards' ? (
          <ul className={s.albums} data-testid="archive-cards" aria-label={t('nav.archive')}>
            {items.map((it) => {
              const on = sel.has(it.id);
              const body = (
                <>
                  <span className={s.albumCover} style={it.cover?.bg ? { backgroundImage: `url(${it.cover.bg})` } : undefined}>
                    {it.cover ? (
                      it.cover.kind === 'photos' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/m/${it.cover.id}/w640.webp`} srcSet={`/m/${it.cover.id}/w640.webp 640w, /m/${it.cover.id}/w1280.webp 1280w`}
                          sizes="(max-width: 700px) 100vw, 360px" alt="" loading="lazy" decoding="async" />
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/m/${it.cover.id}/poster`} alt="" loading="lazy" decoding="async" />
                          <span className={s.albumPlay} aria-hidden><Play size={18} /></span>
                        </>
                      )
                    ) : <span className={s.albumNone} aria-hidden><ImageIcon size={28} /></span>}
                    {it.hasPhotos || it.hasVideos ? (
                      <span className={s.albumCounts}>
                        {it.hasPhotos ? <span><ImageIcon size={13} aria-hidden /><bdi dir="ltr">{it.photos}</bdi><span className="sr-only">{t('archive.cards.photos')}</span></span> : null}
                        {it.hasVideos ? <span><Video size={13} aria-hidden /><bdi dir="ltr">{it.videos}</bdi><span className="sr-only">{t('archive.cards.videos')}</span></span> : null}
                      </span>
                    ) : null}
                    {selecting ? <span className={s.albumTick} data-on={on || undefined} aria-hidden>{on ? <CheckCircle2 size={24} /> : <Circle size={24} />}</span> : null}
                  </span>
                  <span className={s.albumTitle}>{it.title}</span>
                  <span className={s.albumMeta}><bdi>{it.client}</bdi>{it.date !== '—' ? <><span aria-hidden>·</span><bdi className={s.num}>{it.date}</bdi></> : null}</span>
                  <span className={s.albumFoot}>
                    <StatusBadge status={it.status as ProjectStatus} label={it.statusLabel} />
                    <span className={`${s.albumLink} ${it.link.tone === 'warn' ? s.linkWarn : ''}`}>{it.link.text}</span>
                  </span>
                </>
              );
              return (
                <li key={it.id} data-id={it.id} data-selected={on || undefined}>
                  {selecting ? (
                    <button type="button" className={s.album} aria-pressed={on} aria-label={`${t('archive.col.select')}: ${it.title}`} onClick={() => toggle(it.id)}>{body}</button>
                  ) : (
                    <Link href={`/admin/projects/${it.id}`} className={s.album}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <table className={s.table} data-testid="archive-table">
            <caption>{t('nav.archive')}</caption>
            <thead>
              <tr>
                {admin ? <th scope="col" className={s.check}><input type="checkbox" className={s.checkbox} aria-label={t('archive.col.select')} checked={allOn}
                  onChange={() => setSel(allOn ? new Set() : new Set(items.map((i) => i.id)))} /></th> : null}
                <th scope="col">{t('archive.col.project')}</th>
                <th scope="col" aria-sort={sort === 'date_asc' ? 'ascending' : 'descending'}>
                  <Link href={sortHref} className={s.sortBtn} scroll={false}>{t('archive.col.date')}{sort === 'date_asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}</Link>
                </th>
                <th scope="col" data-p="2">{t('archive.col.people')}</th>
                <th scope="col" data-p="2" className={s.numCol}>{t('archive.col.counts')}</th>
                <th scope="col" className={s.numCol}>{t('archive.col.size')}</th>
                <th scope="col">{t('archive.col.status')}</th>
                <th scope="col" data-p="2">{t('archive.col.link')}</th>
                <th scope="col" className={s.menuCol}><span className="sr-only">{t('archive.col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} data-id={it.id} data-selected={sel.has(it.id) || undefined}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button,input,label')) router.push(`/admin/projects/${it.id}`); }}>
                  {admin ? (
                    <td className={s.check}>
                      <input type="checkbox" className={s.checkbox} value={it.id} checked={sel.has(it.id)} onChange={() => toggle(it.id)}
                        aria-label={`${t('archive.col.select')}: ${it.title}`} />
                    </td>
                  ) : null}
                  <td data-col="project">
                    <div className={s.projectCell}>
                      <span className={`${s.thumb} ${s.thumbSm}`} aria-hidden><ImageIcon size={16} /></span>
                      <span className={s.projectText}>
                        <Link href={`/admin/projects/${it.id}`}>{it.title}</Link>
                        <span className={s.clientLine}>{it.client}</span>
                        <span className={s.p2Line}><bdi>{it.client}</bdi> · {it.people} · <bdi dir="ltr">{it.counts}</bdi> · {it.link.text}</span>
                      </span>
                    </div>
                  </td>
                  <td data-col="date" className={s.num}>{it.date}</td>
                  <td data-col="people" data-p="2">{it.people}</td>
                  <td data-col="counts" data-p="2" className={s.numCol}><bdi dir="ltr">{it.counts}</bdi></td>
                  <td data-col="size" className={`${s.numCol} ${s.sizeCell}`}><bdi dir="ltr">{it.size}</bdi></td>
                  <td data-col="status"><StatusBadge status={it.status as ProjectStatus} label={it.statusLabel} /></td>
                  <td data-col="link" data-p="2"><span className={`${s.linkCell} ${it.link.tone === 'warn' ? s.linkWarn : ''}`}><Eye size={14} aria-hidden />{it.link.text}</span></td>
                  <td className={s.menuCol}>
                    <Link href={`/admin/projects/${it.id}`} aria-label={`${t('common.more')}: ${it.title}`} className={s.rowMenu}><MoreHorizontal size={18} aria-hidden /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pager ? (
          <nav className={s.pager} aria-label={pager.text}>
            <span>{pager.text}</span>
            <span className={s.actions}>
              {pager.prev ? <Link href={pager.prev}>{t('archive.prev')}</Link> : null}
              {pager.next ? <Link href={pager.next}>{t('archive.next')}</Link> : null}
            </span>
          </nav>
        ) : null}
      </section>
      <AdminDialog open={extendOpen} onOpenChange={setExtendOpen} title={t('archive.extendTitle')} subtitle={t('archive.extendBody')} closeLabel={t('common.close')}>
        <div className={s.segmented} role="group" aria-label={t('archive.extendTitle')}>
          {[7, 14, 30, 90, 180].map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{t('archive.days', { n: d })}</button>)}
        </div>
        <div className={s.actions}>
          <Button variant="primary" isDisabled={busy} onPress={async () => { setExtendOpen(false); await bulk('extend', { days }); }}>{t('archive.extend')}</Button>
        </div>
      </AdminDialog>
    </>
  );
}
