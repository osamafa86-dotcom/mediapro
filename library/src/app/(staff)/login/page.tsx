import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { systemName } from '@/lib/settings';
import { BrandMark } from '@/components/auth/BrandMark';
import { LocaleSwitch } from '@/components/auth/LocaleSwitch';
import { LoginForm } from '@/components/auth/LoginForm';
import s from '@/components/auth/auth.module.css';
import { getStaff } from '@/lib/auth/session';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('title') };
}

const SSO_WHY = ['sso_expired', 'sso_replayed', 'sso_bad_signature', 'sso_malformed', 'sso_too_far', 'sso_role', 'disabled', 'email_taken', 'sso_failed'];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  if (await getStaff()) redirect('/admin');
  const t = await getTranslations();
  const sso = (await searchParams).sso;
  const why = sso && SSO_WHY.includes(sso) ? sso : null;
  return (
    <main className={s.page}>
      <div className={s.column}>
        <BrandMark />
        <p className={s.kicker}>{await systemName(await getLocale())}</p>
        <h1 className={`t-title ${s.title}`}>{t('auth.title')}</h1>
        <p className={s.body}>{t('auth.subtitle')}</p>
        {why ? <p className={s.ssoError} role="alert" data-testid="sso-error">{t('auth.ssoRefused', { why: t(`auth.ssoWhy.${why}`) })}</p> : null}
        <LoginForm />
        <LocaleSwitch />
      </div>
    </main>
  );
}
