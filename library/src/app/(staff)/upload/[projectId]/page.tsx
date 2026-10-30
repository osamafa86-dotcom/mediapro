import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { MyProjectsPanel } from '@/components/upload/MyProjects';
import { Uploader } from '@/components/upload/Uploader';
import s from '@/components/upload/upload.module.css';
import { StatusBadge, type ProjectStatus } from '@/components/ui';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { requireStaffPage } from '@/lib/auth/session';
import { isUuid, listProjectsForStaff, staffCanAccessProject } from '@/lib/authz';
import { formatDay, joinNames } from '@/lib/format';
import { can } from '@/lib/settings';
import { unfinished } from '@/lib/uploads';

export default async function UploadPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ album?: string }> }) {
  const staff = await requireStaffPage();
  const { projectId } = await params;
  if (!isUuid(projectId) || !(await staffCanAccessProject(staff, projectId))) notFound();
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const sql = getSql();
  const { album } = await searchParams;
  const [[p], members, counts, open, mine, albums] = await Promise.all([
    sql<{ title: string; status: ProjectStatus; shot_date: string | null; name_ar: string; name_tr: string | null }[]>`
      select p.title, p.status, p.shot_date, c.name_ar, c.name_tr from projects p join clients c on c.id = p.client_id where p.id = ${projectId}`,
    sql<{ name: string }[]>`select u.name from project_members m join users u on u.id = m.user_id where m.project_id = ${projectId} order by u.name`,
    sql<{ section: string; n: number }[]>`select section, count(*)::int as n from assets where project_id = ${projectId} and replaced_by is null and album_id is null group by section`,
    unfinished(staff, projectId),
    listProjectsForStaff(staff),
    sql<{ id: string; name: string; n: number }[]>`select al.id, al.name, (select count(*)::int from assets a where a.album_id = al.id and a.replaced_by is null) as n
      from project_albums al where al.project_id = ${projectId} order by al.sort_order, al.created_at`,
  ]);
  const allowed = await can(staff.role, 'upload');
  const n = (sec: string) => counts.find((c) => c.section === sec)?.n ?? 0;
  const inAlbums = albums.reduce((x, a) => x + a.n, 0);
  const client = locale === 'tr' ? p!.name_tr || p!.name_ar : p!.name_ar;
  return (
    <div className={s.layout}>
      <section className={s.work} aria-labelledby="h-project">
        <div className={s.titleRow}>
          <h1 id="h-project" className={s.title}>{p!.title}</h1>
          <StatusBadge status={p!.status} label={t(`status.${p!.status}`)} />
        </div>
        <p className={s.meta}>{[client, p!.shot_date ? formatDay(p!.shot_date, locale, 'UTC') : null, joinNames(members.map((m) => m.name), locale)].filter(Boolean).join(' · ')}</p>
        {allowed ? (
          <Uploader
            projectId={projectId}
            counts={{ photos: n('photos'), videos: n('videos') }}
            unfinished={open.map((u) => ({ id: u.id, filename: u.filename, size: Number(u.size) }))}
            albums={albums} album={album && isUuid(album) ? album : null}
          />
        ) : <p className={s.warn} role="alert">{t('upload.notAllowed')}</p>}
      </section>
      <MyProjectsPanel
        current={projectId}
        projects={mine.filter((x) => x.status !== 'expired').slice(0, 8).map((x) => ({ id: x.id, title: x.title, status: x.status as ProjectStatus, statusLabel: t(`status.${x.status as ProjectStatus}`) }))}
        canReady={['draft', 'uploading', 'review'].includes(p!.status)}
        openCount={open.length}
        hasAssets={n('photos') + n('videos') + inAlbums > 0}
      />
    </div>
  );
}
