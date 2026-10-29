import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { NotesInbox } from '@/components/admin/NotesInbox';
import { getSql } from '@/db';
import { requireStaffPage } from '@/lib/auth/session';
import { isUuid } from '@/lib/authz';
import { inbox, noteThreadForStaff } from '@/lib/notes';

/** «ملاحظات العملاء» (Figma 20): the list by project at the inline start, the selected note at the end. */
export default async function NotesPage({ searchParams }: { searchParams: Promise<{ state?: string; assignee?: string; id?: string }> }) {
  const staff = await requireStaffPage();
  const t = await getTranslations('admin.notes');
  const sp = await searchParams;
  const state = sp.state === 'resolved' ? 'resolved' : 'open';
  const admin = staff.role === 'admin';
  const assignee = admin && sp.assignee && isUuid(sp.assignee) ? sp.assignee : undefined;
  const { items, counts } = await inbox(staff, { state, assignee });
  const selectedId = sp.id && isUuid(sp.id) && items.some((i) => i.id === sp.id) ? sp.id : items[0]?.id ?? null;
  const thread = selectedId ? await noteThreadForStaff(staff, selectedId) : [];
  // who can be assigned: the admins and this project's own team
  const projectId = items.find((i) => i.id === selectedId)?.project_id ?? null;
  const team = admin ? await getSql()<{ id: string; name: string; role: string }[]>`select id, name, role from users u where u.disabled_at is null
    and (u.role = 'admin' or exists (select 1 from project_members m where m.project_id = ${projectId} and m.user_id = u.id)) order by u.role = 'admin', u.name` : [];
  return (
    <>
      <PageHead title={t('title')} subtitle={t('subtitle')} />
      <NotesInbox admin={admin} state={state} assignee={assignee ?? ''} items={items} counts={counts} selectedId={selectedId} thread={thread} team={team} />
    </>
  );
}
