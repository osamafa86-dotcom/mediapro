'use client';
import { I18nProvider } from 'react-aria-components';
import { intlLocale, type Locale } from '@/i18n/config';

/** React Aria needs the locale for RTL-aware keyboard handling and its own date/number formatting. */
export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nProvider locale={intlLocale(locale)}>{children}</I18nProvider>;
}
