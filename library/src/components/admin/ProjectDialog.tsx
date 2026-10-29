import { getLocale } from 'next-intl/server';
import { getSql } from '@/db';
import { requireStaffPage } from '@/lib/auth/session';
import { NewProjectTrigger, type ProjectOptions } from './ProjectForm';

/** Loads what the form may show: admins get clients and team; team roles get neither (they never see client names). */
export async function projectOptions(): Promise<ProjectOptions> {
  const staff = await requireStaffPage();
  if (staff.role !== 'admin') return { admin: false, clients: [], people: [] };
  const locale = await getLocale();
  const sql = getSql();
  const [clients, people] = await Promise.all([
    sql<{ id: string; name_ar: string; name_tr: string | null }[]>`select id, name_ar, name_tr from clients where archived_at is null order by name_ar`,
    sql<{ id: string; name: string }[]>`select id, name from users where role <> 'admin' and disabled_at is null order by name`,
  ]);
  return { admin: true, clients: clients.map((c) => ({ id: c.id, name: locale === 'tr' ? c.name_tr || c.name_ar : c.name_ar })), people };
}

export async function NewProjectButton() {
  return <NewProjectTrigger options={await projectOptions()} />;
}
