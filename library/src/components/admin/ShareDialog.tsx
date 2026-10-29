'use client';
import { Copy, Link2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { SwitchRow } from './SwitchRow';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import type { ProjectInfo } from './ProjectActions';
import s from './admin.module.css';

type Scope = 'project' | 'library' | 'guest';
const DAY_OPTIONS = [7, 14, 30, 60, 90, 180, 365];

/**
 * «رابط التسليم» (Figma 31:273). Choose what the link opens, its lifetime and download rights; on
 * create the server returns the short link and the PIN — the PIN is shown here once and never again.
 */
export function ShareDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (v: boolean) => void; project: ProjectInfo }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('project');
  const [days, setDays] = useState(project.defaultDays);
  const [allowDownload, setAllowDownload] = useState(true);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ id: string; url: string; pin: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const reset = () => { setMade(null); setMsg(null); setScope('project'); setDays(project.defaultDays); setAllowDownload(true); setNotify(false); };
  const until = endOfDay(days, project.timeZone, locale);

  async function create() {
    setBusy(true); setMsg(null);
    const r = await postJson<{ id: string; shortPath: string; pin: string }>('/api/admin/links', {
      clientId: project.clientId, projectId: scope === 'library' ? null : project.id, kind: scope === 'guest' ? 'guest' : 'client',
      days, allowDownload: scope === 'guest' ? false : allowDownload, notifyFirstDownload: notify,
    });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'error', text: t('common.error') }); return; }
    setMade({ id: r.data.id, url: `${location.origin}${r.data.shortPath}`, pin: r.data.pin });
    router.refresh(); // the links list behind the dialog updates now, not on close
  }

  const scopes: { key: Scope; title: string; sub: string }[] = [
    { key: 'project', title: t('share.scopeProject'), sub: t('share.scopeProjectSub') },
    { key: 'library', title: t('share.scopeLibrary'), sub: t('share.scopeLibrarySub', { client: project.clientName }) },
    { key: 'guest', title: t('share.scopeGuest'), sub: t('share.scopeGuestSub') },
  ];

  return (
    <AdminDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }} title={t('share.title')} subtitle={`${project.clientName} · ${project.title}`} closeLabel={t('common.close')} testId="share-dialog">
      {!made ? (
        <>
          <fieldset className={s.fieldset} disabled={busy}>
            <legend className={s.fieldLabel}>{t('share.opens')}</legend>
            {scopes.map((o) => (
              <label key={o.key} className={s.radioCard} data-selected={scope === o.key || undefined}>
                <input type="radio" name="scope" value={o.key} checked={scope === o.key} onChange={() => setScope(o.key)} />
                <span><strong>{o.title}</strong><span>{o.sub}</span></span>
              </label>
            ))}
          </fieldset>
          {project.status !== 'published' ? <p className={`${s.small} ${s.statWarn}`}>{t('share.notPublished')}</p> : null}
          <div className={s.optsBox}>
            <div className={s.switchRow}>
              <span className={s.switchText}>
                <strong>{t('share.expires')}</strong>
                <span>{t('share.expiresSub', { date: until, tz: t(`share.tz.${project.timeZone}` as 'share.tz.Asia/Hebron') })}</span>
              </span>
              <select className={s.chipSelect} aria-label={t('share.expires')} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[...new Set([...DAY_OPTIONS, project.defaultDays])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{t('share.days', { n: d })}</option>)}
              </select>
            </div>
            {scope !== 'guest' ? (
              <SwitchRow title={t('share.allowDownload')} hint={t('share.allowDownloadSub')} isSelected={allowDownload} onChange={setAllowDownload} />
            ) : null}
            <SwitchRow title={t('share.notify')} hint={t('share.notifySub')} isSelected={notify} onChange={setNotify} />
          </div>
          {msg ? <p className={s.formMsg} data-kind={msg.kind} role="alert">{msg.text}</p> : null}
          <div className={s.actions}>
            <Button variant="primary" icon={<Link2 size={16} />} isDisabled={busy} onPress={() => void create()}>{t('share.create')}</Button>
          </div>
        </>
      ) : (
        <>
          <div className={s.linkBox}>
            <label className={s.itemText} style={{ flex: 1 }}>
              <span className={s.fieldLabel}>{t('share.link')}</span>
              <span className={s.urlField}>
                <code dir="ltr" data-testid="share-url">{made.url.replace(/^https?:\/\//, '')}</code>
                <Button variant="ghost" onPress={() => void navigator.clipboard.writeText(made.url)}>{t('common.copy')}</Button>
              </span>
            </label>
            <div>
              <span className={s.fieldLabel}>{t('share.pin')}</span>
              <span className={s.pinShow} dir="ltr" data-testid="share-pin" aria-label={`${t('share.pin')}: ${made.pin.split('').join(' ')}`}>
                {made.pin.split('').map((d, i) => <span key={i} aria-hidden>{d}</span>)}
              </span>
            </div>
          </div>
          <p className={`${s.small} ${s.muted}`}>{t('share.pinNote')}</p>
          {msg ? <p className={s.formMsg} data-kind={msg.kind} role="status">{msg.text}</p> : null}
          <div className={s.actions}>
            <Button variant="primary" icon={<Send size={16} />} isDisabled={!project.hasEmail || busy} onPress={async () => {
              setBusy(true);
              const r = await postJson<{ error?: string }>(`/api/admin/links/${made.id}/send`, {});
              setBusy(false);
              setMsg(r.ok ? { kind: 'ok', text: t('share.sent', { email: '…' }) } : { kind: 'error', text: r.data.error === 'client_has_no_email' ? t('share.noEmail') : t('common.error') });
            }}>{t('share.send')}</Button>
            <Button variant="secondary" icon={<Copy size={16} />} onPress={async () => {
              await navigator.clipboard.writeText(t('share.copyText', { url: made.url, pin: made.pin }));
              setMsg({ kind: 'ok', text: t('common.copied') });
            }}>{t('share.copyBoth')}</Button>
          </div>
          {!project.hasEmail ? <p className={`${s.small} ${s.tertiary}`}>{t('share.noEmail')}</p> : null}
        </>
      )}
    </AdminDialog>
  );
}

/** Mirrors the server: the last day ends at 23:59 studio time. Display only — the server decides. */
function endOfDay(days: number, timeZone: string, locale: string) {
  const d = new Date(Date.now() + days * 86_400_000);
  const loc = locale === 'tr' ? 'tr-TR' : 'ar-PS-u-nu-latn';
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(d);
}
