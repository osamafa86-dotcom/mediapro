import { ChevronRight, Film } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSql } from '@/db';
import { THEME_COOKIE } from '@/i18n/config';
import { LangSwitch } from './LangSwitch';
import { PortalSearch } from './PortalSearch';
import { ThemeToggle } from './ThemeToggle';
import s from './portal.module.css';

/** Organisation · مكتبتي › project — then language and theme (Figma 14:2xx header). */
export async function PortalHeader({ org, project, library = true, search }: { org: string; project?: { title: string }; library?: boolean; search?: 'library' | 'project' }) {
  const t = await getTranslations('portal');
  let logo = false;
  try { logo = (await getSql()`select 1 from settings where key = 'logo'`).length > 0; } catch { /* keep the mark */ }
  return (
    <header className={s.header}>
      {library ? (
        <Link href="/library" className={s.brand}>
          <span className={s.brandMark} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny same-origin logo */}
            {logo ? <img src="/api/branding/logo" alt="" width={24} height={24} style={{ objectFit: 'contain' }} /> : <Film size={18} />}
          </span>
          <span className={s.brandName}>{org}</span>
        </Link>
      ) : (
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden><Film size={18} /></span>
          <span className={s.brandName}>{org}</span>
        </span>
      )}
      <nav className={s.crumbs} aria-label={t('myLibrary')}>
        {library ? <Link href="/library" aria-current={project ? undefined : 'page'}>{t('myLibrary')}</Link> : null}
        {project ? (
          <>
            {library ? <ChevronRight size={14} className={s.chev} aria-hidden /> : null}
            <span aria-current="page">{project.title}</span>
          </>
        ) : null}
      </nav>
      <div className={s.headEnd}>
        {search ? <PortalSearch scope={search} /> : null}
        <LangSwitch />
        <ThemeToggle initial={(await cookies()).get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark'} />
      </div>
    </header>
  );
}
