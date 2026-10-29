import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

/** Locale comes from the cookie (set by the language switch or a client's default), else Accept-Language, else Arabic. */
export async function resolveLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get('accept-language') ?? '';
  if (/^tr\b/i.test(al)) return 'tr';
  return defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    timeZone: 'Asia/Hebron',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
