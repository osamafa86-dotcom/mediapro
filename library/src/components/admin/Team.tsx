'use client';
import { Check, KeyRound, Lock, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Switch, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import { fetchJson } from './ProjectForm';
import { RowMenu } from './RowMenu';
import s from './admin.module.css';

const ROLES = ['photographer', 'editor', 'contributor'] as const;
type TeamRole = (typeof ROLES)[number];
type Perm = 'upload' | 'createProject' | 'publishWithoutReview' | 'seeClientLinks' | 'deleteAfterPublish';
type Matrix = Record<TeamRole, Record<Perm, boolean>>;

/** 16 characters from an alphabet without look-alikes (0/O, 1/l/I): read aloud or typed from a note without mistakes. */
function generatePassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(r, (n) => abc[n % abc.length]).join('');
}

/** The password field the admin hands over: shown in clear (they copy it), with a generator. */
function PasswordField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const t = useTranslations('admin');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <TextField label={t('team.password')} description={t('team.passwordHelp')} value={value} onChange={onChange} isRequired maxLength={256}
        autoComplete="new-password" autoFocus={autoFocus} className={s.grow} />
      <Button variant="secondary" icon={<KeyRound size={16} />} onPress={() => onChange(generatePassword())}>{t('team.generate')}</Button>
    </div>
  );
}

const ERR: Record<string, string> = { email_taken: 'team.emailTaken', too_short: 'team.tooShort', sso_account: 'team.ssoAccount' };

export function InviteButton({ openInitially = false }: { openInitially?: boolean }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const empty = { name: '', email: '', role: 'photographer' as TeamRole, title: '', access: 'password' as 'password' | 'mail', password: '' };
  const [v, setV] = useState(empty);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      {sent ? <p className={s.formMsg} data-kind="ok" role="status" style={{ alignSelf: 'center' }}>{sent}</p> : null}
      <Button variant="primary" icon={<Plus size={18} />} onPress={() => { setMsg(null); setSent(null); setV(empty); setOpen(true); }}>{t('team.invite')}</Button>
      <AdminDialog open={open} onOpenChange={setOpen} title={t('team.inviteTitle')} closeLabel={t('common.close')} testId="invite-dialog">
        <form className={s.form} onSubmit={async (e) => {
          e.preventDefault();
          if (v.access === 'password' && v.password.length < 12) { setMsg({ kind: 'error', text: t('team.tooShort') }); return; }
          setBusy(true); setMsg(null);
          const r = await postJson<{ error?: string }>('/api/admin/team/invite', {
            name: v.name, email: v.email, role: v.role, title: v.title || null, ...(v.access === 'password' ? { password: v.password } : {}),
          });
          setBusy(false);
          // success closes the dialog and confirms beside the button (focus returns to it)
          if (r.ok) {
            setOpen(false);
            setSent(v.access === 'password' ? t('team.added', { name: v.name, email: v.email }) : t('team.invited', { email: v.email }));
            router.refresh();
          } else setMsg({ kind: 'error', text: t((ERR[r.data.error ?? ''] ?? 'common.error') as 'common.error') });
        }}>
          <TextField label={t('team.name')} value={v.name} onChange={(x) => setV({ ...v, name: x })} isRequired minLength={2} autoFocus />
          <TextField label={t('team.email')} type="email" value={v.email} onChange={(x) => setV({ ...v, email: x })} isRequired />
          <div>
            <span className={s.fieldLabel} id="inv-role">{t('team.role')}</span>
            <div className={s.segmented} role="group" aria-labelledby="inv-role">
              {ROLES.map((r) => <button key={r} type="button" aria-pressed={v.role === r} onClick={() => setV({ ...v, role: r })}>{t(`roles.${r}`)}</button>)}
            </div>
          </div>
          <div>
            <span className={s.fieldLabel} id="inv-access">{t('team.access')}</span>
            <div className={s.segmented} role="group" aria-labelledby="inv-access">
              {(['password', 'mail'] as const).map((a) => (
                <button key={a} type="button" aria-pressed={v.access === a} onClick={() => setV({ ...v, access: a })}>{t(a === 'password' ? 'team.accessPassword' : 'team.accessMail')}</button>
              ))}
            </div>
          </div>
          {v.access === 'password'
            ? <PasswordField value={v.password} onChange={(x) => setV({ ...v, password: x })} />
            : <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{t('team.accessMailHelp')}</p>}
          <TextField label={t('team.titleField')} description={t('team.titleHelp')} value={v.title} onChange={(x) => setV({ ...v, title: x })} />
          {msg ? <p className={s.formMsg} data-kind={msg.kind} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
          <div className={s.actions}><Button type="submit" variant="primary" isDisabled={busy}>{t(v.access === 'password' ? 'team.add' : 'team.sendInvite')}</Button></div>
        </form>
      </AdminDialog>
    </>
  );
}

