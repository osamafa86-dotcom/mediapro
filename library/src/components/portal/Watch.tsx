'use client';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { clock } from '@/lib/clock';
import { formatBytes, joinNames, ltr, type Digits } from '@/lib/format';
import { NotesPanel, type ClientNote } from './NotesPanel';
import type { ViewAsset } from './ProjectView';
import { VideoList } from './VideoList';
import { VideoPlayer } from './VideoPlayer';
import s from './portal.module.css';

/**
 * The player and its side: the project's videos, or — with «الملاحظات» on — this video's notes, each at its
 * moment, with markers on the time bar (Figma v2 player frame). Guests see only the list.
 *
 * The player stays put (sticky) while the list scrolls, and a video picked from the list plays in it at once:
 * the page does not navigate — the same <video> element takes the new source and the address follows along.
 */
export function Watch({ projectId, initial, videos, canNote, canDownload, photographers, digits }: {
  projectId: string; initial: string; videos: ViewAsset[]; canNote: boolean; canDownload: boolean; photographers: string[]; digits: Digits;
}) {
  const t = useTranslations('portal');
  const tn = useTranslations('portal.notes');
  const locale = useLocale() as Locale;
  const [currentId, setCurrentId] = useState(initial);
  const [autoPlay, setAutoPlay] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [time, setTime] = useState(0);
  const [jump, setJump] = useState<{ t: number; k: number } | null>(null);
  const a = videos.find((v) => v.id === currentId) ?? videos[0]!;
  const markers = notes.filter((n) => n.anchor === 'time' && n.t != null).map((n) => ({ t: n.t!, resolved: n.status === 'resolved', label: `${clock(n.t!)} · ${n.author}` }));
  const meta = [t(`group.${a.group}`), a.quality, a.duration ? ltr(clock(a.duration)) : null, ltr(formatBytes(a.size, locale, digits)),
    photographers.length ? t('by', { names: joinNames(photographers, locale) }) : null].filter(Boolean) as string[];

  function pick(id: string) {
    if (id === currentId) return;
    setCurrentId(id);
    setAutoPlay(true);
    setNotes([]); setTime(0); setJump(null);
    window.history.replaceState(null, '', `/p/${projectId}/v/${id}`);
  }

  return (
    <>
      <div className={s.watchMain}>
        <div className={s.watchPlayer} data-testid="watch-player">
          {a.hls ? (
            <VideoPlayer assetId={a.id} poster={`/m/${a.id}/poster`} duration={a.duration ?? 0} rungs={a.rungs ?? []} autoPlay={autoPlay}
              portrait={a.h > a.w}
              markers={markers} jump={jump} onTime={setTime}
              onNotes={canNote ? () => setOpen((o) => !o) : undefined} notesOpen={open} notesLabel={tn('open')} />
          ) : <p className={s.banner}>{t('player.processing')}</p>}
        </div>
        <div className={s.watchInfo}>
          <div>
            <h1 className="t-heading" style={{ margin: 0 }}><bdi>{a.name}</bdi></h1>
            <p className={s.meta} data-testid="video-meta">{meta.join(' · ')}</p>
          </div>
          {canDownload ? (
            <div className={s.toolbar}>
              <a className={`${s.primary} ${s.primarySq}`} href={`/api/download/${a.id}`} download>
                <Download size={16} aria-hidden />{t('original', { size: ltr(formatBytes(a.size, locale, digits)) })}
              </a>
              {a.web ? <a className={s.secondary} href={`/api/download/${a.id}?v=web`} download><Download size={16} aria-hidden />{t('webVideo')}</a> : null}
            </div>
          ) : null}
        </div>
        <p className={`${s.muted} ${s.small} ${s.keysHint}`}>{t('player.keys')}</p>
      </div>
      {canNote ? (
        <div className={s.side} hidden={!open} data-testid="video-notes">
          <NotesPanel key={a.id} assetId={a.id} kind="video" time={time} onNotes={setNotes} onJump={(x) => setJump({ t: x, k: Date.now() })} onClose={() => setOpen(false)} />
        </div>
      ) : null}
      {!open ? <VideoList projectId={projectId} current={a.id} videos={videos} onPick={pick} /> : null}
    </>
  );
}
