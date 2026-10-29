import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { magicLinks, users } from '@/db/schema';
import { lockedUntil, recordFailure } from '@/lib/auth/throttle';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { handle, json, readJson, requireSameOrigin } from '@/lib/server/http';

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/** Always the same answer, whether or not the address belongs to someone (no account enumeration). */
export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { email } = Body.parse(await readJson(req));
  const key = `magic:${email}`;
  if (await lockedUntil(key)) return json({ ok: true });
  await recordFailure(key); // every request counts: at most 5 mails per address per 10 minutes
  const [u] = await getDb().select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  if (u && !u.disabledAt && u.authProvider === 'local') {
    const token = randomToken();
    await getDb().insert(magicLinks).values({ tokenHash: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + 15 * 60_000) });
    const url = `${env.appOrigin}/auth/magic?token=${token}`;
    const ar = u.locale === 'ar';
    await sendMail({
      to: email,
      subject: ar ? 'رابط الدخول إلى مكتبة المرئيات' : 'Medya Kütüphanesi giriş bağlantısı',
      text: ar
        ? `افتح هذا الرابط خلال 15 دقيقة للدخول:\n${url}\n\nإن لم تطلبه فتجاهل هذه الرسالة.`
        : `Giriş yapmak için bu bağlantıyı 15 dakika içinde açın:\n${url}\n\nSiz istemediyseniz bu mesajı yok sayın.`,
    });
  }
  return json({ ok: true });
});
