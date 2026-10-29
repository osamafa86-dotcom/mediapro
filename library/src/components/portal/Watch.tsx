'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { clock } from '@/lib/clock';
import { NotesPanel, type ClientNote } from './NotesPanel';
import type { ViewAsset } from './ProjectView';
import { VideoList } from './VideoList';
import { VideoPlayer } from './VideoPlayer';
import s from './portal.module.css';

/**
 * The player and its side: the project's videos, or — with «الملاحظات» on — this video's notes, each at its
 * moment, with markers on the time bar (Figma v2 player frame). Guests see only the list.
 */
export function Watch({ projectId, asset, videos, canNote, playable, children }: {
  projectId: string; asset: { id: string; duration: number; rungs: number[] }; videos: ViewAsset[]; canNote: boolean; playable: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('portal.notes');
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [time, setTime] = useState(0);
  const [jump, setJump] = useState<{ t: number; k: number } | null>(null);
  const markers = notes.filter((n) => n.anchor === 'time' && n.t != null).map((n) => ({ t: n.t!, resolved: n.status === 'resolved', label: `${clock(n.t!)} · ${n.author}` }));
  return (
    <>
      <section className={s.watchMain}>
        {playable ? (
          <VideoPlayer assetId={asset.id} poster={`/m/${asset.id}/poster`} duration={asset.duration} rungs={asset.rungs}
            markers={markers} jump={jump} onTime={setTime}
            onNotes={canNote ? () => setOpen((o) => !o) : undefined} notesOpen={open} notesLabel={t('open')} />
        ) : null}
        {children}
      </section>
      {canNote ? (
        <div className={s.side} hidden={!open} data-testid="video-notes">
          <NotesPanel assetId={asset.id} kind="video" time={time} onNotes={setNotes} onJump={(x) => setJump({ t: x, k: Date.now() })} onClose={() => setOpen(false)} />
        </div>
      ) : null}
      {!open ? <VideoList projectId={projectId} current={asset.id} videos={videos} /> : null}
    </>
  );
}
