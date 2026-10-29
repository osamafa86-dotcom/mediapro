import { CloudDownload } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/admin/AdminShell';
import s from '@/components/admin/admin.module.css';
import { requireStaffPage } from '@/lib/auth/session';

/** Placeholder until M6 (Google OAuth + Drive → R2 streaming import). */
export default async function ImportPage() {
  await requireStaffPage(['admin']);
  const t = await getTranslations('admin');
  return (
    <>
      <PageHead title={t('import.title')} subtitle={t('import.subtitle')} />
      <section className={`${s.card} ${s.emptyState}`}>
        <span className={s.emptyIcon} aria-hidden><CloudDownload size={30} /></span>
        <h2>{t('import.soon')}</h2>
        <p>{t('import.soonBody')}</p>
      </section>
    </>
  );
}
