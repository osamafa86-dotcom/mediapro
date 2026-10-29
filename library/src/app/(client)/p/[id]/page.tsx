import { Calendar, Camera, Clock, Download, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { DownloadAllButton } from '@/components/portal/DownloadAllButton';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { ProjectView } from '@/components/portal/ProjectView';
import s from '@/components/portal/portal.module.css';
import type { Locale } from '@/i18n/config';
import { getViewer } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { formatBytes, formatDay, joinNames, ltr } from '@/lib/format';
import { projectFor, toView } from '@/lib/portal';
import { getSettings } from '@/lib/settings';

/** Project page (Figma 14:2xx): head, «تنزيل المشروع كاملًا», photos/videos, groups, justified grid, selection bar. */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; group?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('portal.sessionEnded')}</p></main>;
  if (!isUuid(id)) notFound();
  const data = await projectFor(viewer, id);
  if (!data) notFound();
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const { project: p, photographers, assets } = data;
  const org = locale === 'tr' ? p.client_name_tr || p.client_name_ar : p.client_name_ar;
  const guest = viewer.kind === 'guest';
  const canDownload = !guest && viewer.allowDownload;
  const bytes = assets.reduce((n, a) => n + a.size, 0);
  const tab = q.tab === 'videos' || (q.tab !== 'photos' && !assets.some((a) => a.section === 'photos') && assets.length) ? 'videos' : 'photos';
  return (
    <div className={s.shell}>
      <PortalHeader org={org} project={{ title: p.title }} library={!guest} search="project" />
      <main className={s.main} data-testid="client-project" data-kind={viewer.kind}>
        {guest ? <p className={s.banner} role="note">{t('client.guestBanner', { date: formatDay(viewer.linkExpiresAt, locale, region.timeZone, region.digits) })}</p> : null}
        <div className={s.projHead}>
          <div>
            <h1 className="t-title">{p.title}</h1>
            <div className={s.meta}>
              {p.shot_date ? <span><Calendar size={14} aria-hidden />{formatDay(p.shot_date, locale, 'UTC', region.digits)}</span> : null}
              {p.place ? <span><MapPin size={14} aria-hidden />{p.place}</span> : null}
              {photographers.length ? <span><Camera size={14} aria-hidden />{joinNames(photographers, locale)}</span> : null}
              {p.expires_at ? <span><Clock size={14} aria-hidden />{t('portal.until', { date: formatDay(p.expires_at, locale, region.timeZone, region.digits) })}</span> : null}
            </div>
          </div>
          {canDownload && assets.length ? (
            <DownloadAllButton projectId={p.id} label={p.title}>
              <Download size={16} aria-hidden />{t('portal.downloadAll', { size: ltr(formatBytes(bytes, locale, region.digits)) })}
            </DownloadAllButton>
          ) : null}
        </div>
        <ProjectView projectId={p.id} title={p.title} assets={assets.map(toView)} canDownload={canDownload} guest={guest} digits={region.digits}
          initial={{ tab, group: q.group }} />
      </main>
    </div>
  );
}
