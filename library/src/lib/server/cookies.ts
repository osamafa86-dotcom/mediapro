import { env } from '../env';

/** `__Host-` prefix whenever cookies are Secure: no Domain, Path=/, cannot be set by a sibling subdomain. */
export const cookieName = (base: 'session' | 'csrf' | 'viewer' | 'vcsrf') => (env.secureCookies ? `__Host-ml_${base}` : `ml_${base}`);

export function cookieOpts(expires: Date, httpOnly = true) {
  return { httpOnly, secure: env.secureCookies, sameSite: 'lax' as const, path: '/', expires };
}
