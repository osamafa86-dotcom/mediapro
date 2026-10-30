'use client';
import { Archive, Link2, Pencil, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import { fetchJson, ProjectDialog, type ProjectOptions, type ProjectValues } from './ProjectForm';
import { RowMenu } from './RowMenu';
import { ShareDialog } from './ShareDialog';
import s from './admin.module.css';

export interface ProjectInfo {
  id: string; title: string; status: string; archived: boolean; clientId: string; clientName: string;
  defaultDays: number; hasEmail: boolean; readyCount: number; timeZone: string;
  /** every file in the project (for the delete confirmation) */
  assetCount?: number;
}

export function ProjectActions({ admin, project, edit }: { admin: boolean; project: ProjectInfo; edit: { options: ProjectOptions; values: ProjectValues } }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function bulk(action: 'publish' | 'archive' | 'unarchive') {
    setBusy(true); setMsg(null);
    const r = await postJson<{ changed?: number }>('/api/admin/projects/bulk', { ids: [project.id], action });
    setBusy(false);
    if (!r.ok) setMsg(t('common.error'));
    else if (action === 'publish' && !r.data.changed) setMsg(t('archive.publishSkipped'));
    router.refresh();
  }

  return (
    <>
      {msg ? <p className={s.formMsg} data-kind="error" role="alert">{msg}</p> : null}
      <Link href={`/upload/${project.id}`} className={s.btnLink}><Upload size={16} aria-hidden />&nbsp;{t('project.upload')}</Link>
      <ProjectDialog options={edit.options} project={{ id: project.id, ...edit.values }}
        trigger={(open) => <Button variant="ghost" icon={<Pencil size={16} />} onPress={open}>{t('common.edit')}</Button>} />
      {admin ? (
        <>
          <Button variant="ghost" icon={<Archive size={16} />} isDisabled={busy} onPress={() => void bulk(project.archived ? 'unarchive' : 'archive')}>
            {project.archived ? t('project.unarchive') : t('project.archive')}
          </Button>
          <Button variant="secondary" icon={<Link2 size={16} />} onPress={() => setShareOpen(true)}>{t('project.createLink')}</Button>
          {project.status !== 'published' ? (
            <Button variant="primary" icon={<Upload size={16} />} isDisabled={busy || project.readyCount === 0} onPress={() => void bulk('publish')}>{t('project.publish')}</Button>
          ) : null}
          <Button variant="ghost" icon={<Trash2 size={16} />} onPress={() => setDeleting(true)} data-testid="delete-project">{t('project.delete')}</Button>
          {shareOpen ? <ShareDialog open onOpenChange={(v) => { setShareOpen(v); if (!v) router.refresh(); }} project={project} /> : null}
          <DeleteProjectsDialog open={deleting} onOpenChange={setDeleting} ids={[project.id]} title={project.title} files={project.assetCount ?? 0}
            onDone={() => { router.push('/admin/archive'); router.refresh(); }} />
        </>
      ) : null}
    </>
  );
}

/** Per-link actions on the project page, in one «⋯»: copy the short link, new PIN (older PIN links only), e-mail the link, revoke. */
export function LinkRowActions({ id, code, hasPin = true }: { id: string; code: string | null; hasPin?: boolean }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className={s.actions} style={{ marginInlineStart: 'auto', alignItems: 'center', flexWrap: 'nowrap' }}>
      {note ? <span className={`${s.small} ${s.muted}`} role="status" data-testid="link-note">{note}</span> : null}
      <RowMenu label={t('common.more')} entries={[
        ...(code ? [{ id: 'copy', label: t('common.copy'), onAction: async () => { await navigator.clipboard.writeText(`${location.origin}/c/${code}`); setNote(t('common.copied')); } }] : []),
        // the project's permanent link has no PIN to renew
        ...(hasPin ? [{ id: 'pin', label: t('project.newPin'), onAction: async () => {
          const r = await postJson<{ pin?: string }>(`/api/admin/links/${id}/pin`, {});
          setNote(r.ok && r.data.pin ? t('project.newPinShown', { pin: r.data.pin }) : t('common.error'));
          router.refresh();
        } }] : []),
        { id: 'send', label: t('share.send'), onAction: async () => {
          const r = await postJson<{ error?: string }>(`/api/admin/links/${id}/send`, {});
          setNote(r.ok ? t('common.saved') : r.data.error === 'client_has_no_email' ? t('share.noEmail') : t('common.error'));
        } },
        'separator',
        { id: 'revoke', label: t('project.revoke'), danger: true, onAction: async () => {
          if (!confirm(t('project.revokeConfirm'))) return;
          await postJson(`/api/admin/links/${id}/revoke`, {});
          router.refresh();
        } },
      ]} />
    </span>
  );
}

/**
 * The admin's «حذف المشروع» (one, or several from the archive's selection): says what goes — every file, the
 * albums, the project's own links and the clients' notes — and asks for a tick before the red button works.
 */
export function DeleteProjectsDialog({ open, onOpenChange, ids, title, files, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; ids: string[]; title?: string; files?: number; onDone: (n: number) => void;
}) {
  const t = useTranslations('admin');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    const r = ids.length === 1
      ? await fetchJson(`/api/admin/projects/${ids[0]}`, 'DELETE')
      : await postJson<{ changed?: number }>('/api/admin/projects/bulk', { ids, action: 'delete' });
    setBusy(false);
    if (!r.ok) { setErr(t('common.error')); return; }
    setSure(false);
    onOpenChange(false);
    onDone(ids.length === 1 ? 1 : Number((r.data as { changed?: number }).changed ?? ids.length));
  }
  return (
    <AdminDialog open={open} onOpenChange={(v) => { if (!v) { setSure(false); setErr(null); } onOpenChange(v); }}
      title={ids.length === 1 && title ? t('project.deleteTitle', { title }) : t('project.deleteTitleN', { n: ids.length })}
      subtitle={files !== undefined && ids.length === 1 ? t('project.deleteBody', { n: files }) : t('project.deleteBodyN')}
      closeLabel={t('common.close')} testId="delete-project-dialog">
      <label className={s.checkRow}>
        <input type="checkbox" className={s.checkbox} checked={sure} onChange={(e) => setSure(e.target.checked)} data-testid="delete-sure" />
        {t('project.deleteSure')}
      </label>
      {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
      <div className={s.actions} style={{ justifyContent: 'flex-end' }}>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>{t('common.cancel')}</Button>
        <Button variant="danger" icon={<Trash2 size={16} />} isDisabled={!sure || busy} onPress={() => void go()}>{t('project.deleteConfirm')}</Button>
      </div>
    </AdminDialog>
  );
}
