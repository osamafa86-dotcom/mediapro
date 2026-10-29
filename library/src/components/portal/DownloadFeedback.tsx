'use client';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatBytes, ltr } from '@/lib/format';
import type { useDownloads } from './useDownloads';
import s from './portal.module.css';

/** The status line while a ZIP is prepared, and the per-file list when the set is above the ZIP limit. */
export function DownloadFeedback({ dl }: { dl: ReturnType<typeof useDownloads> }) {
  const t = useTranslations('portal');
  const locale = useLocale() as Locale;
  return (
    <>
      {dl.toast ? <div className={s.toast} role="status">{dl.toast}</div> : null}
      {dl.links ? (
        <div className={`${s.bar} ${s.linksPanel}`} role="dialog" aria-label={t('linksTitle')}>
          <div className={s.linksBox} data-testid="links-fallback">
            <div className={s.linksHead}>
              <strong>{t('linksTitle')}</strong>
              <button type="button" className={s.iconBtn} aria-label={t('viewer.close')} onClick={dl.closeLinks}><X size={18} aria-hidden /></button>
            </div>
            <p className={`${s.muted} ${s.small}`}>{t('tooBig', { size: ltr(formatBytes(dl.links.bytes, locale)) })}</p>
            <ol>{dl.links.items.map((l) => <li key={l.id}><a href={l.url} download={l.name} dir="auto">{l.name}</a> <span className={s.mono}>{formatBytes(l.size, locale)}</span></li>)}</ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
