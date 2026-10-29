'use client';
import { closestCenter, DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, Download, ImageIcon, Star, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MediaTile, type TileAsset } from '@/components/media/MediaTile';
import { PhotoViewer } from '@/components/portal/PhotoViewer';
import type { ViewAsset } from '@/components/portal/ProjectView';
import { VideoPlayer } from '@/components/portal/VideoPlayer';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import type { Digits } from '@/lib/format';
import { AdminDialog } from './Dialog';
import { fetchJson } from './ProjectForm';
import { RowMenu } from './RowMenu';
import s from './admin.module.css';

export interface ManagedAsset extends TileAsset {
  view: ViewAsset;
  /** this staff member may delete it (admin; or own upload before publication) */
  deletable: boolean;
  favs: number;
}

/**
 * The project's media for the admin and the project's members: open large (photos in the lightbox, videos in the
 * player, arrows move between them), drag to reorder (the client sees this order), pick the cover, select many,
 * download the original, delete. Keyboard users reorder from each item's «⋯» (to the start, one step, to the end).
 */
export function MediaManager({ projectId, section, items, coverId, digits, canReorder }: {
  projectId: string; section: 'photos' | 'videos'; items: ManagedAsset[]; coverId: string | null; digits: Digits; canReorder: boolean;
}) {
  const t = useTranslations('admin.media');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [order, setOrder] = useState(() => items.map((a) => a.id));
  const [cover, setCover] = useState(coverId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const justDragged = useRef(0);

  // a fresh server list (after an upload, a delete, a refresh) replaces the local order (adjusted during render)
  const [seen, setSeen] = useState({ items, coverId });
  if (seen.items !== items || seen.coverId !== coverId) {
    setSeen({ items, coverId });
    if (seen.items !== items) { setOrder(items.map((a) => a.id)); setSelected(new Set()); }
    if (seen.coverId !== coverId) setCover(coverId);
  }

  const byId = useMemo(() => new Map(items.map((a) => [a.id, a])), [items]);
  const list = order.map((id) => byId.get(id)).filter((a): a is ManagedAsset => !!a);
  const openable = list.filter((a) => a.status === 'ready' && (section === 'videos' ? !!a.renditions.hls : a.view.widths.length > 0));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // a held finger drags; a quick swipe still scrolls the page
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  async function saveOrder(next: string[], before: string[]) {
    setOrder(next);
    const r = await fetchJson(`/api/admin/projects/${projectId}/order`, 'PUT', { section, ids: next });
    if (r.ok) { setNote({ kind: 'ok', text: t('orderSaved') }); return; }
    setOrder(before);
    setNote({ kind: 'error', text: r.data.error === 'stale_order' ? t('stale') : tc('error') });
    if (r.data.error === 'stale_order') router.refresh();
  }

  function move(ids: string[], where: 'start' | 'end' | 'up' | 'down') {
    const before = order;
    let next = [...order];
    if (where === 'start' || where === 'end') {
      const picked = order.filter((id) => ids.includes(id));
      const rest = order.filter((id) => !ids.includes(id));
      next = where === 'start' ? [...picked, ...rest] : [...rest, ...picked];
    } else {
      const i = order.indexOf(ids[0]!);
      const j = where === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= order.length) return;
      next = arrayMove(order, i, j);
    }
    void saveOrder(next, before);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    justDragged.current = Date.now();
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const before = order;
    void saveOrder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))), before);
  }

  async function makeCover(id: string | null) {
    const r = await fetchJson(`/api/admin/projects/${projectId}/cover`, 'PUT', { assetId: id });
    if (r.ok) { setCover(id); setNote({ kind: 'ok', text: id ? t('coverSet') : t('coverCleared') }); } else setNote({ kind: 'error', text: tc('error') });
  }

  async function remove(ids: string[]) {
    setBusy(true);
    const r = await postJson<{ deleted?: number; error?: string }>('/api/admin/assets/delete', { ids });
    setBusy(false);
    setConfirm(null);
    if (!r.ok) { setNote({ kind: 'error', text: r.data.error === 'forbidden' ? t('cannotDelete') : tc('error') }); return; }
    setNote({ kind: 'ok', text: t('deleted', { n: r.data.deleted ?? ids.length }) });
    setViewing(null);
    setSelected(new Set());
    router.refresh();
  }

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sel = [...selected];
  const selDeletable = sel.length > 0 && sel.every((id) => byId.get(id)?.deletable);

  const menuFor = (a: ManagedAsset) => {
    const i = order.indexOf(a.id);
    const ready = a.status === 'ready';
    return [
      ...(openable.some((x) => x.id === a.id) ? [{ id: 'open', label: t('open'), onAction: () => setViewing(a.id) }] : []),
      ...(section === 'photos' && ready
        ? [cover === a.id ? { id: 'uncover', label: t('uncover'), onAction: () => void makeCover(null) } : { id: 'cover', label: t('makeCover'), onAction: () => void makeCover(a.id) }]
        : []),
      ...(canReorder ? [
        'separator' as const, { header: t('moveHeader') },
        ...(i > 0 ? [{ id: 'start', label: t('toStart'), onAction: () => move([a.id], 'start') }, { id: 'up', label: t('stepUp'), onAction: () => move([a.id], 'up') }] : []),
        ...(i < order.length - 1 ? [{ id: 'down', label: t('stepDown'), onAction: () => move([a.id], 'down') }, { id: 'end', label: t('toEnd'), onAction: () => move([a.id], 'end') }] : []),
      ] : []),
      'separator' as const,
      { id: 'download', label: t('downloadOriginal'), onAction: () => download(a.id) },
      ...(a.deletable ? [{ id: 'delete', label: t('delete'), danger: true, onAction: () => setConfirm([a.id]) }] : []),
    ];
  };

  const viewIndex = viewing ? openable.findIndex((a) => a.id === viewing) : -1;
  const active = dragging ? byId.get(dragging) : null;

  return (
    <>
      {selected.size > 0 ? (
        <div className={s.selectionBar} role="region" aria-label={t('selection')} data-testid="media-selection">
          <strong>{t('selected', { n: selected.size })}</strong>
          {canReorder ? <Button variant="secondary" onPress={() => move(sel, 'start')}>{t('toStart')}</Button> : null}
          {selDeletable ? <Button variant="secondary" icon={<Trash2 size={16} />} onPress={() => setConfirm(sel)}>{t('delete')}</Button> : null}
          <button type="button" className={s.textBtn} onClick={() => setSelected(new Set(order))}>{t('selectAll')}</button>
          <button type="button" className={s.textBtn} onClick={() => setSelected(new Set())}>{t('clear')}</button>
        </div>
      ) : null}
      {note ? <p className={s.formMsg} data-kind={note.kind} role={note.kind === 'error' ? 'alert' : 'status'} style={{ margin: '0 0 8px' }}>{note.text}</p> : null}
      {canReorder && list.length > 1 ? <p className={`${s.small} ${s.muted}`} style={{ margin: '0 0 8px' }}>{t('dragHint')}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setDragging(String(e.active.id))} onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}>
        <SortableContext items={order} strategy={rectSortingStrategy} disabled={!canReorder}>
          <ul className={s.grid} style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="media-grid">
            {list.map((a) => (
              <SortableTile key={a.id} a={a} cover={cover === a.id} checked={selected.has(a.id)} onCheck={() => toggle(a.id)}
                coverLabel={t('cover')} checkLabel={t('select', { name: a.original_name })} menuLabel={`${tc('more')}: ${a.original_name}`}
                menu={menuFor(a)}
                onOpen={() => { if (Date.now() - justDragged.current > 250 && openable.some((x) => x.id === a.id)) setViewing(a.id); }} />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>{active ? <div className={s.dragGhost}><MediaTile a={active} /></div> : null}</DragOverlay>
      </DndContext>

      {viewIndex >= 0 && section === 'photos' ? (
        <PhotoViewer items={openable.map((a) => a.view)} index={viewIndex} canDownload digits={digits} onClose={() => setViewing(null)}
          onIndex={(i) => setViewing(openable[i]?.id ?? null)}
          extraButtons={(cur) => {
            const a = byId.get(cur.id);
            return [
              <button key="cover" type="button" className="yarl__button" aria-pressed={cover === cur.id} data-testid="viewer-cover"
                aria-label={cover === cur.id ? t('uncover') : t('makeCover')} title={cover === cur.id ? t('uncover') : t('makeCover')}
                onClick={() => void makeCover(cover === cur.id ? null : cur.id)}>
                <Star size={22} aria-hidden fill={cover === cur.id ? '#f5b301' : 'none'} color={cover === cur.id ? '#f5b301' : 'currentColor'} />
              </button>,
              ...(a?.deletable ? [
                <button key="delete" type="button" className="yarl__button" aria-label={t('delete')} title={t('delete')} data-testid="viewer-delete"
                  onClick={() => setConfirm([cur.id])}><Trash2 size={22} aria-hidden /></button>,
              ] : []),
            ];
          }} />
      ) : null}
      {viewIndex >= 0 && section === 'videos' ? (
        <VideoViewer items={openable} index={viewIndex} onIndex={(i) => setViewing(openable[i]!.id)} onClose={() => setViewing(null)}
          onDelete={(id) => setConfirm([id])} />
      ) : null}

      <AdminDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }} title={t('confirmTitle', { n: confirm?.length ?? 0 })}
        subtitle={t('confirmBody')} closeLabel={tc('close')} testId="delete-dialog">
        <div className={s.actions} style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onPress={() => setConfirm(null)}>{tc('cancel')}</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} isDisabled={busy} onPress={() => void remove(confirm ?? [])}>{t('confirmDelete', { n: confirm?.length ?? 0 })}</Button>
        </div>
      </AdminDialog>
    </>
  );
}

