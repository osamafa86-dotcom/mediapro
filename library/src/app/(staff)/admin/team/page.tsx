import { getLocale, getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { InviteButton, MemberMenu, PermissionsMatrix } from '@/components/admin/Team';
import s from '@/components/admin/admin.module.css';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { requireStaffPage } from '@/lib/auth/session';
import { formatBytes, formatNumber, formatRelative, ltr } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export async function generateMetadata() { return { title: (await getTranslations('admin'))('nav.team') }; }

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  await requireStaffPage(['admin']);
  const t = await getTranslations('admin');
  const locale = (await getLocale()) as Locale;
  const { region, rolePermissions, storage } = await getSettings();
  const sql = getSql();
  const [members, [st]] = await Promise.all([
    sql<{ id: string; name: string; email: string | null; role: 'photographer' | 'editor' | 'contributor'; title: string | null; disabled_at: string | null;
      last_login_at: string | null; has_password: boolean; sso: boolean; projects: number; month_bytes: string; last_upload: string | null }[]>`
      select u.id, u.name, u.email, u.role, u.title, u.disabled_at, u.last_login_at,
        (u.password_hash is not null) as has_password, (u.auth_provider <> 'local') as sso,
        (select count(*) from project_members m where m.user_id = u.id)::int as projects,
        (select coalesce(sum(a.size), 0) from assets a where a.uploaded_by = u.id and a.created_at >= date_trunc('month', now()))::text as month_bytes,
        (select max(a.created_at) from assets a where a.uploaded_by = u.id) as last_upload
      from users u where u.role <> 'admin'
      order by (u.disabled_at is not null), (u.last_login_at is null), u.name`,
    sql<{ month_bytes: string; month_files: number; review: number; oldest: string | null; total: string }[]>`
      select (select coalesce(sum(size), 0) from assets where created_at >= date_trunc('month', now()))::text as month_bytes,
        (select count(*) from assets where created_at >= date_trunc('month', now()))::int as month_files,
        (select count(*) from projects where status = 'review' and archived_at is null)::int as review,
        (select min(updated_at) from projects where status = 'review' and archived_at is null) as oldest,
        (select coalesce(sum(size), 0) from assets)::text as total`,
  ]);
  const active = members.filter((m) => !m.disabled_at && m.last_login_at).length;
  const pending = members.filter((m) => !m.disabled_at && !m.last_login_at && !m.has_password).length;
  const fb = (n: number) => formatBytes(n, locale, region.digits);
  const used = Number(st!.total);
  const pct = storage.quotaBytes ? Math.min(100, (used / storage.quotaBytes) * 100) : 0;

  return (
    <>
      <PageHead title={t('nav.team')} subtitle={t('team.subtitle')} actions={<InviteButton openInitially={(await searchParams).invite === '1'} />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minInlineSize: 0 }}>
        <div style={{ display: 'contents' }}>
          <section className={s.stats} aria-label={t('nav.team')}>
            <div className={`${s.card} ${s.stat}`}><span className={s.statLabel}>{t('team.statActive')}</span><span className={s.statValue}>{active}</span><span className={s.statSub}>{t('team.statActiveSub', { n: pending })}</span></div>
            <div className={`${s.card} ${s.stat}`}><span className={s.statLabel}>{t('team.statMonth')}</span><span className={s.statValue}>{fb(Number(st!.month_bytes))}</span><span className={s.statSub}>{t('team.statMonthSub', { n: formatNumber(st!.month_files, locale, region.digits) })}</span></div>
            <div className={`${s.card} ${s.stat}`}><span className={s.statLabel}>{t('team.statReview')}</span><span className={`${s.statValue} ${st!.review ? s.statWarn : ''}`}>{st!.review}</span><span className={s.statSub}>{st!.oldest ? t('team.statReviewSub', { age: formatRelative(st!.oldest, locale) }) : ''}</span></div>
            <div className={`${s.card} ${s.stat}`}><span className={s.statLabel}>{t('team.statStorage')}</span><span className={s.statValue}>{fb(used)}</span><span className={s.meter}><span style={{ inlineSize: `${pct}%` }} /></span><span className={s.statSub}>{t('team.statStorageSub', { quota: ltr(fb(storage.quotaBytes)) })}</span></div>
          </section>
          <section className={`${s.card} ${s.tableWrap}`}>
            <table className={s.table} data-testid="team-table">
              <caption>{t('nav.team')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('team.col.member')}</th>
                  <th scope="col" className={s.numCol}>{t('team.col.projects')}</th>
                  <th scope="col" className={s.numCol}>{t('team.col.month')}</th>
                  <th scope="col">{t('team.col.last')}</th>
                  <th scope="col">{t('team.col.status')}</th>
                  <th scope="col" className={s.menuCol} style={{ inlineSize: 140 }}><span className="sr-only">{t('archive.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const state = m.disabled_at ? 'suspended' : m.last_login_at ? 'active' : 'pending';
                  const label = state === 'pending' && m.has_password ? 'noLogin' : state;
                  return (
                    <tr key={m.id} data-id={m.id} data-state={state} style={{ cursor: 'default', opacity: state === 'suspended' ? 0.6 : 1 }}>
                      <td>
                        <div className={s.projectCell}>
                          <span className={s.avatar} aria-hidden>{m.name.trim().charAt(0)}</span>
                          <span className={s.projectText}><strong style={{ fontWeight: 500 }}>{m.name}</strong><span>{m.title || t(`roles.${m.role}`)}</span></span>
                        </div>
                      </td>
                      <td className={s.numCol}>{state === 'pending' ? '—' : m.projects}</td>
                      <td className={`${s.numCol} ${s.sizeCell}`}><bdi dir="ltr">{state === 'pending' ? '—' : fb(Number(m.month_bytes))}</bdi></td>
                      <td className={`${s.small} ${s.muted}`}>{m.last_upload ? formatRelative(m.last_upload, locale) : state === 'pending' ? t('team.neverLoggedIn') : t('team.neverUploaded')}</td>
                      <td><span className={`${s.pill} ${s[`pill_${state}`]}`}><span className={s.dot} aria-hidden />{t(`team.status.${label}`)}</span></td>
                      <td className={s.menuCol}><MemberMenu id={m.id} name={m.name} state={state} role={m.role} hasPassword={m.has_password} sso={m.sso} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
        <PermissionsMatrix initial={rolePermissions} />
      </div>
    </>
  );
}
