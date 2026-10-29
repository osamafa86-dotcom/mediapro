'use client';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

export interface ProjectOptions {
  admin: boolean;
  clients: { id: string; name: string }[];
  people: { id: string; name: string }[];
}
export interface ProjectValues { title: string; clientId: string; type: string; shotDate: string; place: string; memberIds: string[] }

const empty: ProjectValues = { title: '', clientId: '', type: '', shotDate: '', place: '', memberIds: [] };

export function ProjectDialog({ options, project, trigger }: {
  options: ProjectOptions; project?: { id: string } & ProjectValues; trigger: (open: () => void) => React.ReactNode;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ProjectValues>(project ?? { ...empty, clientId: options.clients[0]?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ProjectValues>(k: K, val: ProjectValues[K]) => setV((x) => ({ ...x, [k]: val }));

  async function submit() {
    setBusy(true); setErr(null);
    const body = {
      title: v.title, type: v.type || null, shotDate: v.shotDate || null, place: v.place || null,
      ...(options.admin ? { clientId: v.clientId || null, memberIds: v.memberIds } : {}),
    };
    const r = project
      ? await fetchJson(`/api/admin/projects/${project.id}`, 'PATCH', body)
      : await postJson<{ id?: string }>('/api/admin/projects', body);
    setBusy(false);
    if (!r.ok) { setErr(t('common.error')); return; }
    setOpen(false);
    if (project) router.refresh(); else router.push(`/admin/projects/${(r.data as { id: string }).id}`);
  }

  return (
    <>
      {trigger(() => { setV(project ?? { ...empty, clientId: options.clients[0]?.id ?? '' }); setErr(null); setOpen(true); })}
      <AdminDialog open={open} onOpenChange={setOpen} title={project ? t('project.editTitle') : t('project.new')} closeLabel={t('common.close')} testId="project-dialog">
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <TextField label={t('project.title')} description={t('project.titleHelp')} value={v.title} onChange={(x) => set('title', x)} isRequired minLength={2} autoFocus />
          {options.admin ? (
            options.clients.length ? (
              <label>
                <span className={s.fieldLabel}>{t('project.client')}</span>
                <select className={s.nativeSelect} value={v.clientId} onChange={(e) => set('clientId', e.target.value)} required>
                  {options.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : <p className={s.formMsg} data-kind="error">{t('project.noProjectsForClient')}</p>
          ) : <p className={`${s.small} ${s.muted}`}>{t('project.clientInbox')}</p>}
          <div className={s.row2}>
            <TextField label={t('project.type')} value={v.type} onChange={(x) => set('type', x)} />
            <TextField label={t('project.date')} type="date" value={v.shotDate} onChange={(x) => set('shotDate', x)} />
          </div>
          <TextField label={t('project.place')} value={v.place} onChange={(x) => set('place', x)} />
          {options.admin && options.people.length ? (
            <fieldset className={s.fieldset}>
              <legend className={s.fieldLabel}>{t('project.members')}</legend>
              {options.people.map((p) => (
                <label key={p.id} className={s.checkRow}>
                  <input type="checkbox" className={s.checkbox} checked={v.memberIds.includes(p.id)}
                    onChange={(e) => set('memberIds', e.target.checked ? [...v.memberIds, p.id] : v.memberIds.filter((x) => x !== p.id))} />
                  {p.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
          <div className={s.actions}>
            <Button type="submit" variant="primary" isDisabled={busy || v.title.trim().length < 2 || (options.admin && !v.clientId)}>{project ? t('common.save') : t('project.create')}</Button>
            <Button variant="ghost" onPress={() => setOpen(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}

export function NewProjectTrigger({ options }: { options: ProjectOptions }) {
  const t = useTranslations('admin');
  return <ProjectDialog options={options} trigger={(open) => <Button variant="primary" icon={<Plus size={18} />} onPress={open}>{t('common.newProject')}</Button>} />;
}

/** PATCH/PUT/DELETE with the staff CSRF token. */
export async function fetchJson(url: string, method: string, body?: unknown) {
  const csrf = document.cookie.split('; ').find((c) => c.startsWith('ml_csrf=') || c.startsWith('__Host-ml_csrf='))?.split('=')[1] ?? '';
  try {
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}
