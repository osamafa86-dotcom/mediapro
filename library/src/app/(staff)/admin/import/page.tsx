import { CloudDownload } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import { DriveImport } from '@/components/admin/DriveImport';
import s from '@/components/admin/admin.module.css';
import { getSql } from '@/db';
import { requireStaffPage } from '@/lib/auth/session';
import { connection, recentImports, redirectUri } from '@/lib/drive';

/** Drive import (M6): connect once, pick folders, confirm the suggested client/project/date, watch the report. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const staff = await requireStaffPage(['admin']);
  const t = await getTranslations('admin.import');
  const sp = await searchParams;
  const [conn, imports, clients, projects] = await Promise.all([
    connection(staff.id),
    recentImports(),
    getSql()<{ id: string; name_ar: string; name_tr: string | null }[]>`select id, name_ar, name_tr from clients where archived_at is null order by name_ar`,
    getSql()<{ id: string; client_id: string; title: string }[]>`select id, client_id, title from projects where archived_at is null order by created_at desc limit 2000`,
  ]);
  return (
    <>
      <PageHead title={t('title')} subtitle={t('subtitle')} />
      {!conn.configured ? (
        <section className={`${s.card} ${s.emptyState}`} data-testid="drive-setup">
          <span className={s.emptyIcon} aria-hidden><CloudDownload size={30} /></span>
          <h2>{t('setupTitle')}</h2>
          <p>{t('setupBody')}</p>
          <p className={s.small}><span className={s.muted}>{t('redirect')}: </span><code dir="ltr">{redirectUri()}</code></p>
        </section>
      ) : (
        <DriveImport
          notice={['connected', 'denied', 'failed', 'bad_state'].includes(sp.drive ?? '') ? sp.drive! : null}
          connection={conn} imports={imports} clients={clients} projects={projects}
        />
      )}
    </>
  );
}
