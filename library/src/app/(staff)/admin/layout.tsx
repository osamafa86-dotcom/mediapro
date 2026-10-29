import { AdminShell } from '@/components/admin/AdminShell';
import { requireStaffPage } from '@/lib/auth/session';

/** Redirects early for the whole /admin tree; each page still calls requireStaffPage() itself. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
