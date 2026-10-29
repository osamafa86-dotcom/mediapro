export const locales = ['ar', 'tr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';
export const LOCALE_COOKIE = 'locale';
export const THEME_COOKIE = 'theme';

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (locales as readonly string[]).includes(v);
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Intl locale with an explicit numbering system — 0–9 by default, Arabic-Indic only on request (DESIGN.md rule 3). */
export function intlLocale(locale: Locale, easternDigits = false): string {
  if (locale === 'ar') return easternDigits ? 'ar-u-nu-arab' : 'ar-u-nu-latn';
  return 'tr-TR';
}

/** Dates as the studio reads them: Levantine month names in Arabic («تشرين الأول»), Latin digits. */
export function dateLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-PS-u-nu-latn' : 'tr-TR';
}

export function formatDate(d: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'long', timeZone: 'Asia/Hebron' }).format(new Date(d));
}
