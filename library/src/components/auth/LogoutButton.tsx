'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';

export function LogoutButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  return <Button variant="ghost" onPress={async () => { await postJson('/api/auth/logout', {}); router.replace('/login'); router.refresh(); }}>{t('logout')}</Button>;
}
