import { getSql } from '@/db';

/** Public: the logo is shown on the client gate before any login. */
export async function GET() {
  const [r] = await getSql()<{ value: { mime: string; b64: string }; updated_at: string }[]>`select value, updated_at from settings where key = 'logo'`;
  if (!r) return new Response(null, { status: 404 });
  return new Response(Buffer.from(r.value.b64, 'base64'), {
    headers: { 'Content-Type': r.value.mime, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" },
  });
}
