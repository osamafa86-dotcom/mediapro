import { getTranslations } from 'next-intl/server';

export default async function AdminHome() {
  const t = await getTranslations('app');
  return <main style={{ padding: 32 }}><h1 className="t-title">{t('name')}</h1></main>;
}
