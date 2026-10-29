'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import s from './auth.module.css';

export function MagicConfirm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'invalid'>('idle');
  if (state === 'invalid') return (
    <>
      <p className={s.error} role="alert">{t('magicInvalid')}</p>
      <a className={s.link} href="/login">{t('backToLogin')}</a>
    </>
  );
  return (
    <Button variant="primary" size="lg" className={s.full} isDisabled={state === 'busy'} onPress={async () => {
      setState('busy');
      const r = await postJson<{ next?: string }>('/api/auth/magic/verify', { token }, null);
      if (r.ok) { router.replace(r.data.next ?? '/admin'); router.refresh(); } else setState('invalid');
    }}>{t('magicButton')}</Button>
  );
}
