'use client';
import { Play } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/ui';
import { clock } from '@/lib/clock';
import type { ViewAsset } from './ProjectView';
import s from './portal.module.css';

/** «في هذا المشروع · 14 فيديو» with the group chips; the current video is marked. */
export function VideoList({ projectId, current, videos }: { projectId: string; current: string; videos: ViewAsset[] }) {
  const t = useTranslations('portal');
  const groups = (['final', 'footage', 'raw'] as const).filter((g) => videos.some((v) => v.group === g));
  const [group, setGroup] = useState(videos.find((v) => v.id === current)?.group ?? groups[0]);
  const list = videos.filter((v) => v.group === group);
  return (
    <aside className={s.side} aria-label={t('inProject', { n: videos.length })}>
      <h2 className={s.sideTitle}>{t('inProject', { n: videos.length })}</h2>
      {groups.length > 1 ? (
        <div className={s.chips} role="group" aria-label={t('groupsLabel')}>
          {groups.map((g) => <Chip key={g} isSelected={g === group} onChange={() => setGroup(g)} label={<>{t(`group.${g}`)} · <span className={s.num}>{videos.filter((v) => v.group === g).length}</span></>} />)}
        </div>
      ) : null}
      <ul className={s.sideList}>
        {list.map((v) => (
          <li key={v.id}>
            <Link href={`/p/${projectId}/v/${v.id}`} className={s.sideItem} aria-current={v.id === current ? 'page' : undefined} replace>
              <span className={s.sideThumb}>
                {/* eslint-disable-next-line @next/next/no-img-element -- authorized /m route */}
                <img src={`/m/${v.id}/w320.webp`} alt="" loading="lazy" decoding="async" />
                {v.duration ? <span className={s.dur}>{clock(v.duration)}</span> : null}
                {v.id === current ? <span className={s.nowPlaying}><Play size={12} aria-hidden /></span> : null}
              </span>
              <span className={s.sideText}>
                <span className={s.sideName}><bdi>{v.name}</bdi></span>
                <span className={s.meta}>{[t(`group.${v.group}`), v.quality].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