/** The original through the same download route the client uses (a 302 to a signed URL, named attachment). */
function download(id: string) {
  const link = document.createElement('a');
  link.href = `/api/download/${id}`;
  link.download = '';
  link.click();
}

function SortableTile({ a, cover, checked, onCheck, onOpen, menu, coverLabel, checkLabel, menuLabel }: {
  a: ManagedAsset; cover: boolean; checked: boolean; onCheck: () => void; onOpen: () => void;
  menu: Parameters<typeof RowMenu>[0]['entries']; coverLabel: string; checkLabel: string; menuLabel: string;
}) {
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({ id: a.id });
  return (
    <li ref={setNodeRef} data-asset-id={a.id} data-selected={checked || undefined} className={s.mTile}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      // pointer and touch only: keyboard users reorder from the «⋯» menu, so Enter and Space keep their meaning
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler<HTMLLIElement> | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler<HTMLLIElement> | undefined}>
      <button type="button" className={s.mOpen} onClick={onOpen} aria-label={a.original_name}>
        <MediaTile a={a} favs={a.favs} />
      </button>
      <label className={s.mCheck} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={checkLabel} value={a.id} />
      </label>
      {cover ? <span className={s.mCover}><ImageIcon size={12} aria-hidden />{coverLabel}</span> : null}
      <span className={s.mMenu} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <RowMenu label={menuLabel} entries={menu} />
      </span>
    </li>
  );
}

