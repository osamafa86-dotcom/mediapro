import { Film } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getSql } from '@/db';
import { navCounts } from '@/lib/admin/queries';
import { openNotesCount } from '@/lib/notes';
import type { Staff } from '@/lib/auth/session';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { NavLinks, type NavItem } from './NavLinks';
import s from './admin.module.css';

/** Sidebar at the inline start (right in Arabic), as in every admin frame of the design. */
export async function AdminShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const t = await getTranslations('admin');
  const sql = getSql();
  const [counts, [views], [logo]] = await Promise.all([
    navCounts(staff),
    sql<{ value: { name: string; query: string }[] }[]>`select value from settings where key = ${`views:${staff.id}`}`,
    sql`select 1 from settings where key = 'logo'`,
  ]);
  const admin = staff.role === 'admin';
  const items: NavItem[] = [
    { key: 'dashboard', href: '/admin', label: t('nav.dashboard') },
    { key: 'archive', href: '/admin/archive', label: t('nav.archive'), count: counts.projects },
    { key: 'notes', href: '/admin/notes', label: t('nav.notes'), count: await openNotesCount(staff) },
    ...(admin ? [] : [{ key: 'upload' as const, href: '/upload', label: (await getTranslations('upload'))('nav') }]),
    ...(admin ? [
      { key: 'clients' as const, href: '/admin/clients', label: t('nav.clients'), count: counts.clients },
      { key: 'team' as const, href: '/admin/team', label: t('nav.team'), count: counts.team },
      { key: 'import' as const, href: '/admin/import', label: t('nav.import'), count: counts.imports },
      { key: 'settings' as const, href: '/admin/settings', label: t('nav.settings') },
    ] : []),
  ];
  return (
    <div className={s.shell}>
      <aside className={s.sidebar} aria-label={t('nav.menu')}>
        <div className={s.brand}>
          <span className={s.brandMark} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny same-origin logo; next/image adds nothing here */}
            {logo ? <img src="/api/branding/logo" alt="" width={20} height={20} /> : <Film size={18} />}
          </span>
          <span className={s.brandText}>
            <strong>{(await getTranslations('app'))('name')}</strong>
            <span className={s.mono} dir="ltr">media.emdatra.org</span>
          </span>
        </div>
        <nav aria-label={t('nav.menu')}>
          <NavLinks items={items} views={views?.value ?? []} />
        </nav>
        <div className={s.me}>
          <span className={s.avatar} aria-hidden>{staff.name.trim().charAt(0)}</span>
          <span className={s.meText}>
            <strong><bdi>{staff.name}</bdi></strong>
            <span>{t(`roles.${staff.role}`)}</span>
          </span>
          <LogoutButton />
        </div>
      </aside>
      <main className={s.main} id="main">{children}</main>
    </div>
  );
}

export async function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className={s.pageHead}>
      <div>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle ? <p className={s.pageSub}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </header>
  );
}
