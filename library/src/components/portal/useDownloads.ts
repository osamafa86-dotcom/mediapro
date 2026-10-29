'use client';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { postJson } from '@/lib/client/api';

export interface BulkLink { id: string; name: string; size: number; url: string }
export interface BulkRequest { projectId: string; section?: 'photos' | 'videos'; group?: string; ids?: string[]; label: string }

/**
 * Bulk downloads: ask the server for a ticket, then simply navigate to it — the ZIP streams as a normal
 * browser download (works on iOS Safari too). Above the ZIP limit the server answers with per-file links.
 */
export function useDownloads() {
  const t = useTranslations('portal');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [links, setLinks] = useState<{ bytes: number; items: BulkLink[] } | null>(null);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((x) => (x === m ? null : x)), 4000); }, []);

  const bulk = useCallback(async (req: BulkRequest) => {
    if (busy) return;
    setBusy(true);
    setToast(t('preparing'));
    const r = await postJson<{ mode?: 'zip' | 'links'; url?: string; bytes?: number; links?: BulkLink[]; error?: string }>('/api/download/prepare', req, 'vcsrf');
    setBusy(false);
    if (!r.ok) { flash(r.data.error === 'download_disabled' ? t('noDownload') : t('failed')); return; }
    if (r.data.mode === 'zip' && r.data.url) {
      window.location.assign(r.data.url);
      flash(t('started', { name: req.label }));
    } else if (r.data.mode === 'links') {
      setToast(null);
      setLinks({ bytes: r.data.bytes ?? 0, items: r.data.links ?? [] });
    }
  }, [busy, flash, t]);

  return { bulk, busy, toast, links, closeLinks: () => setLinks(null) };
}
