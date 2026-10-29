import { notFound, redirect } from 'next/navigation';
import { tokenForCode } from '@/lib/auth/viewer';

export const metadata = { referrer: 'no-referrer' as const };

/** Short link from the e-mail (/c/abcde-fghij) → the signed gate URL. */
export default async function ShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const token = await tokenForCode(code);
  if (!token) notFound();
  redirect(`/l/${token}`);
}
