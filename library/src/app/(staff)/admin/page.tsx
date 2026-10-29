import { Archive, CircleCheck, Clock, Download, Eye, Image as ImageIcon, Link2, Lock, Plus, Upload, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { NewProjectButton } from '@/components/admin/ProjectDialog';
import s from '@/components/admin/admin.module.css';
import type { Locale } from '@/i18n/config';
import { dashboard } from '@/lib/admin/queries';
import { requireStaffPage } from '@/lib/auth/session';
import { formatBytes, formatPct, formatRelative, formatWeekday, joinNames, ltr } from '@/lib/format';
import { can, getSettings } from '@/lib/settings';

const ACT_ICON: Record<string, typeof Eye> = {
  'project.created': Plus, 'project.review': CircleCheck, 'project.published': Upload, 'link.created': Link2, 'link.opened': Eye,
  'link.pin_locked': Lock, 'link.renewal_requested': Clock, 'client.created': UserPlus, 'team.invited': UserPlus,
};

export default async function Dashboard() {
  const staff = await requireStaffPage();
  const t = await getTranslations('admin');
  const locale = (await getLocale()) as Locale;
  const { region } = await getSettings();
  const d = await dashboard(staff);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: region.timeZone }).format(new Date()));
  const first = staff.name.trim().split(/\s+/)[0] ?? staff.name;
  const today = formatWeekday(new Date(), locale, region.timeZone);
  const admin = staff.role === 'admin';
  const age = (iso: string | null) => (iso ? formatRelative(iso, locale, undefined, region.timeZone) : '—');
  const fmtB = (n: number) => formatBytes(n, locale, region.digits);

  const stats = [
    { icon: Clock, label: t('dashboard.statReview'), value: d.stats.review, sub: d.stats.oldest_review ? t('dashboard.statReviewSub', { age: age(d.stats.oldest_review) }) : '' },
    { icon: Upload, label: t('dashboard.statUploads'), value: d.stats.uploading, sub: d.uploads[0] ? `${d.uploads[0].title} · ${formatPct(pct(d.uploads[0]), locale)}` : '' },
    ...(admin ? [
      { icon: Link2, label: t('dashboard.statLinks'), value: d.stats.links30, sub: t('dashboard.statLinksSub', { n: d.stats.links30_downloaded }) },
      { icon: Archive, label: t('dashboard.statStorage'), value: fmtB(d.stats.bytes), sub: t('dashboard.statStorageSub', { bytes: ltr(fmtB(d.stats.bytes_month)) }) },
    ] : []),
  ];

  return (
    <>
      <PageHead
        title={t(hour < 12 ? 'dashboard.morning' : 'dashboard.evening', { name: first })}
        subtitle={`${today} · ${t('dashboard.waiting', { count: d.stats.review })}`}
        actions={(await can(staff.role, 'createProject')) ? <NewProjectButton /> : null}
      />
      <section className={s.stats} aria-label={t('nav.dashboard')}>
        {stats.map((st) => (
          <div key={st.label} className={`${s.card} ${s.stat}`}>
            <span className={s.statLabel}><st.icon size={16} aria-hidden />{st.label}</span>
            <span className={s.statValue}>{st.value}</span>
            <span className={s.statSub}>{st.sub}</span>
          </div>
        ))}
      </section>
      <div className={admin ? s.dash : undefined}>
        <section className={s.card} aria-labelledby="h-review">
          <div className={s.cardHead}><h2 id="h-review">{t('dashboard.review')}</h2></div>
          <div className={s.cardBody}>
            {d.review.length === 0 ? <p className={`${s.muted} ${s.small}`}>{t('dashboard.reviewEmpty')}</p> : d.review.map((p) => (
              <div key={p.id} className={s.reviewItem} data-testid="review-item">
                <span className={s.thumb} aria-hidden><ImageIcon size={20} /></span>
                <span className={s.itemText}>
                  <strong>{p.title}</strong>
                  <span className={`${s.small} ${s.muted}`}>{t('dashboard.reviewMeta', { who: joinNames(p.photographers, locale), photos: p.photos, videos: p.videos, age: age(p.since) })}</span>
                </span>
                <Link href={`/admin/projects/${p.id}`} className={s.btnLink}>{t('dashboard.reviewAction')}</Link>
              </div>
            ))}
            <h2 className={s.subhead}>{t('dashboard.uploads')}</h2>
            {d.uploads.length === 0 ? <p className={`${s.muted} ${s.small}`}>{t('dashboard.uploadsEmpty')}</p> : d.uploads.map((u) => (
              <div key={u.id} className={`${s.card} ${s.uploadItem}`}>
                <span className={`${s.thumb} ${s.thumbSm}`} aria-hidden><Upload size={16} /></span>
                <span className={s.itemText}>
                  <strong>{u.title}</strong>
                  <span className={`${s.small} ${s.muted}`}>{t('dashboard.uploadsMeta', { done: u.done, total: u.total, pct: formatPct(pct(u), locale) })}</span>
                  <span className={s.progress}><span style={{ inlineSize: `${pct(u)}%` }} /></span>
                </span>
              </div>
            ))}
          </div>
        </section>
        {admin ? (
          <section className={s.card} aria-labelledby="h-activity">
            <div className={s.cardHead}><h2 id="h-activity">{t('dashboard.activity')}</h2></div>
            <div className={s.cardBody}>
              {d.activity.length === 0 ? <p className={`${s.muted} ${s.small}`}>{t('dashboard.activityEmpty')}</p> : (
                <ul className={s.activity}>
                  {d.activity.map((a, i) => {
                    const Icon = ACT_ICON[a.action] ?? Download;
                    const client = a.client ?? '';
                    return (
                      <li key={i}>
                        <span className={s.activityIcon} aria-hidden><Icon size={16} /></span>
                        <span className={s.itemText}>
                          <span>{t(`dashboard.act.${a.action.replace('.', '_')}` as 'dashboard.act.link_opened', { project: a.project ?? '', client, actor: a.actor ?? '', projectPart: a.project ? ` «${a.project}»` : '' })}</span>
                          <span className={`${s.small} ${s.tertiary}`}>{age(a.at)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function pct(u: { bytes_total: string; bytes_done: string }) {
  const total = Number(u.bytes_total);
  return total ? Math.round((Number(u.bytes_done) / total) * 100) : 0;
}

