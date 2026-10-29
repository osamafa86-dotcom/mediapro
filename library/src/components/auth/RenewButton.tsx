'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import s from './auth.module.css';

export function RenewButton({ token }: { token: string }) {
  const t = useTranslations('gate');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  if (state === 'sent') return <p className={s.success} role="status">{t('renewSent')}</p>;
  return (
    <>
      <Button variant="primary" size="lg" className={s.full} isDisabled={state === 'busy'} onPress={async () => {
        setState('busy');
        const r = await postJson('/api/link/renew', { token }, null);
        setState(r.ok ? 'sent' : 'error');
      }}>{t('renew')}</Button>
      {state === 'error' && <p className={s.error} role="alert">{t('error')}</p>}
    </>
  );
}
