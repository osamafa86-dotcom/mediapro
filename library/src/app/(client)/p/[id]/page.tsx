import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSql } from '@/db';
import { formatDate, type Locale } from '@/i18n/config';
import { getViewer } from '@/lib/auth/viewer';
import { viewerCanSeeProject } from '@/lib/authz';
import s from '../../client.module.css';

/** Project page — M1 only enforces who may open it; the grid, viewer and player come in M5. */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('gate.sessionEnded')}</p></main>;
  if (!(await viewerCanSeeProject(viewer, id))) notFound();
  const locale = (await getLocale()) as Locale;
  const [p] = await getSql()<{ title: string; shot_date: string | null }[]>`select title, shot_date from projects where id = ${id}`;
  return (
    <main className={s.main} data-testid="client-project" data-kind={viewer.kind}>
      {viewer.kind === 'guest' ? <p className={s.banner} role="note">{t('client.guestBanner', { date: formatDate(viewer.linkExpiresAt, locale) })}</p> : null}
      <h1 className="t-title">{p!.title}</h1>
      {p!.shot_date ? <p className={s.muted}>{formatDate(p!.shot_date, locale)}</p> : null}
    </main>
  );
}
