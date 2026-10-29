import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/auth/BrandMark';
import { LocaleSwitch } from '@/components/auth/LocaleSwitch';
import { LoginForm } from '@/components/auth/LoginForm';
import s from '@/components/auth/auth.module.css';
import { getStaff } from '@/lib/auth/session';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('title') };
}

export default async function LoginPage() {
  if (await getStaff()) redirect('/admin');
  const t = await getTranslations();
  return (
    <main className={s.page}>
      <div className={s.column}>
        <BrandMark />
        <p className={s.kicker}>{t('brand.kicker')}</p>
        <h1 className={`t-title ${s.title}`}>{t('auth.title')}</h1>
        <p className={s.body}>{t('auth.subtitle')}</p>
        <LoginForm />
        <LocaleSwitch />
      </div>
    </main>
  );
}
