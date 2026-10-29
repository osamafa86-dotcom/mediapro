import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import s from '@/components/upload/upload.module.css';
import { requireStaffPage } from '@/lib/auth/session';
import { listProjectsForStaff } from '@/lib/authz';

/** «مشاريعي»: straight to the newest project that still takes uploads. */
export default async function MyProjects() {
  const staff = await requireStaffPage();
  const projects = (await listProjectsForStaff(staff)).filter((p) => p.status !== 'expired');
  const open = projects.find((p) => ['uploading', 'draft'].includes(p.status)) ?? projects[0];
  if (open) redirect(`/upload/${open.id}`);
  const t = await getTranslations('upload');
  return <p className={s.empty}>{t('noProjects')}</p>;
}
