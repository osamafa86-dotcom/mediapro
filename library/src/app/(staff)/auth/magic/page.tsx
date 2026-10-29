import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/auth/BrandMark';
import { MagicConfirm } from '@/components/auth/MagicConfirm';
import s from '@/components/auth/auth.module.css';

/** Opening the e-mail link only shows a button; the token is spent by a POST (scanners prefetch GETs). */
export default async function MagicPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations('auth');
  return (
    <main className={s.page}>
      <div className={s.column}>
        <BrandMark />
        <h1 className={`t-title ${s.title}`}>{t('magicTitle')}</h1>
        <p className={s.body}>{t('magicBody')}</p>
        {token ? <MagicConfirm token={token} /> : <p className={s.error}>{t('magicInvalid')}</p>}
      </div>
    </main>
  );
}
