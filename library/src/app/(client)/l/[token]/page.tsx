import { Clock } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/auth/BrandMark';
import { LocaleSwitch } from '@/components/auth/LocaleSwitch';
import { PinGate } from '@/components/auth/PinGate';
import { RenewButton } from '@/components/auth/RenewButton';
import s from '@/components/auth/auth.module.css';
import { getSql } from '@/db';
import { formatDate, type Locale } from '@/i18n/config';
import { gateState, getViewer } from '@/lib/auth/viewer';
import { getSettings } from '@/lib/settings';

export const metadata = { referrer: 'no-referrer' as const };

/** Client/guest entry: PIN gate, locked, expired or invalid — all decided on the server from the link row. */
export default async function LinkGate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const g = await gateState(token);

  if (g.state === 'invalid') {
    return (
      <Shell>
        <h1 className={`t-title ${s.title}`}>{t('gate.invalidTitle')}</h1>
        <p className={s.body}>{t('gate.invalidBody')}</p>
      </Shell>
    );
  }

  const [info] = await getSql()<{ name_ar: string; name_tr: string | null; creator: string | null }[]>`
    select c.name_ar, c.name_tr, u.name as creator from clients c left join users u on u.id = ${g.link.created_by ?? null}
    where c.id = ${g.link.client_id}`;
  const client = locale === 'tr' ? info?.name_tr || info?.name_ar : info?.name_ar;
  const heading = <h1 className={`t-title ${s.title}`}>{t('gate.library', { client: client ?? '' })}</h1>;

  if (g.state === 'expired') {
    return (
      <Shell testState="expired">
        {heading}
        <p className={s.body}>{t('gate.expiredBody')}</p>
        <div className={s.card}>
          <Clock size={16} aria-hidden />
          <span>{t('gate.expiredOn', { date: formatDate(g.link.expires_at, locale) })}</span>
          {info?.creator ? <p>{t('gate.sentBy', { name: info.creator })}</p> : null}
        </div>
        {g.link.kind === 'client' ? <RenewButton token={token} /> : null}
        <p className={s.note}>{t('gate.renewNote')}</p>
      </Shell>
    );
  }

  const viewer = await getViewer();
  if (g.state === 'open' && viewer?.linkId === g.link.id) {
    redirect(g.link.kind === 'guest' || g.link.project_id ? `/p/${g.link.project_id}` : '/library');
  }

  return (
    <Shell testState={g.state}>
      {heading}
      <p className={s.body}>{t('gate.pinHelp')}</p>
      <PinGate token={token} lockedUntil={g.state === 'locked' ? g.until.toISOString() : null} />
    </Shell>
  );
}

async function Shell({ children, testState }: { children: React.ReactNode; testState?: string }) {
  const locale = await getLocale();
  const { identity } = await getSettings();
  return (
    <main className={s.page} data-gate={testState}>
      <div className={s.column}>
        <BrandMark />
        <p className={s.kicker}>{locale === 'tr' ? identity.nameTr : identity.nameAr}</p>
        {children}
        <LocaleSwitch />
      </div>
    </main>
  );
}
