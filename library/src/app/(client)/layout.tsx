import { RootHtml } from '@/lib/html';
import { getLocale } from 'next-intl/server';
import { systemName } from '@/lib/settings';

export async function generateMetadata() {
  const name = await systemName(await getLocale());
  return { title: { default: name, template: `%s · ${name}` }, robots: { index: false } };
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml defaultTheme="dark">{children}</RootHtml>;
}
