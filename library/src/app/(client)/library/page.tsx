import { Film } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { LibraryCards } from '@/components/portal/LibraryCards';
import { PortalHeader } from '@/components/portal/PortalHeader';
import s from '@/components/portal/portal.module.css';
import type { Locale } from '@/i18n/config';
import { getViewer } from '@/lib/auth/viewer';
import { daysUntil, formatDay } from '@/lib/format';
import { libraryFor } from '@/lib/portal';
import { getSettings } from '@/lib/settings';
import { placeholder } from '@/lib/thumb';

/** «مكتبتي» (Figma 14:63): every published project of this client, newest first, with a year filter. */
export default async function Library() {
  const viewer = await getViewer();
  const t = await getTranslations();
  if (!viewer) return <main className={s.main}><p className={s.muted}>{t('portal.sessionEnded')}</p></main>;
  if (viewer.kind === 'guest') redirect(`/p/${viewer.projectId}`);
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const { client, projects } = await libraryFor(viewer);
  const org = locale === 'tr' ? client.name_tr || client.name_ar : client.name_ar;
  const files = projects.reduce((n, p) => n + p.photos + p.videos, 0);
  // the soonest project to disappear within a week gets one warning line
  const soon = projects.filter((p) => p.expires_at && daysUntil(p.expires_at) <= 7).sort((a, b) => +new Date(a.expires_at!) - +new Date(b.expires_at!))[0];
  const cards = projects.map((p) => ({
    id: p.id, title: p.title, year: p.shot_date ? Number(p.shot_date.slice(0, 4)) : new Date(p.published_at!).getFullYear(),
    date: p.shot_date ? formatDay(p.shot_date, locale, 'UTC', region.digits) : null, place: p.place,
    counts: t('portal.cardCounts', { photos: p.photos, videos: p.videos, sep: p.photos && p.videos ? ' · ' : '' }),
    until: p.expires_at ? t('portal.until', { date: formatDay(p.expires_at, locale, region.timeZone, region.digits) }) : null,
    cover: p.cover, bg: placeholder(p.cover_hash),
    key: [p.title, p.place ?? '', p.shot_date ?? '', p.shot_date ? formatDay(p.shot_date, locale, 'UTC', region.digits) : ''].join(' '),
  }));
  return (
    <div className={s.shell}>
      <PortalHeader org={org} search="library" />
      <main className={s.main} data-testid="client-library">
        <div className={s.hello}>
          <p className={s.muted}>{t('portal.welcome')}</p>
          <h1 className="t-title">{org}</h1>
          <p className={`${s.muted} ${s.small}`}>{t('portal.stats', { projects: projects.length, files })}</p>
        </div>
        {soon ? (
          <p className={s.warn} role="note" data-testid="expiring">
            {t('portal.expiring', { title: soon.title, days: Math.max(0, daysUntil(soon.expires_at!)), date: formatDay(soon.expires_at!, locale, region.timeZone, region.digits) })}
          </p>
        ) : null}
        {projects.length === 0 ? (
          <section className={s.empty}>
            <span className={s.emptyIcon} aria-hidden><Film size={22} /></span>
            <h2 className="t-heading">{t('client.emptyTitle')}</h2>
            <p className={s.muted}>{t('client.emptyBody')}</p>
          </section>
        ) : <LibraryCards cards={cards} />}
      </main>
    </div>
  );
}