/**
 * Row actions: a pending emailed invite keeps its visible «إعادة الإرسال» (as drawn); everything else lives in «⋯».
 * «تعيين كلمة مرور» is offered for local accounts only (SSO accounts sign in on the parent site).
 */
export function MemberMenu({ id, name, state, role, hasPassword, sso }: {
  id: string; name: string; state: 'active' | 'pending' | 'suspended'; role: TeamRole; hasPassword: boolean; sso: boolean;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = async (body: Record<string, unknown>) => { const r = await fetchJson(`/api/admin/team/${id}`, 'PATCH', body); setNote(r.ok ? null : t('common.error')); router.refresh(); };
  return (
    <span className={s.actions} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
      {note ? <span className={`${s.small} ${s.muted}`} role="status">{note}</span> : null}
      {state === 'pending' && !hasPassword ? (
        <button type="button" className={s.textBtn} onClick={async () => { const r = await postJson(`/api/admin/team/${id}/resend`, {}); setNote(r.ok ? t('team.resent') : t('common.error')); }}>{t('team.resend')}</button>
      ) : null}
      <RowMenu label={`${t('common.more')}: ${name}`} entries={[
        ...(sso ? [] : [{ id: 'password', label: t('team.setPassword'), onAction: () => { setPw(''); setPwMsg(null); setPwOpen(true); } }, 'separator' as const]),
        { header: t('team.changeRole') },
        ...ROLES.map((r) => ({ id: `role-${r}`, label: t(`roles.${r}`), selected: role === r, onAction: () => void patch({ role: r }) })),
        'separator',
        state === 'suspended'
          ? { id: 'reactivate', label: t('team.reactivate'), onAction: () => void patch({ disabled: false }) }
          : { id: 'suspend', label: t('team.suspend'), danger: true, onAction: () => void patch({ disabled: true }) },
      ]} />
      <AdminDialog open={pwOpen} onOpenChange={setPwOpen} title={t('team.setPasswordTitle', { name })} subtitle={t('team.setPasswordHelp', { name })}
        closeLabel={t('common.close')} testId="password-dialog">
        <form className={s.form} onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 12) { setPwMsg(t('team.tooShort')); return; }
          setBusy(true); setPwMsg(null);
          const r = await fetchJson(`/api/admin/team/${id}/password`, 'PUT', { password: pw });
          setBusy(false);
          if (r.ok) { setPwOpen(false); setNote(t('team.passwordSet')); router.refresh(); }
          else setPwMsg(t((ERR[String(r.data.error ?? '')] ?? 'common.error') as 'common.error'));
        }}>
          <PasswordField value={pw} onChange={setPw} autoFocus />
          {pwMsg ? <p className={s.formMsg} data-kind="error" role="alert">{pwMsg}</p> : null}
          <div className={s.actions}><Button type="submit" variant="primary" isDisabled={busy}>{t('common.save')}</Button></div>
        </form>
      </AdminDialog>
    </span>
  );
}

/** What every role may do, side by side. Only what the server enforces is listed: the three switches (saved at once)
 * and the fixed rules (deletion included: the admin anything, a member what they uploaded before publication). */
