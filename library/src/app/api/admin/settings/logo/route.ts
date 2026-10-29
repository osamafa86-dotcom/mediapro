import { getSql } from '@/db';
import { requireStaff } from '@/lib/auth/session';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json } from '@/lib/server/http';

const MAX = 512 * 1024;

/** PNG/WebP/JPEG only, sniffed from the bytes (no SVG: it can carry script). Stored in settings, served same-origin. */
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const form = await req.formData().catch(() => null);
  const file = form?.get('logo');
  if (!(file instanceof File)) throw new HttpError(400, 'file_required');
  if (file.size > MAX) throw new HttpError(413, 'too_large');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) throw new HttpError(415, 'unsupported_type');
  const sql = getSql();
  await sql`insert into settings (key, value, updated_at) values ('logo', ${JSON.stringify({ mime, b64: Buffer.from(bytes).toString('base64') })}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  await audit('user', staff.id, 'settings.logo_updated');
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  await getSql()`delete from settings where key = 'logo'`;
  await audit('user', staff.id, 'settings.logo_removed');
  return json({ ok: true });
});
