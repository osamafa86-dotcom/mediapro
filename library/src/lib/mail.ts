import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';

/*
 * Transport, by environment:
 *   SMTP_URL   → real mail (production)
 *   MAIL_DIR   → each message written as JSON to that folder (tests only)
 *   otherwise  → development prints the message; production drops it and says so (no link in logs).
 */
export interface Mail { to: string; subject: string; text: string }

export async function sendMail(m: Mail): Promise<void> {
  if (process.env.SMTP_URL) {
    const t = nodemailer.createTransport(process.env.SMTP_URL);
    await t.sendMail({ from: process.env.MAIL_FROM ?? 'EMDATRA <no-reply@emdatra.org>', ...m });
    return;
  }
  if (process.env.MAIL_DIR) {
    await mkdir(process.env.MAIL_DIR, { recursive: true });
    await writeFile(join(process.env.MAIL_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify(m));
    return;
  }
  if (process.env.NODE_ENV !== 'production') { console.info('[mail:dev]', m.to, m.subject, '\n', m.text); return; }
  console.warn('[mail] SMTP_URL is not set — message to a staff address was not sent');
}
