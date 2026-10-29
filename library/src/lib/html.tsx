import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { dirOf, THEME_COOKIE } from '@/i18n/config';
import { resolveLocale } from '@/i18n/request';
import { Providers } from './providers';
import '@/styles/globals.css';

/**
 * Shared <html> for every root layout. `lang` and `dir` are decided on the server — never flipped by
 * client JS after paint (PROMPT §2). Theme: cookie, else the area default (client = dark, staff = light).
 */
export async function RootHtml({ children, defaultTheme }: { children: React.ReactNode; defaultTheme: 'light' | 'dark' }) {
  const locale = await resolveLocale();
  const c = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = c === 'light' || c === 'dark' ? c : defaultTheme;
  const messages = await getMessages({ locale });
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme={theme} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Hebron">
          <Providers locale={locale}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
