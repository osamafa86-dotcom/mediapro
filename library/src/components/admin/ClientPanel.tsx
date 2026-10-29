'use client';
import { Archive, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { fetchJson } from './ProjectForm';
import { SwitchRow } from './SwitchRow';
import s from './admin.module.css';

export interface ClientValues {
  nameAr: string; nameTr: string; kind: 'partner' | 'beneficiary'; contactName: string; contactPhone: string; contactEmail: string;
  locale: 'ar' | 'tr'; defaultLinkDays: number; allowRaw: boolean; expiryReminder: boolean;
}

/** «تعديل العميل» side panel (Figma 59:532). */
export function ClientPanel({ client, closeHref }: { client: ClientValues & { id: string | null; createdAt?: string; projects?: number; archived?: boolean }; closeHref: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [v, setV] = useState<ClientValues>(client);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const set = <K extends keyof ClientValues>(k: K, val: ClientValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const name = v.nameAr || t('clients.createTitle');

  async function save() {
    setBusy(true); setMsg(null);
    const r = client.id ? await fetchJson(`/api/admin/clients/${client.id}`, 'PATCH', v) : await postJson<{ id: string }>('/api/admin/clients', v);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'error', text: t('common.error') }); return; }
    setMsg({ kind: 'ok', text: t('common.saved') });
    if (!client.id) router.replace(`/admin/clients?id=${(r.data as { id: string }).id}`, { scroll: false });
    router.refresh();
  }

  return (
    <aside className={`${s.card} ${s.panel}`} aria-label={client.id ? t('clients.edit') : t('clients.createTitle')} data-testid="client-panel">
      <div className={s.panelHead}>
        <span className={s.initial} aria-hidden>{name.trim().charAt(0)}</span>
        <div className={s.itemText}>
          <h2>{client.id ? t('clients.edit') : t('clients.createTitle')}</h2>
          {client.createdAt ? <span className={`${s.small} ${s.tertiary}`}>{t('clients.since', { date: client.createdAt, n: client.projects ?? 0 })}</span> : null}
        </div>
        <Link href={closeHref} className={s.rowMenu} aria-label={t('common.close')} scroll={false}><X size={18} aria-hidden /></Link>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); void save(); }} id="client-form">
        <TextField label={t('clients.nameAr')} description={t('clients.nameArHelp')} value={v.nameAr} onChange={(x) => set('nameAr', x)} isRequired minLength={2} />
        <TextField label={t('clients.nameTr')} value={v.nameTr} onChange={(x) => set('nameTr', x)} />
        <div>
          <span className={s.fieldLabel} id="rel">{t('clients.relation')}</span>
          <div className={s.segmented} role="group" aria-labelledby="rel">
            {(['partner', 'beneficiary'] as const).map((k) => <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set('kind', k)}>{t(`clients.kind.${k}`)}</button>)}
          </div>
        </div>
        <div className={s.row2}>
          <TextField label={t('clients.contact')} value={v.contactName} onChange={(x) => set('contactName', x)} />
          <TextField label={t('clients.phone')} type="tel" value={v.contactPhone} onChange={(x) => set('contactPhone', x)} />
        </div>
        <TextField label={t('clients.email')} description={t('clients.emailHelp')} type="email" value={v.contactEmail} onChange={(x) => set('contactEmail', x)} />
        <div className={s.row2}>
          <label>
            <span className={s.fieldLabel}>{t('clients.locale')}</span>
            <select className={s.nativeSelect} value={v.locale} onChange={(e) => set('locale', e.target.value as 'ar' | 'tr')}>
              <option value="ar" lang="ar">العربية</option>
              <option value="tr" lang="tr">Türkçe</option>
            </select>
          </label>
          <label>
            <span className={s.fieldLabel}>{t('clients.linkDays')}</span>
            <select className={s.nativeSelect} value={v.defaultLinkDays} onChange={(e) => set('defaultLinkDays', Number(e.target.value))}>
              {[...new Set([7, 14, 30, 60, 90, 180, 365, v.defaultLinkDays])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{t('clients.linkDaysOpt', { n: d })}</option>)}
            </select>
          </label>
        </div>
        <SwitchRow title={t('clients.allowRaw')} hint={t('clients.allowRawSub')} isSelected={v.allowRaw} onChange={(x) => set('allowRaw', x)} />
        <SwitchRow title={t('clients.reminder')} hint={t('clients.reminderSub')} isSelected={v.expiryReminder} onChange={(x) => set('expiryReminder', x)} />
        {msg ? <p className={s.formMsg} data-kind={msg.kind} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
      </form>
      <div className={s.panelFoot}>
        <Button type="submit" form="client-form" variant="primary" isDisabled={busy || v.nameAr.trim().length < 2}>{client.id ? t('common.saveChanges') : t('common.save')}</Button>
        <Link href={closeHref} className={s.btnLink} scroll={false}>{t('common.cancel')}</Link>
        {client.id ? (
          <button type="button" className={s.danger} onClick={async () => {
            if (!client.archived && !confirm(t('clients.archiveConfirm'))) return;
            await postJson(`/api/admin/clients/${client.id}/archive`, { archived: !client.archived });
            router.replace('/admin/clients', { scroll: false }); router.refresh();
          }}><Archive size={16} aria-hidden />{client.archived ? t('clients.restore') : t('clients.archive')}</button>
        ) : null}
      </div>
    </aside>
  );
}
