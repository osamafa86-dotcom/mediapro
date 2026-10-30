import { Film } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { systemName } from '@/lib/settings';
import { LogoutButton } from '@/components/auth/LogoutButton';
import s from '@/components/upload/upload.module.css';
import { requireStaffPage } from '@/lib/auth/session';

/** Photographer area (Figma 41:2): a top bar, not the admin sidebar. */
export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const t = await getTranslations();
  return (
    <div className={s.shell}>
      <header className={s.top}>
        <Link href="/upload" className={s.brand}>
          <span className={s.mark} aria-hidden><Film size={18} /></span>
          <strong>{await systemName(await getLocale())}</strong>
        </Link>
        <nav aria-label={t('upload.nav')} className={s.topNav}>
          <Link href="/upload">{t('upload.nav')}</Link>
          {staff.role === 'admin' ? <Link href="/admin">{t('admin.nav.dashboard')}</Link> : null}
        </nav>
        <div className={s.me}>
          <span className={s.avatar} aria-hidden>{staff.name.trim().charAt(0)}</span>
          <span className={s.meText}><strong><bdi>{staff.name}</bdi></strong><span>{t(`admin.roles.${staff.role}`)}</span></span>
          <LogoutButton />
        </div>
      </header>
      <main className={s.main} id="main">{children}</main>
    </div>
  );
}
