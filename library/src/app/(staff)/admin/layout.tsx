import { requireStaffPage } from '@/lib/auth/session';

/** Redirects early for the whole /admin tree; each page still calls requireStaffPage() itself. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage();
  return children;
}
