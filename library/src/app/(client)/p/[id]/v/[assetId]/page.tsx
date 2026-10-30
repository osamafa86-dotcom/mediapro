import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { Watch } from '@/components/portal/Watch';
import s from '@/components/portal/portal.module.css';
import { getViewer } from '@/lib/auth/viewer';
import { isUuid } from '@/lib/authz';
import { projectFor, toView } from '@/lib/portal';
import { getSettings } from '@/lib/settings';

/** The player page (Figma player frame): stream, the project's other videos, and the two download choices — the player switches in place (Watch). */
export default async function VideoPage({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('portal.sessionEnded')}</p></main>;
  if (!isUuid(id) || !isUuid(assetId)) notFound();
  const data = await projectFor(viewer, id);
  const a = data?.assets.find((x) => x.id === assetId && x.section === 'videos');
  if (!data || !a) notFound();
  const locale = await getLocale();
  const { region } = await getSettings();
  const p = data.project;
  const org = locale === 'tr' ? p.client_name_tr || p.client_name_ar : p.client_name_ar;
  const guest = viewer.kind === 'guest';
  const canDownload = !guest && viewer.allowDownload;
  const videos = data.assets.filter((x) => x.section === 'videos').map(toView);
  return (
    <div className={s.shell}>
      <PortalHeader org={org} project={{ title: p.title }} library={!guest} />
      <main className={`${s.main} ${s.watch}`} data-testid="client-video" data-kind={viewer.kind}>
        <Watch projectId={p.id} initial={a.id} videos={videos} canNote={!guest} canDownload={canDownload}
          photographers={data.photographers} digits={region.digits} />
      </main>
    </div>
  );
}
