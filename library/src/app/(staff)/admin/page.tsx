import { getTranslations } from 'next-intl/server';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { StatusBadge, type ProjectStatus } from '@/components/ui';
import { requireStaffPage } from '@/lib/auth/session';
import { listProjectsForStaff } from '@/lib/authz';
import s from './admin.module.css';

export default async function AdminHome() {
  const staff = await requireStaffPage();
  const t = await getTranslations();
  const projects = await listProjectsForStaff(staff);
  return (
    <main className={s.main}>
      <header className={s.head}>
        <div>
          <h1 className="t-title">{t('admin.hello', { name: staff.name })}</h1>
          <p className={s.muted}>{t(`auth.roles.${staff.role}`)}</p>
        </div>
        <LogoutButton />
      </header>
      <p className={s.muted}>{t('admin.placeholder')}</p>
      <h2 className="t-heading">{t('admin.projects')}</h2>
      {projects.length === 0 ? <p className={s.muted}>{t('admin.noProjects')}</p> : (
        <ul className={s.list} data-testid="staff-projects">
          {projects.map((p) => (
            <li key={p.id} data-project-id={p.id}><span>{p.title}</span><StatusBadge status={p.status as ProjectStatus} label={t(`status.${p.status}`)} /></li>
          ))}
        </ul>
      )}
    </main>
  );
}
