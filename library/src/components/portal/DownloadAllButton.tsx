'use client';
import { DownloadFeedback } from './DownloadFeedback';
import { useDownloads } from './useDownloads';
import s from './portal.module.css';

/** «تنزيل المشروع كاملًا» — one ZIP of everything this viewer may download in the project. */
export function DownloadAllButton({ projectId, label, children }: { projectId: string; label: string; children: React.ReactNode }) {
  const dl = useDownloads();
  return (
    <>
      <button type="button" className={`${s.primary} ${s.primarySq}`} aria-disabled={dl.busy} data-testid="download-all" onClick={() => dl.bulk({ projectId, label })}>
        {children}
      </button>
      <DownloadFeedback dl={dl} />
    </>
  );
}
