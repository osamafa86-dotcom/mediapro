'use client';
import { ArrowDown, ArrowUp, Eye, Image as ImageIcon, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, StatusBadge, type ProjectStatus } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

export interface ArchiveItem {
  id: string; title: string; client: string; date: string; people: string; counts: string; size: string;
  status: string; statusLabel: string; link: { text: string; tone: 'muted' | 'warn' }; archived: boolean;
}

/*
 * Records table (financial-tables rules): P1 = project/client, date, size, status; P2 = people, counts,
 * link activity — folded into a second line under the title when the container is narrow; phone =
 * record list. Checkbox value is the row id, never its index. The selection bar replaces nothing:
 * it appears in the same toolbar when rows are selected.
 */
export function ArchiveTable({ items, summary, sort, sortHref, admin, archivedView, emptyFiltered, pager }: {
  items: ArchiveItem[]; summary: string; sort: 'date_desc' | 'date_asc'; sortHref: string; admin: boolean; archivedView: boolean;
  emptyFiltered: boolean; pager: { text: string; prev: string | null; next: string | null } | null;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [extendOpen, setExtendOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    router.refresh();
  }

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
      </div>
      {msg ? <p className={s.formMsg} data-kind="ok" role="status">{msg}</p> : null}
      <section className={`${s.card} ${s.tableWrap}`}>
        {emptyFiltered || items.length === 0 ? (
          <div className={s.emptyState} data-testid="archive-empty">
            <h2>{t('archive.empty')}</h2>
            <p>{t('archive.emptyHint')}</p>
          </div>
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
