'use client';
import { Check, SendHorizontal, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { postJson } from '@/lib/client/api';
import { clock } from '@/lib/clock';
import { formatRelative } from '@/lib/format';
import s from './notes.module.css';

export interface ClientNote {
  id: string; n: number; author: string; body: string; anchor: 'pin' | 'time' | null; x: number | null; y: number | null; t: number | null;
  status: 'open' | 'in_progress' | 'resolved'; createdAt: string; fromClient: boolean;
  replies: { id: string; author: string; body: string; createdAt: string; fromClient: boolean }[];
}

/**
 * The notes of one photo or video (DESIGN «الإصدار الثاني»): numbered like their pins, the team's replies
 * under each, states as words (never colour alone). A photo note can carry a pin; a video note is pinned
 * to the moment being played when it is written.
 */
export function NotesPanel({ assetId, kind, pin, onClearPin, time, onJump, onNotes, onClose }: {
  assetId: string; kind: 'photo' | 'video';
  pin?: { x: number; y: number } | null; onClearPin?: () => void;
  time?: number; onJump?: (t: number) => void;
  onNotes?: (notes: ClientNote[]) => void; onClose?: () => void;
}) {
  const t = useTranslations('portal.notes');
  const locale = useLocale() as Locale;
  const [notes, setNotes] = useState<ClientNote[] | null>(null);
  const [all, setAll] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void fetch(`/api/notes?assetId=${assetId}`, { credentials: 'same-origin' }).then((r) => r.json()).then((j: { notes?: ClientNote[] }) => {
      if (!live) return;
      setNotes(j.notes ?? []);
      onNotes?.(j.notes ?? []);
    }).catch(() => { if (live) setNotes([]); });
    return () => { live = false; };
  }, [assetId, version, onNotes]);

  const open = (notes ?? []).filter((n) => n.status !== 'resolved');
  const shown = all ? notes ?? [] : open;
  const resolved = (notes?.length ?? 0) - open.length;

  async function send() {
    if (!text.trim()) return;
    setBusy(true); setError(false);
    const body: Record<string, unknown> = { assetId, body: text.trim() };
    if (kind === 'photo' && pin) { body.x = pin.x; body.y = pin.y; }
    if (kind === 'video' && time != null) body.t = Math.round(time * 10) / 10;
    const r = await postJson('/api/notes', body, 'vcsrf');
    setBusy(false);
    if (!r.ok) { setError(true); return; }
    setText(''); onClearPin?.(); setVersion((v) => v + 1);
  }

  return (
    <section className={s.panel} aria-label={t(kind === 'photo' ? 'titlePhoto' : 'titleVideo')} data-testid="notes-panel">
      <header className={s.head}>
        <h2>{t(kind === 'photo' ? 'titlePhoto' : 'titleVideo')}</h2>
        <span className={s.meta}>{t('count', { n: notes?.length ?? 0 })}{resolved ? ` · ${t('resolvedN', { n: resolved })}` : ''} · {t('who')}</span>
        {onClose ? <button type="button" className={s.close} aria-label={t('open')} onClick={onClose}><X size={16} aria-hidden /></button> : null}
      </header>
      {resolved ? (
        <div className={s.filters} role="group">
          <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>{t('filterOpen')} · {open.length}</button>
          <button type="button" aria-pressed={all} onClick={() => setAll(true)}>{t('filterAll')} · {notes?.length ?? 0}</button>
        </div>
      ) : null}
      <ol className={s.list}>
        {notes && shown.length === 0 ? <li className={s.empty}>{t('empty')}</li> : null}
        {shown.map((n) => (
          <li key={n.id} className={s.note} data-status={n.status} data-note-n={n.n}>
            <div className={s.noteHead}>
              {n.anchor === 'pin' ? <span className={s.pinNo} aria-label={t('pinN', { n: n.n })}>{n.n}</span> : null}
              {n.anchor === 'time' && n.t != null ? (
                <button type="button" className={s.time} onClick={() => onJump?.(n.t!)} aria-label={t('jump', { time: clock(n.t) })}>{clock(n.t)}</button>
              ) : null}
              <strong>{n.author}</strong>
              <span className={s.when}>{formatRelative(n.createdAt, locale)}</span>
              {n.status !== 'open' ? <span className={s.state} data-state={n.status}>{n.status === 'resolved' ? <Check size={12} aria-hidden /> : null}{t(`status.${n.status}`)}</span> : null}
            </div>
            <p className={s.body}>{n.body}</p>
            {n.replies.map((r) => (
              <div key={r.id} className={s.reply}>
                <span className={s.replyAuthor}>{r.author}</span>
                <p className={s.body}>{r.body.startsWith('replaced:') ? t('replaced') : r.body}</p>
              </div>
            ))}
          </li>
        ))}
      </ol>
      <form className={s.composer} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {kind === 'photo' ? (
          <p className={s.hint}>
            {pin ? <>{t('pinSet')} <button type="button" className={s.link} onClick={onClearPin}>{t('cancelPin')}</button></> : t('pinHint')}
          </p>
        ) : <p className={s.hint}>{t('atTime')}</p>}
        <div className={s.row}>
          {kind === 'video' && time != null ? <span className={s.time} aria-hidden data-testid="note-time">{clock(time)}</span> : null}
          {pin ? <span className={s.pinNo} aria-hidden>{(notes?.length ?? 0) + 1}</span> : null}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} data-testid="note-input"
            placeholder={t(kind === 'photo' ? 'placeholderPhoto' : 'placeholderVideo')} aria-label={t(kind === 'photo' ? 'placeholderPhoto' : 'placeholderVideo')}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } e.stopPropagation(); }} />
          <button type="submit" className={s.send} disabled={busy || !text.trim()} aria-label={t('send')} data-testid="note-send">
            <SendHorizontal size={18} aria-hidden className={s.sendIcon} />
          </button>
        </div>
        {error ? <p className={s.error} role="alert">{t('failed')}</p> : null}
      </form>
    </section>
  );
}
