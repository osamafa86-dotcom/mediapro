import 'server-only';
import { getSql } from '@/db';
import { env } from './env';
import { sendMail } from './mail';
import { getSettings } from './settings';

/*
 * E-mail to the admins for the events chosen in Settings → Notifications. A failed mail never fails
 * the action that triggered it.
 */
export async function notifyAdmins(event: 'onReview' | 'onFirstDownload' | 'onRenewalRequest', d: { projectId?: string; by?: string; client?: string }, o: { force?: boolean } = {}) {
  try {
    // force: the link itself asked for this mail («أبلغني عند أول تنزيل»), whatever the global default
    if (!o.force && !(await getSettings()).notifications[event]) return;
    const sql = getSql();
    const admins = await sql<{ email: string; locale: 'ar' | 'tr' }[]>`select email, locale from users where role = 'admin' and disabled_at is null and email is not null`;
    const [p] = d.projectId ? await sql<{ title: string }[]>`select title from projects where id = ${d.projectId}` : [];
    const url = d.projectId ? `${env.appOrigin}/admin/projects/${d.projectId}` : `${env.appOrigin}/admin`;
    for (const a of admins) {
      const ar = a.locale === 'ar';
      const subject = event === 'onReview'
        ? (ar ? `بانتظار المراجعة: ${p?.title ?? ''}` : `İncelemede: ${p?.title ?? ''}`)
        : event === 'onFirstDownload' ? (ar ? `أول تنزيل: ${p?.title ?? d.client ?? ''}` : `İlk indirme: ${p?.title ?? d.client ?? ''}`)
        : (ar ? `طلب تجديد رابط: ${d.client ?? ''}` : `Bağlantı yenileme isteği: ${d.client ?? ''}`);
      const text = event === 'onReview'
        ? (ar ? `${d.by} أرسل «${p?.title}» للمراجعة.\n${url}` : `${d.by}, «${p?.title}» projesini incelemeye gönderdi.\n${url}`)
        : `${subject}\n${url}`;
      await sendMail({ to: a.email, subject, text });
    }
  } catch (e) {
    console.warn('[notify]', e instanceof Error ? e.message : e);
  }
}
