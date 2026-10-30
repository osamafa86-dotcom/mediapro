'use client';
import { ListX, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, ComboField, TextField } from '@/components/ui';
import { normalizeSearch } from '@/lib/format';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

export interface ProjectOptions {
  admin: boolean;
  clients: { id: string; name: string }[];
  people: { id: string; name: string }[];
  /** saved choices for «اسم المشروع» and «نوع المشروع» (each value typed once is offered again) */
  titles: Preset[]; types: Preset[];
}
export type Preset = { value: string; removable: boolean };
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
  const [managing, setManaging] = useState(false);
  const [presets, setPresets] = useState({ titles: options.titles, types: options.types });
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
          <ComboField label={t('project.title')} description={t('project.titleHelp')} value={v.title} onChange={(x) => set('title', x)} isRequired autoFocus
            options={presets.titles.map((p) => p.value)} normalize={normalizeSearch} emptyLabel={t('presets.newValue')} testId="title-combo" />
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
            <ComboField label={t('project.type')} value={v.type} onChange={(x) => set('type', x)}
              options={presets.types.map((p) => p.value)} normalize={normalizeSearch} emptyLabel={t('presets.newValue')} testId="type-combo" />
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
          {presets.titles.some((p) => p.removable) || presets.types.some((p) => p.removable) ? (
            <button type="button" className={s.textBtn} style={{ justifySelf: 'start' }} onClick={() => setManaging(true)} data-testid="manage-presets">
              <ListX size={14} aria-hidden style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />{t('presets.manage')}
            </button>
          ) : null}
          {err ? <p className={s.formMsg} data-kind="error" role="alert">{err}</p> : null}
          <div className={s.actions}>
            <Button type="submit" variant="primary" isDisabled={busy || v.title.trim().length < 2 || (options.admin && !v.clientId)}>{project ? t('common.save') : t('project.create')}</Button>
            <Button variant="ghost" onPress={() => setOpen(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog open={managing} onOpenChange={setManaging} title={t('presets.manage')} subtitle={t('presets.manageBody')} closeLabel={t('common.close')} testId="presets-dialog">
        {(['titles', 'types'] as const).map((k) => presets[k].some((p) => p.removable) ? (
          <section key={k} className={s.presetList}>
            <h3>{t(k === 'titles' ? 'project.title' : 'project.type')}</h3>
            <ul>
              {presets[k].filter((p) => p.removable).map((p) => (
                <li key={p.value}>
                  <bdi>{p.value}</bdi>
                  <button type="button" className={s.rowMenu} aria-label={t('presets.remove', { value: p.value })} title={t('presets.remove', { value: p.value })}
                    onClick={async () => {
                      const r = await postJson('/api/admin/presets', { kind: k === 'titles' ? 'title' : 'type', value: p.value });
                      if (r.ok) setPresets((x) => ({ ...x, [k]: x[k].filter((y) => y.value !== p.value) }));
                    }}><X size={16} aria-hidden /></button>
                </li>
              ))}
            </ul>
          </section>
        ) : null)}
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