const EDITABLE = ['upload', 'createProject', 'publishWithoutReview'] as const;
type Editable = (typeof EDITABLE)[number];
const FIXED = [
  { key: 'viewProjects', admin: 'all', team: 'assigned' },
  { key: 'notes', admin: 'all', team: 'assigned' },
  { key: 'delete', admin: 'all', team: 'own' },
  { key: 'clients', admin: 'yes', team: 'no' },
  { key: 'users', admin: 'yes', team: 'no' },
  { key: 'settings', admin: 'yes', team: 'no' },
] as const;

function Fixed({ v }: { v: 'all' | 'assigned' | 'own' | 'yes' | 'no' }) {
  const t = useTranslations('admin.team.matrix');
  if (v === 'yes') return <span className={s.mxYes}><Check size={16} aria-hidden /><span className="sr-only">{t('yes')}</span></span>;
  if (v === 'no') return <span className={s.mxNo}><Minus size={16} aria-hidden /><span className="sr-only">{t('no')}</span></span>;
  return <span className={`${s.small} ${v === 'all' ? '' : s.muted}`}>{t(v)}</span>;
}

export function PermissionsMatrix({ initial }: { initial: Matrix }) {
  const t = useTranslations('admin');
  const [m, setM] = useState<Matrix>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  async function toggle(role: TeamRole, p: Editable, on: boolean) {
    const before = m;
    const next = { ...m, [role]: { ...m[role], [p]: on } };
    setM(next); setMsg(null);
    const r = await fetchJson('/api/admin/settings/rolePermissions', 'PUT', next);
    if (!r.ok) { setM(before); setMsg(t('common.error')); }
  }
  return (
    <section className={`${s.card} ${s.matrix}`} aria-labelledby="h-perms" data-testid="role-permissions">
      <div className={s.sectionHead}>
        <h2 id="h-perms">{t('team.matrix.title')}</h2>
        <p>{t('team.matrix.sub')}</p>
      </div>
      <table className={s.mxTable}>
        <caption className="sr-only">{t('team.matrix.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('team.matrix.perm')}</th>
            <th scope="col" className={s.mxCol} data-admin>{t('team.matrix.admin')}</th>
            {ROLES.map((r) => <th key={r} scope="col" className={s.mxCol}>{t(`roles.${r}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className={s.mxGroup}><th scope="rowgroup" colSpan={5}>{t('team.matrix.editable')}</th></tr>
          {EDITABLE.map((p) => (
            <tr key={p} data-testid={`perm-${p}`}>
              <th scope="row" className={s.mxPerm}><strong>{t(`team.perm.${p}`)}</strong><span>{t(`team.perm.${p}Sub` as 'team.perm.uploadSub')}</span></th>
              <td className={s.mxCol} data-admin><Fixed v="yes" /></td>
              {ROLES.map((r) => (
                <td key={r} className={s.mxCol}>
                  <Switch isSelected={m[r][p]} onChange={(on) => void toggle(r, p, on)} className={s.mxSwitch} data-testid={`perm-${p}-${r}`}>
                    <span className="sr-only">{`${t(`team.perm.${p}`)} — ${t(`roles.${r}`)}`}</span>
                  </Switch>
                </td>
              ))}
            </tr>
          ))}
          <tr className={s.mxGroup}><th scope="rowgroup" colSpan={5}><Lock size={14} aria-hidden /> {t('team.matrix.fixed')}</th></tr>
          {FIXED.map((f) => (
            <tr key={f.key} data-testid={`fixed-${f.key}`}>
              <th scope="row" className={s.mxPerm}><strong>{t(`team.matrix.${f.key}`)}</strong><span>{t(`team.matrix.${f.key}Sub`)}</span></th>
              <td className={s.mxCol} data-admin><Fixed v={f.admin} /></td>
              {ROLES.map((r) => <td key={r} className={s.mxCol}><Fixed v={f.team} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {msg ? <p className={s.formMsg} data-kind="error" role="alert" style={{ padding: '0 20px 12px' }}>{msg}</p> : null}
      <p className={s.lockNote}><Lock size={16} aria-hidden style={{ flex: 'none', marginBlockStart: 2 }} />{t('team.matrix.deleteNote')}</p>
    </section>
  );
}
