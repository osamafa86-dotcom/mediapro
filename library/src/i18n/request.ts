import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

/**
 * Locale: the cookie (this person's language switch), else the library's language from the settings, else
 * Accept-Language (only when the settings cannot be read), else Arabic. The setting comes before the browser's
 * language: the studio chooses its site's language — a browser in Arabic used to hide a switch to Turkish.
 */
export async function resolveLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const lib = (await libraryRegion())?.locale;
  if (lib) return lib;
  const al = (await headers()).get('accept-language') ?? '';
  if (/^tr\b/i.test(al)) return 'tr';
  if (/^ar\b/i.test(al)) return 'ar';
  return defaultLocale;
}

async function libraryRegion() {
  try {
    const { getSettings } = await import('@/lib/settings');
    return (await getSettings()).region;
  } catch {
    return null; // no database (e.g. a static page at build time): fall back to the defaults
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    timeZone: (await libraryRegion())?.timeZone ?? 'Asia/Hebron',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
