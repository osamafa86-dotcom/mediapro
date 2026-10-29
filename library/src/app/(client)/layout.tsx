import { RootHtml } from '@/lib/html';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('app');
  return { title: { default: t('name'), template: `%s · ${t('name')}` }, robots: { index: false } };
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml defaultTheme="dark">{children}</RootHtml>;
}
