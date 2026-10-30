'use client';
import { FolderPlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import { fetchJson } from './ProjectForm';
import { RowMenu } from './RowMenu';
import s from './admin.module.css';

/** «ألبوم جديد» beside the project's tabs: a name, then the page opens on the new album. */
export function NewAlbumButton({ projectId }: { projectId: string }) {
  const t = useTranslations('admin.albums');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true); setErr(null);
    const r = await postJson<{ id?: string; error?: string }>(`/api/admin/projects/${projectId}/albums`, { name: name.trim() });
    setBusy(false);
    if (!r.ok || !r.data.id) { setErr(r.data.error === 'album_exists' ? t('exists') : tc('error')); return; }
    setOpen(false);
    router.push(`/admin/projects/${projectId}?tab=${r.data.id}`, { scroll: false });
    router.refresh();
  }
  return (
    <>
      <button type="button" className={s.newAlbum} onClick={() => { setName(''); setErr(null); setOpen(true); }} data-testid="new-album">
        <FolderPlus size={16} aria-hidden />{t('new')}
      </button>
      <AdminDialog open={open} onOpenChange={setOpen} title={t('new')} subtitle={t('newBody')} closeLabel={tc('close')} testId="album-dialog">
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (name.trim()) void create(); }}>
          <TextField label={t('name')} description={t('nameHelp')} value={name} onChange={setName} isRequired maxLength={60} autoFocus />
          <div className={s.chips} role="group" aria-label={t('suggestions')}>
            {(t.raw('presets') as string[]).map((p) => (
              <button key={p} type="button" className={s.presetChip} onClick={() => setName(p)}>{p}</button>
            ))}
          </div>
          {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
          <div className={s.actions}>
            <Button type="submit" variant="primary" isDisabled={busy || !name.trim()}>{t('create')}</Button>
            <Button variant="ghost" onPress={() => setOpen(false)}>{tc('cancel')}</Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}

/** The open album's «⋯»: rename, and delete (its files go back to «الصور»/«الفيديو», nothing is lost). */
export function AlbumMenu({ projectId, album, canDelete }: { projectId: string; album: { id: string; name: string; n: number }; canDelete: boolean }) {
  const t = useTranslations('admin.albums');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(album.name);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function rename() {
    setBusy(true); setErr(null);
    const r = await fetchJson(`/api/admin/albums/${album.id}`, 'PATCH', { name: name.trim() });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error === 'album_exists' ? t('exists') : tc('error')); return; }
    setRenaming(false);
    router.refresh();
  }
  async function remove() {
    setBusy(true);
    const r = await fetchJson(`/api/admin/albums/${album.id}`, 'DELETE');
    setBusy(false);
    if (!r.ok) { setErr(tc('error')); return; }
    setDeleting(false);
    router.push(`/admin/projects/${projectId}`, { scroll: false });
    router.refresh();
  }
  return (
    <>
      <RowMenu label={`${tc('more')}: ${album.name}`} entries={[
        { id: 'rename', label: t('rename'), onAction: () => { setName(album.name); setErr(null); setRenaming(true); } },
        ...(canDelete ? [{ id: 'delete', label: t('delete'), danger: true, onAction: () => { setErr(null); setDeleting(true); } }] : []),
      ]} />
      <AdminDialog open={renaming} onOpenChange={setRenaming} title={t('rename')} closeLabel={tc('close')} testId="album-rename">
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (name.trim()) void rename(); }}>
          <TextField label={t('name')} value={name} onChange={setName} isRequired maxLength={60} autoFocus />
          {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
          <div className={s.actions}>
            <Button type="submit" variant="primary" isDisabled={busy || !name.trim()}>{tc('save')}</Button>
            <Button variant="ghost" onPress={() => setRenaming(false)}>{tc('cancel')}</Button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog open={deleting} onOpenChange={setDeleting} title={t('deleteTitle', { name: album.name })}
        subtitle={album.n ? t('deleteBodyFiles', { n: album.n }) : t('deleteBodyEmpty')} closeLabel={tc('close')} testId="album-delete">
        {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
        <div className={s.actions} style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onPress={() => setDeleting(false)}>{tc('cancel')}</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} isDisabled={busy} onPress={() => void remove()}>{t('delete')}</Button>
        </div>
      </AdminDialog>
    </>
  );
}