/** Videos large: the same player the client has, with previous/next and the admin's actions. Esc and the arrows work. */
function VideoViewer({ items, index, onIndex, onClose, onDelete }: {
  items: ManagedAsset[]; index: number; onIndex: (i: number) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations('admin.media');
  const tc = useTranslations('admin.common');
  const a = items[index]!;
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const go = (d: number) => { const j = index + d; if (j >= 0 && j < items.length) onIndex(j); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // arrows follow the reading direction: in Arabic «next» is on the left
      else if (e.key === 'ArrowLeft' && (e.target as HTMLElement).tagName !== 'INPUT') go(rtl ? 1 : -1);
      else if (e.key === 'ArrowRight' && (e.target as HTMLElement).tagName !== 'INPUT') go(rtl ? -1 : 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className={s.vViewer} role="dialog" aria-modal="true" aria-label={a.original_name} data-testid="video-viewer">
      <div className={s.vBar}>
        <span className={s.vName} dir="auto">{a.original_name}</span>
        <span className={s.vCount} dir="ltr">{index + 1} / {items.length}</span>
        <a className={s.vBtn} href={`/api/download/${a.id}`} aria-label={t('downloadOriginal')} title={t('downloadOriginal')}><Download size={20} aria-hidden /></a>
        {a.deletable ? <button type="button" className={s.vBtn} aria-label={t('delete')} title={t('delete')} onClick={() => onDelete(a.id)}><Trash2 size={20} aria-hidden /></button> : null}
        <button type="button" className={s.vBtn} aria-label={tc('close')} onClick={onClose} autoFocus><X size={22} aria-hidden /></button>
      </div>
      <div className={s.vStage}>
        <button type="button" className={`${s.vNav} ${s.vPrev}`} aria-label={t('prev')} disabled={index === 0} onClick={() => go(-1)}>
          <ChevronRight size={28} aria-hidden className={s.flip} />
        </button>
        <div className={s.vPlayer} key={a.id}>
          <VideoPlayer assetId={a.id} poster={`/m/${a.id}/poster`} duration={a.duration ?? 0} rungs={a.renditions.hls?.rungs ?? []} />
        </div>
        <button type="button" className={`${s.vNav} ${s.vNext}`} aria-label={t('next')} disabled={index === items.length - 1} onClick={() => go(1)}>
          <ChevronLeft size={28} aria-hidden className={s.flip} />
        </button>
      </div>
    </div>
  );
}
