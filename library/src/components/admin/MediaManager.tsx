'use client';
import { closestCenter, DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Crop, Download, FolderInput, ImageIcon, Loader, Star, Trash2, TriangleAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HoverVideo, hoverHandlers } from '@/components/media/HoverVideo';
import { MediaTile, type TileAsset } from '@/components/media/MediaTile';
import { PhotoViewer } from '@/components/portal/PhotoViewer';
import type { ViewAsset } from '@/components/portal/ProjectView';
import { VideoPlayer } from '@/components/portal/VideoPlayer';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import type { Digits } from '@/lib/format';
import type { AssetEdit } from '@/db/schema';
import { AdminDialog } from './Dialog';
import { EditPhoto } from './EditPhoto';
import { fetchJson } from './ProjectForm';
import { RowMenu } from './RowMenu';
import s from './admin.module.css';

export interface ManagedAsset extends TileAsset {
  view: ViewAsset;
  /** this staff member may delete it (admin; or own upload before publication) */
  deletable: boolean;
  favs: number;
  edit: AssetEdit | null;
}

/**
 * The project's media for the admin and the project's members, the way Photos on the iPhone works: a tap opens
 * the item large (photos in the lightbox, videos in the player); a long press lifts it — move the finger to drag it
 * elsewhere (the client sees this order), let go without moving for its menu; a right click opens the menu too.
 * «تحديد» switches the grid to selecting (a tap ticks), with the bulk actions. Keyboard users reorder from «⋯».
 */
