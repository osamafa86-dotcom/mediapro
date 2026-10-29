import { Download } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { Watch } from '@/components/portal/Watch';
import s from '@/components/portal/portal.module.css';
import type { Locale } from '@/i18n/config';
import { getViewer } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { formatBytes, joinNames, ltr } from '@/lib/format';
import { projectFor, qualityOf, toView } from '@/lib/portal';
import { getSettings } from '@/lib/settings';
import { clock } from '@/lib/clock';

/** The player page (Figma player frame): stream, the project's other videos, and the two download choices. */
export default async function VideoPage({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('portal.sessionEnded')}</p></main>;
  if (!isUuid(id) || !isUuid(assetId)) notFound();
  const data = await projectFor(viewer, id);
  const a = data?.assets.find((x) => x.id === assetId && x.section === 'videos');
  if (!data || !a) notFound();
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const p = data.project;
  const org = locale === 'tr' ? p.client_name_tr || p.client_name_ar : p.client_name_ar;
  const guest = viewer.kind === 'guest';
  const canDownload = !guest && viewer.allowDownload;
  const videos = data.assets.filter((x) => x.section === 'videos').map(toView);
  const meta = [t(`portal.group.${a.group}`), qualityOf(a), a.duration ? ltr(clock(a.duration)) : null, ltr(formatBytes(a.size, locale, region.digits)),
    data.photographers.length ? t('portal.by', { names: joinNames(data.photographers, locale) }) : null].filter(Boolean) as string[];
  return (
    <div className={s.shell}>
      <PortalHeader org={org} project={{ title: p.title }} library={!guest} />
      <main className={`${s.main} ${s.watch}`} data-testid="client-video" data-kind={viewer.kind}>
        <Watch projectId={p.id} asset={{ id: a.id, duration: a.duration ?? 0, rungs: a.renditions.hls?.rungs ?? [] }} videos={videos}
          canNote={!guest} playable={!!a.renditions.hls?.master}>
          {a.renditions.hls?.master ? null : <p className={s.banner}>{t('portal.player.processing')}</p>}
          <div className={s.watchInfo}>
            <div>
              <h1 className="t-heading" style={{ margin: 0 }}><bdi>{a.original_name}</bdi></h1>
              <p className={s.meta} data-testid="video-meta">{meta.join(' · ')}</p>
            </div>
            {canDownload ? (
              <div className={s.toolbar}>
                <a className={`${s.primary} ${s.primarySq}`} href={`/api/download/${a.id}`} download>
                  <Download size={16} aria-hidden />{t('portal.original', { size: ltr(formatBytes(a.size, locale, region.digits)) })}
                </a>
                {a.renditions.mp4_1080 ? (
                  <a className={s.secondary} href={`/api/download/${a.id}?v=web`} download><Download size={16} aria-hidden />{t('portal.webVideo')}</a>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className={`${s.muted} ${s.small} ${s.keysHint}`}>{t('portal.player.keys')}</p>
        </Watch>
      </main>
    </div>
  );
}
