import { Clock, Film } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSql } from '@/db';
import { formatDate, type Locale } from '@/i18n/config';
import { getViewer } from '@/lib/auth/viewer';
import { listProjectsForViewer } from '@/lib/authz';
import s from '../client.module.css';

/** «مكتبتي» — minimal for M1 (list + empty state); the full Figma 14:63 screen is M5. */
export default async function Library() {
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('gate.sessionEnded')}</p></main>;
  if (viewer.kind === 'guest') redirect(`/p/${viewer.projectId}`);
  const locale = (await getLocale()) as Locale;
  const [c] = await getSql()<{ name_ar: string; name_tr: string | null }[]>`select name_ar, name_tr from clients where id = ${viewer.clientId}`;
  const projects = await listProjectsForViewer(viewer);
  return (
    <main className={s.main} data-testid="client-library">
      <p className={s.muted}>{t('client.welcome')}</p>
      <h1 className="t-title">{locale === 'tr' ? c?.name_tr || c?.name_ar : c?.name_ar}</h1>
      <p className={s.muted}>{t('client.summary', { projects: projects.length })}</p>
      {projects.length === 0 ? (
        <section className={s.empty}>
          <span className={s.emptyIcon} aria-hidden><Film size={22} /></span>
          <h2 className="t-heading">{t('client.emptyTitle')}</h2>
          <p className={s.muted}>{t('client.emptyBody')}</p>
        </section>
      ) : (
        <ul className={s.list}>
          {projects.map((p) => (
            <li key={p.id} data-project-id={p.id}>
              <Link href={`/p/${p.id}`} className={s.item}>
                <span className="t-subheading">{p.title}</span>
                {p.expires_at ? <span className={s.meta}><Clock size={14} aria-hidden />{t('client.until', { date: formatDate(p.expires_at, locale) })}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
