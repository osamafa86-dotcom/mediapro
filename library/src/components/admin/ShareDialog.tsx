'use client';
import { Copy, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { SwitchRow } from './SwitchRow';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import type { ProjectInfo } from './ProjectActions';
import s from './admin.module.css';

/**
 * «رابط المشروع»: one permanent link per project (the owner's rule, 2026-10-30) — no PIN, no expiry. Opening the
 * dialog fetches it (made the first time, the same link after that); the download switch changes it in place.
 * The parent mounts it only while open, so each opening starts fresh.
 */
export function ShareDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (v: boolean) => void; project: ProjectInfo }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [link, setLink] = useState<{ id: string; url: string; allowDownload: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  type Made = { id: string; shortPath: string; allowDownload: boolean };
  const apply = (r: Awaited<ReturnType<typeof postJson<Made>>>) => {
    if (!r.ok) { setMsg({ kind: 'error', text: t('common.error') }); return; }
    setLink({ id: r.data.id, url: `${location.origin}${r.data.shortPath}`, allowDownload: r.data.allowDownload });
    router.refresh(); // the links list behind the dialog
  };
  const call = (body: { allowDownload?: boolean }) => postJson<Made>(`/api/admin/projects/${project.id}/link`, body);

  // mounted only while open (ProjectActions): fetch the project's link once per opening
  useEffect(() => {
    let live = true;
    void call({}).then((r) => { if (live) apply(r); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);

  async function setDownload(v: boolean) {
    setBusy(true);
    apply(await call({ allowDownload: v }));
    setBusy(false);
  }

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} title={t('share.title')} subtitle={`${project.clientName} · ${project.title}`} closeLabel={t('common.close')} testId="share-dialog">
      {project.status !== 'published' ? <p className={`${s.small} ${s.statWarn}`}>{t('share.notPublished')}</p> : null}
      <div className={s.linkBox}>
        <label className={s.itemText} style={{ flex: 1 }}>
          <span className={s.fieldLabel}>{t('share.link')}</span>
          <span className={s.urlField}>
            <code dir="ltr" data-testid="share-url">{link ? link.url.replace(/^https?:\/\//, '') : '…'}</code>
            <Button variant="ghost" isDisabled={!link} onPress={async () => { if (!link) return; await navigator.clipboard.writeText(link.url); setMsg({ kind: 'ok', text: t('common.copied') }); }}>
              {t('common.copy')}
            </Button>
          </span>
        </label>
      </div>
      <p className={`${s.small} ${s.muted}`}>{t('share.permanentNote')}</p>
      <div className={s.optsBox}>
        <SwitchRow title={t('share.allowDownload')} hint={t('share.allowDownloadSub')} isSelected={link?.allowDownload ?? true}
          isDisabled={busy || !link} onChange={(v) => void setDownload(v)} />
      </div>
      {msg ? <p className={s.formMsg} data-kind={msg.kind} role="status">{msg.text}</p> : null}
      <div className={s.actions}>
        <Button variant="primary" icon={<Send size={16} />} isDisabled={!project.hasEmail || busy || !link} onPress={async () => {
          if (!link) return;
          setBusy(true);
          const r = await postJson<{ error?: string }>(`/api/admin/links/${link.id}/send`, {});
          setBusy(false);
          setMsg(r.ok ? { kind: 'ok', text: t('share.sentPermanent') } : { kind: 'error', text: r.data.error === 'client_has_no_email' ? t('share.noEmail') : t('common.error') });
        }}>{t('share.send')}</Button>
        <Button variant="secondary" icon={<Copy size={16} />} isDisabled={!link} onPress={async () => {
          if (!link) return;
          await navigator.clipboard.writeText(link.url);
          setMsg({ kind: 'ok', text: t('common.copied') });
        }}>{t('share.copyLink')}</Button>
      </div>
      {!project.hasEmail ? <p className={`${s.small} ${s.tertiary}`}>{t('share.noEmail')}</p> : null}
    </AdminDialog>
  );
}
