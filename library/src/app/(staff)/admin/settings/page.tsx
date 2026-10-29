import { getLocale, getTranslations } from 'next-intl/server';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { getSql } from '@/db';
import type { Locale } from '@/i18n/config';
import { requireStaffPage } from '@/lib/auth/session';
import { formatBytes, ltr } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { storageStatus } from '@/lib/storage';

export async function generateMetadata() { return { title: (await getTranslations('admin'))('nav.settings') }; }

export default async function SettingsPage() {
  await requireStaffPage(['admin']);
  const settings = await getSettings();
  const locale = (await getLocale()) as Locale;
  const sql = getSql();
  const [st, [u], [logo]] = await Promise.all([
    storageStatus(),
    sql<{ originals: string }[]>`select coalesce(sum(size), 0)::text as originals from assets`,
    sql<{ updated_at: string }[]>`select updated_at from settings where key = 'logo'`,
  ]);
  const originals = Number(u!.originals);
  const fb = (n: number) => ltr(formatBytes(n, locale, settings.region.digits));
  return (
    <SettingsForm
      initial={settings}
      logoVersion={logo ? new Date(logo.updated_at).getTime() : null}
      storage={{
        state: st.state, bucket: 'bucket' in st ? st.bucket : (process.env.S3_BUCKET ?? ''), region: process.env.S3_REGION ?? 'auto',
        originals: fb(originals), renditions: fb(0), free: fb(Math.max(0, settings.storage.quotaBytes - originals)), quota: fb(settings.storage.quotaBytes),
        pctOriginals: settings.storage.quotaBytes ? Math.min(100, (originals / settings.storage.quotaBytes) * 100) : 0, pctRenditions: 0,
      }}
      ssoEnabled={process.env.EMDATRA_SSO_ENABLED === 'true'}
    />
  );
}
