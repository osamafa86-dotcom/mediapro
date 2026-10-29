import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CSP: no third-party origins at all (fonts are self-hosted), never framable — the parent site
// opens the library with window.open(), not an iframe (docs/phase-2-integration.md).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + (process.env.MEDIA_PUBLIC_ORIGIN ?? ''),
  "media-src 'self' blob: " + (process.env.MEDIA_PUBLIC_ORIGIN ?? ''),
  "connect-src 'self' " + (process.env.S3_PUBLIC_ORIGIN ?? ''),
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'graphile-worker'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
