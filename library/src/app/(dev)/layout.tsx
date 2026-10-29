import { RootHtml } from '@/lib/html';

export const metadata = { title: 'Components — EMDATRA Media', robots: { index: false } };

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml defaultTheme="light">{children}</RootHtml>;
}
