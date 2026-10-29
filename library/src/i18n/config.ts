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