export function MediaManager({ projectId, section, albumId = null, albums = [], items, coverId, digits, canReorder }: {
  projectId: string; section: 'photos' | 'videos'; items: ManagedAsset[]; coverId: string | null; digits: Digits; canReorder: boolean;
  /** an album tab: every file in it, photos and videos together (`section` is then only the fallback for the order call) */
  albumId?: string | null;
  /** where «نقل إلى…» can send files: the project's albums (the main sections are always offered) */
  albums?: { id: string; name: string }[];
}) {
  const t = useTranslations('admin.media');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [order, setOrder] = useState(() => items.map((a) => a.id));
  const [cover, setCover] = useState(coverId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // the videos tab: tall 9:16 tiles, 3–4 to a row — most footage is shot upright now (the owner, 2026-10-30)
  const portrait = section === 'videos' && !albumId;
  const [dragging, setDragging] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const justDragged = useRef(0);
  const pending = items.some((a) => a.edit?.state === 'pending');
  // an edit renders in the worker: look again every few seconds until it is swapped in
  useEffect(() => {
    if (!pending) return;
    const i = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(i);
  }, [pending, router]);

  // a fresh server list (after an upload, a delete, a refresh) replaces the local order (adjusted during render)
  const [seen, setSeen] = useState({ items, coverId });
  if (seen.items !== items || seen.coverId !== coverId) {
    setSeen({ items, coverId });
    if (seen.items !== items) { setOrder(items.map((a) => a.id)); setSelected(new Set()); }
    if (seen.coverId !== coverId) setCover(coverId);
  }

  const byId = useMemo(() => new Map(items.map((a) => [a.id, a])), [items]);
  const list = order.map((id) => byId.get(id)).filter((a): a is ManagedAsset => !!a);
  const openable = list.filter((a) => a.status === 'ready' && (a.section === 'videos' ? !!a.renditions.hls : a.view.widths.length > 0));
  // in an album photos and videos sit together: the photo viewer pages through the photos, the player through the videos
  const openPhotos = openable.filter((a) => a.section === 'photos');
  const openVideos = openable.filter((a) => a.section === 'videos');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // a held finger lifts the item (then drag, or let go for the menu); a quick swipe still scrolls the page
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );

  async function saveOrder(next: string[], before: string[]) {
    setOrder(next);
    const r = await fetchJson(`/api/admin/projects/${projectId}/order`, 'PUT', { section, albumId, ids: next });
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
    const { active, over, delta } = e;
    // a long press let go where it started: the item's menu, as on the iPhone
    if (Math.hypot(delta.x, delta.y) < 10 && typeof TouchEvent !== 'undefined' && e.activatorEvent instanceof TouchEvent) {
      setMenuOpen(String(active.id));
      return;
    }
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

  async function moveTo(ids: string[], target: string | null) {
    setBusy(true);
    const r = await postJson<{ moved?: number }>('/api/admin/assets/move', { ids, albumId: target });
    setBusy(false);
    setMoving(null);
    if (!r.ok) { setNote({ kind: 'error', text: tc('error') }); return; }
    const where = target ? albums.find((x) => x.id === target)?.name ?? '' : t('mainSections');
    setNote({ kind: 'ok', text: t('moved', { n: r.data.moved ?? ids.length, where }) });
    setSelected(new Set());
    setSelecting(false);
    router.refresh();
  }

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sel = [...selected];
  const selDeletable = sel.length > 0 && sel.every((id) => byId.get(id)?.deletable);

  const editable = (a: ManagedAsset) => canReorder && a.section === 'photos' && a.status === 'ready' && a.view.group !== 'raw' && a.view.widths.length > 0;
  const menuFor = (a: ManagedAsset) => {
    const i = order.indexOf(a.id);
    const ready = a.status === 'ready';
    return [
      ...(openable.some((x) => x.id === a.id) ? [{ id: 'open', label: t('open'), onAction: () => setViewing(a.id) }] : []),
      ...(editable(a) ? [{ id: 'edit', label: t('edit.menu'), onAction: () => setEditing(a.id) }] : []),
      { id: 'select', label: t('selectThis'), onAction: () => { setSelecting(true); setSelected((p) => new Set(p).add(a.id)); } },
      ...(a.section === 'photos' && ready
        ? [cover === a.id ? { id: 'uncover', label: t('uncover'), onAction: () => void makeCover(null) } : { id: 'cover', label: t('makeCover'), onAction: () => void makeCover(a.id) }]
        : []),
      ...(canReorder ? [
        'separator' as const, { header: t('moveHeader') },
        ...(i > 0 ? [{ id: 'start', label: t('toStart'), onAction: () => move([a.id], 'start') }, { id: 'up', label: t('stepUp'), onAction: () => move([a.id], 'up') }] : []),
        ...(i < order.length - 1 ? [{ id: 'down', label: t('stepDown'), onAction: () => move([a.id], 'down') }, { id: 'end', label: t('toEnd'), onAction: () => move([a.id], 'end') }] : []),
      ] : []),
      ...(canReorder ? ['separator' as const, { id: 'move', label: t('moveTo'), onAction: () => setMoving([a.id]) }] : []),
      'separator' as const,
      { id: 'download', label: t('downloadOriginal'), onAction: () => download(a.id) },
      ...(a.deletable ? [{ id: 'delete', label: t('delete'), danger: true, onAction: () => setConfirm([a.id]) }] : []),
    ];
  };

  const viewingKind = viewing ? byId.get(viewing)?.section : undefined;
  const viewIndex = viewing ? (viewingKind === 'videos' ? openVideos : openPhotos).findIndex((a) => a.id === viewing) : -1;
  const active = dragging ? byId.get(dragging) : null;

  return (
    <>
      {selecting ? (
        <div className={s.selectionBar} role="region" aria-label={t('selection')} data-testid="media-selection">
          <strong>{selected.size ? t('selected', { n: selected.size }) : t('pickItems')}</strong>
          {canReorder && sel.length ? <Button variant="secondary" onPress={() => move(sel, 'start')}>{t('toStart')}</Button> : null}
          {canReorder && sel.length ? <Button variant="secondary" icon={<FolderInput size={16} />} onPress={() => setMoving(sel)} data-testid="move-selected">{t('moveTo')}</Button> : null}
          {selDeletable ? <Button variant="secondary" icon={<Trash2 size={16} />} onPress={() => setConfirm(sel)}>{t('delete')}</Button> : null}
          <button type="button" className={s.textBtn} onClick={() => setSelected(selected.size === order.length ? new Set() : new Set(order))}>
            {selected.size === order.length ? t('clear') : t('selectAll')}
          </button>
          <Button variant="primary" className={s.selDone} onPress={() => { setSelecting(false); setSelected(new Set()); }}>{t('done')}</Button>
        </div>
      ) : (
        <div className={s.mBar}>
          {canReorder && list.length > 1 ? <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{t('dragHint')}</p> : <span />}
          <Button variant="secondary" onPress={() => setSelecting(true)} data-testid="select-mode">{t('selectMode')}</Button>
        </div>
      )}
      {note ? <p className={s.formMsg} data-kind={note.kind} role={note.kind === 'error' ? 'alert' : 'status'} style={{ margin: '0 0 8px' }}>{note.text}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setDragging(String(e.active.id))} onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}>
        <SortableContext items={order} strategy={rectSortingStrategy} disabled={!canReorder}>
          <ul className={s.grid} style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="media-grid" data-selecting={selecting || undefined}
            data-portrait={portrait || undefined}>
            {list.map((a) => (
              <SortableTile key={a.id} a={a} cover={cover === a.id} checked={selected.has(a.id)} onCheck={() => toggle(a.id)} selecting={selecting}
                menuOpen={menuOpen === a.id} onMenuOpenChange={(o) => setMenuOpen(o ? a.id : null)}
                coverLabel={t('cover')} checkLabel={t('select', { name: a.original_name })} menuLabel={`${tc('more')}: ${a.original_name}`}
                editLabels={{ pending: t('edit.pending'), failed: t('edit.failed') }}
                menu={menuFor(a)}
                preview={a.section === 'videos' && !!a.renditions.hls && !selecting && hovered === a.id} portrait={portrait}
                hover={hoverHandlers(a.id, setHovered)}
                onOpen={() => {
                  if (Date.now() - justDragged.current < 250) return;
                  if (selecting) { toggle(a.id); return; }
                  if (openable.some((x) => x.id === a.id)) setViewing(a.id);
                  else setNote({ kind: 'ok', text: t(a.status === 'failed' ? 'notOpenableFailed' : 'notOpenableYet') });
                }} />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>{active ? <div className={s.dragGhost}><MediaTile a={active} /></div> : null}</DragOverlay>
      </DndContext>

      {viewIndex >= 0 && viewingKind === 'photos' ? (
        <PhotoViewer items={openPhotos.map((a) => a.view)} index={viewIndex} canDownload digits={digits} onClose={() => setViewing(null)}
          onIndex={(i) => setViewing(openPhotos[i]?.id ?? null)}
          extraButtons={(cur) => {
            const a = byId.get(cur.id);
            return [
              ...(a && editable(a) ? [
                <button key="edit" type="button" className="yarl__button" aria-label={t('edit.menu')} title={t('edit.menu')} data-testid="viewer-edit"
                  onClick={() => { setViewing(null); setEditing(cur.id); }}><Crop size={22} aria-hidden /></button>,
              ] : []),
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
      {viewIndex >= 0 && viewingKind === 'videos' ? (
        <VideoViewer items={openVideos} index={viewIndex} onIndex={(i) => setViewing(openVideos[i]!.id)} onClose={() => setViewing(null)}
          onDelete={(id) => setConfirm([id])} />
      ) : null}

      {editing && byId.get(editing) ? (() => {
        const a = byId.get(editing)!;
        return (
          <EditPhoto id={a.id} name={a.original_name} w={a.view.w} h={a.view.h} edit={a.edit} onClose={() => setEditing(null)}
            onSaved={(text) => { setEditing(null); setNote({ kind: 'ok', text }); router.refresh(); }} />
        );
      })() : null}

      <AdminDialog open={!!moving} onOpenChange={(o) => { if (!o) setMoving(null); }} title={t('moveTitle', { n: moving?.length ?? 0 })}
        subtitle={t('moveBody')} closeLabel={tc('close')} testId="move-dialog">
        <ul className={s.moveList}>
          {albumId ? (
            <li><button type="button" disabled={busy} onClick={() => void moveTo(moving ?? [], null)}><ImageIcon size={18} aria-hidden />{t('mainSections')}</button></li>
          ) : null}
          {albums.filter((x) => x.id !== albumId).map((x) => (
            <li key={x.id}><button type="button" disabled={busy} onClick={() => void moveTo(moving ?? [], x.id)}><FolderInput size={18} aria-hidden /><bdi>{x.name}</bdi></button></li>
          ))}
        </ul>
        {!albums.some((x) => x.id !== albumId) && !albumId ? <p className={`${s.small} ${s.muted}`}>{t('noAlbums')}</p> : null}
      </AdminDialog>

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

function SortableTile({ a, cover, checked, onCheck, onOpen, menu, coverLabel, checkLabel, menuLabel, editLabels, selecting, menuOpen, onMenuOpenChange, preview, portrait, hover }: {
  a: ManagedAsset; cover: boolean; checked: boolean; onCheck: () => void; onOpen: () => void;
  /** play the silent hover preview now */ preview: boolean; portrait: boolean; hover: ReturnType<typeof hoverHandlers>;
  menu: Parameters<typeof RowMenu>[0]['entries']; coverLabel: string; checkLabel: string; menuLabel: string;
  editLabels: { pending: string; failed: string }; selecting: boolean; menuOpen: boolean; onMenuOpenChange: (o: boolean) => void;
}) {
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({ id: a.id, disabled: selecting });
  return (
    <li ref={setNodeRef} data-asset-id={a.id} data-selected={checked || undefined} className={s.mTile}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      // pointer and touch only: keyboard users reorder from the «⋯» menu, so Enter and Space keep their meaning
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler<HTMLLIElement> | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler<HTMLLIElement> | undefined}
      onContextMenu={(e) => { if (selecting) return; e.preventDefault(); onMenuOpenChange(true); }} {...hover}>
      <button type="button" className={s.mOpen} onClick={onOpen} aria-label={selecting ? checkLabel : a.original_name} aria-pressed={selecting ? checked : undefined}>
        <MediaTile a={a} favs={a.favs} sizes={portrait ? '(max-width: 700px) 34vw, 260px' : undefined}>
          {a.section === 'videos' ? (
            <HoverVideo assetId={a.id} active={preview && !isDragging} fit={portrait && orientOf(a) === 'landscape' ? 'contain' : 'cover'} />
          ) : null}
        </MediaTile>
      </button>
      {selecting ? (
        <span className={s.mTick} aria-hidden data-on={checked || undefined}>{checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}</span>
      ) : null}
      <input type="checkbox" className="sr-only" tabIndex={-1} checked={checked} onChange={onCheck} aria-hidden value={a.id} />
      {cover ? <span className={s.mCover}><ImageIcon size={12} aria-hidden />{coverLabel}</span> : null}
      {a.edit?.state === 'pending' ? <span className={s.mEdit} data-state="pending" role="status"><Loader size={14} aria-hidden className={s.spin} />{editLabels.pending}</span> : null}
      {a.edit?.state === 'failed' ? <span className={s.mEdit} data-state="failed" title={a.edit.error}><TriangleAlert size={14} aria-hidden />{editLabels.failed}</span> : null}
      {selecting ? null : (
        <span className={s.mMenu} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <RowMenu label={menuLabel} entries={menu} isOpen={menuOpen} onOpenChange={onMenuOpenChange} />
        </span>
      )}
    </li>
  );
}

/** From the poster's size: a wide frame is letterboxed in a tall tile, never cropped. */
const orientOf = (a: TileAsset) => { const i = a.renditions.images?.at(-1); return i?.h && i.w > i.h ? 'landscape' : 'portrait'; };

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
