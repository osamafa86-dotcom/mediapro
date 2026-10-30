'use client';
import { RotateCcw, RotateCw, Undo2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '@/components/ui';
import type { AssetEdit } from '@/db/schema';
import { fetchJson } from './ProjectForm';
import s from './admin.module.css';

const RATIOS = [['original', 0], ['1:1', 1], ['4:5', 4 / 5], ['3:2', 3 / 2], ['16:9', 16 / 9], ['9:16', 9 / 16]] as const;
type Rotate = AssetEdit['rotate'];

/**
 * Crop and rotate a photo. It draws from the picture as shot (`/m/<id>/source.webp`), so a second edit starts from
 * the original, not from the previous crop. Nothing is changed here: the save is a record, the worker renders it, and
 * «استعادة الأصل» renders the upload again.
 */
export function EditPhoto({ id, name, w, h, edit, onClose, onSaved }: {
  id: string; name: string; w: number; h: number; edit: AssetEdit | null; onClose: () => void; onSaved: (text: string) => void;
}) {
  const t = useTranslations('admin.media.edit');
  const tc = useTranslations('admin.common');
  const [rotate, setRotate] = useState<Rotate>(edit?.rotate ?? 0);
  const [ratio, setRatio] = useState<(typeof RATIOS)[number][0]>('original');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const area = useRef<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [media, setMedia] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // the picture's own shape after the turn: «original» keeps it
  const shown = media ?? { w: w || 3, h: h || 2 };
  const turned = rotate % 180 ? { w: shown.h, h: shown.w } : shown;
  const aspect = ratio === 'original' ? turned.w / turned.h : RATIOS.find((r) => r[0] === ratio)![1];
  const turn = (d: 90 | -90) => { setRotate((r) => (((r + d) % 360) + 360) % 360 as Rotate); setCrop({ x: 0, y: 0 }); setZoom(1); };

  async function save(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const r = await fetchJson(`/api/admin/assets/${id}/edit`, 'PUT', body);
    setBusy(false);
    if (!r.ok) { setErr(r.data.error === 'not_editable' ? t('notEditable') : tc('error')); return; }
    onSaved('reset' in body ? t('resetQueued') : t('queued'));
  }

  function apply() {
    const a = area.current;
    // the whole picture is no crop at all (the original shape, not zoomed)
    const whole = !a || (ratio === 'original' && zoom <= 1.001) || (a.width >= 99.9 && a.height >= 99.9);
    const c = whole ? null : {
      x: Math.max(0, a.x / 100), y: Math.max(0, a.y / 100), w: Math.min(1, a.width / 100), h: Math.min(1, a.height / 100),
    };
    if (!c && !rotate && !edit) { onClose(); return; }
    void save({ rotate, crop: c });
  }

  return (
    <div className={s.eDialog} role="dialog" aria-modal="true" aria-label={t('title', { name })} data-testid="edit-dialog">
      <div className={s.vBar}>
        <span className={s.eTitle}>{t('titleShort')} <bdi className={s.mono} dir="auto">{name}</bdi></span>
        <button type="button" className={s.vBtn} aria-label={tc('close')} onClick={onClose}><X size={22} aria-hidden /></button>
      </div>
      <div className={s.eStage}>
        <Cropper image={`/m/${id}/source.webp`} crop={crop} zoom={zoom} rotation={rotate} aspect={aspect} minZoom={1} maxZoom={6}
          objectFit="contain" onCropChange={setCrop} onZoomChange={setZoom}
          onMediaLoaded={(m) => setMedia({ w: m.naturalWidth, h: m.naturalHeight })}
          onCropComplete={(a) => { area.current = a; }}
          initialCroppedAreaPercentages={edit?.crop && edit.rotate === rotate
            ? { x: edit.crop.x * 100, y: edit.crop.y * 100, width: edit.crop.w * 100, height: edit.crop.h * 100 } : undefined} />
      </div>
      <div className={s.eTools}>
        <div className={s.eRow}>
          <button type="button" className={s.eTool} onClick={() => turn(-90)} aria-label={t('rotateLeft')} title={t('rotateLeft')} data-testid="rotate-left"><RotateCcw size={20} aria-hidden /></button>
          <button type="button" className={s.eTool} onClick={() => turn(90)} aria-label={t('rotateRight')} title={t('rotateRight')} data-testid="rotate-right"><RotateCw size={20} aria-hidden /></button>
          <label className={s.eZoom}>
            <span>{t('zoom')}</span>
            <input type="range" min={1} max={6} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t('zoom')} />
          </label>
        </div>
        <div className={s.eRow} role="group" aria-label={t('ratio')}>
          {RATIOS.map(([k]) => (
            <button key={k} type="button" className={s.eChip} aria-pressed={ratio === k} onClick={() => { setRatio(k); setCrop({ x: 0, y: 0 }); setZoom(1); }}>
              {k === 'original' ? t('original') : <bdi dir="ltr">{k}</bdi>}
            </button>
          ))}
        </div>
        {err ? <p className={s.formMsg} data-kind="error" role="alert" style={{ color: '#ff8a80' }}>{err}</p> : null}
        <div className={s.eRow} style={{ justifyContent: 'space-between' }}>
          {edit && (edit.rotate || edit.crop) ? (
            <Button variant="ghost" className={s.eGhost} icon={<Undo2 size={16} />} isDisabled={busy} onPress={() => void save({ reset: true })}>{t('reset')}</Button>
          ) : <span />}
          <span className={s.actions}>
            <Button variant="ghost" className={s.eGhost} onPress={onClose}>{tc('cancel')}</Button>
            <Button variant="primary" isDisabled={busy} onPress={apply}>{t('save')}</Button>
          </span>
        </div>
        <p className={s.eNote}>{t('note')}</p>
      </div>
    </div>
  );
}
