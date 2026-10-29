import { NextResponse } from 'next/server';

/*
 * Content-Security-Policy built per request from the *runtime* environment. next.config headers are
 * frozen at build time, so an image built in CI would not know the R2 endpoint the browser uploads to.
 * No third-party origins otherwise (fonts are self-hosted); never framable — the parent site opens
 * the library with window.open(), not an iframe.
 */
function origin(v: string | undefined) {
  try { return v ? new URL(v).origin : ''; } catch { return ''; }
}

export function buildCsp() {
  const storage = [origin(process.env.S3_ENDPOINT), origin(process.env.S3_PUBLIC_ORIGIN)].filter(Boolean).join(' ');
  const media = [origin(process.env.MEDIA_PUBLIC_ORIGIN), storage].filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${media}`.trim(),
    `media-src 'self' blob: ${media}`.trim(),
    `connect-src 'self' ${storage}`.trim(),
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function proxy() {
  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', buildCsp());
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|fonts/).*)'] };
