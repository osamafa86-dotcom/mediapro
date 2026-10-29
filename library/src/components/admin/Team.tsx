'use client';
import { Lock, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import { fetchJson } from './ProjectForm';
import { RowMenu } from './RowMenu';
import { SwitchRow } from './SwitchRow';
import s from './admin.module.css';

const ROLES = ['photographer', 'editor', 'contributor'] as const;
type TeamRole = (typeof ROLES)[number];
const PERMS = ['upload', 'createProject', 'publishWithoutReview', 'seeClientLinks', 'deleteAfterPublish'] as const;
type Perm = (typeof PERMS)[number];
const LOCKED: Perm[] = ['seeClientLinks'];
type Matrix = Record<TeamRole, Record<Perm, boolean>>;

export function InviteButton({ openInitially = false }: { openInitially?: boolean }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [v, setV] = useState({ name: '', email: '', role: 'photographer' as TeamRole, title: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      {sent ? <p className={s.formMsg} data-kind="ok" role="status" style={{ alignSelf: 'center' }}>{sent}</p> : null}
      <Button variant="primary" icon={<Plus size={18} />} onPress={() => { setMsg(null); setSent(null); setV({ name: '', email: '', role: 'photographer', title: '' }); setOpen(true); }}>{t('team.invite')}</Button>
      <AdminDialog open={open} onOpenChange={setOpen} title={t('team.inviteTitle')} closeLabel={t('common.close')} testId="invite-dialog">
        <form className={s.form} onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setMsg(null);
          const r = await postJson<{ error?: string }>('/api/admin/team/invite', { ...v, title: v.title || null });
          setBusy(false);
          // success closes the dialog and confirms beside the button (focus returns to it)
          if (r.ok) { setOpen(false); setSent(t('team.invited', { email: v.email })); router.refresh(); }
          else setMsg({ kind: 'error', text: r.data.error === 'email_taken' ? t('team.emailTaken') : t('common.error') });
        }}>
          <TextField label={t('team.name')} value={v.name} onChange={(x) => setV({ ...v, name: x })} isRequired minLength={2} autoFocus />
          <TextField label={t('team.email')} type="email" value={v.email} onChange={(x) => setV({ ...v, email: x })} isRequired />
          <div>
            <span className={s.fieldLabel} id="inv-role">{t('team.role')}</span>
            <div className={s.segmented} role="group" aria-labelledby="inv-role">
              {ROLES.map((r) => <button key={r} type="button" aria-pressed={v.role === r} onClick={() => setV({ ...v, role: r })}>{t(`roles.${r}`)}</button>)}
            </div>
          </div>
          <TextField label={t('team.titleField')} description={t('team.titleHelp')} value={v.title} onChange={(x) => setV({ ...v, title: x })} />
          {msg ? <p className={s.formMsg} data-kind={msg.kind} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
          <div className={s.actions}><Button type="submit" variant="primary" isDisabled={busy}>{t('team.sendInvite')}</Button></div>
        </form>
      </AdminDialog>
    </>
  );
}

/** Row actions: the pending invite keeps its visible «إعادة الإرسال» (as drawn); everything else lives in «⋯». */
export function MemberMenu({ id, name, state, role }: { id: string; name: string; state: 'active' | 'pending' | 'suspended'; role: TeamRole }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const patch = async (body: Record<string, unknown>) => { const r = await fetchJson(`/api/admin/team/${id}`, 'PATCH', body); setNote(r.ok ? null : t('common.error')); router.refresh(); };
  return (
    <span className={s.actions} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
      {note ? <span className={`${s.small} ${s.muted}`} role="status">{note}</span> : null}
      {state === 'pending' ? (
        <button type="button" className={s.textBtn} onClick={async () => { const r = await postJson(`/api/admin/team/${id}/resend`, {}); setNote(r.ok ? t('team.resent') : t('common.error')); }}>{t('team.resend')}</button>
      ) : null}
      <RowMenu label={`${t('common.more')}: ${name}`} entries={[
        { header: t('team.changeRole') },
        ...ROLES.map((r) => ({ id: `role-${r}`, label: t(`roles.${r}`), selected: role === r, onAction: () => void patch({ role: r }) })),
        'separator',
        state === 'suspended'
          ? { id: 'reactivate', label: t('team.reactivate'), onAction: () => void patch({ disabled: false }) }
          : { id: 'suspend', label: t('team.suspend'), danger: true, onAction: () => void patch({ disabled: true }) },
      ]} />
    </span>
  );
}

/** «صلاحيات الأدوار» (Figma 61:647). Changes save immediately; locked rows can never be turned on. */
export function RolePermissions({ initial }: { initial: Matrix }) {
  const t = useTranslations('admin');
  const [m, setM] = useState<Matrix>(initial);
  const [role, setRole] = useState<TeamRole>('photographer');
  const [msg, setMsg] = useState<string | null>(null);
  async function toggle(p: Perm, on: boolean) {
    const next = { ...m, [role]: { ...m[role], [p]: on } };
    setM(next); setMsg(null);
    const r = await fetchJson('/api/admin/settings/rolePermissions', 'PUT', next);
    if (!r.ok) { setM(m); setMsg(t('common.error')); }
  }
  return (
    <aside className={`${s.card} ${s.panel}`} aria-labelledby="h-perms" data-testid="role-permissions">
      <div className={s.sectionHead} style={{ borderBlockEnd: 0, paddingBlockEnd: 0 }}>
        <h2 id="h-perms">{t('team.perms')}</h2>
        <p>{t('team.permsSub')}</p>
        <div className={s.segmented} role="group" aria-label={t('team.role')} style={{ marginBlockStart: 12 }}>
          {ROLES.map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>{t(`roles.${r}`)}</button>)}
        </div>
      </div>
      <div className={s.panelBody} style={{ gap: 0 }}>
        {PERMS.map((p) => (
          <SwitchRow key={p} testId={`perm-${p}`} title={t(`team.perm.${p}`)} hint={t(`team.perm.${p}Sub` as 'team.perm.uploadSub')}
            isSelected={LOCKED.includes(p) ? false : m[role][p]} isDisabled={LOCKED.includes(p)} onChange={(on) => void toggle(p, on)} />
        ))}
        {msg ? <p className={s.formMsg} data-kind="error" role="alert">{msg}</p> : null}
      </div>
      <p className={s.lockNote}><Lock size={16} aria-hidden style={{ flex: 'none', marginBlockStart: 2 }} />{t('team.permsLock')}</p>
    </aside>
  );
}
