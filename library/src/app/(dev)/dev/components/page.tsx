import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { dirOf, locales } from '@/i18n/config';
import { Gallery } from './gallery';
import s from './page.module.css';

// Available in development, and in a production build only when ENABLE_DEV_PAGES=1 (e2e tests).
export const dynamic = 'force-dynamic';

export default async function ComponentsPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_PAGES !== '1') notFound();
  const panels = locales.flatMap((locale) => (['light', 'dark'] as const).map((theme) => ({ locale, theme })));
  return (
    <main className={s.grid}>
      {await Promise.all(panels.map(async ({ locale, theme }) => {
        const messages = (await import(`../../../../../messages/${locale}.json`)).default;
        return (
          <section key={`${locale}-${theme}`} lang={locale} dir={dirOf(locale)} data-theme={theme} className={s.panel} data-testid={`panel-${locale}-${theme}`}>
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Hebron">
              <Gallery locale={locale} theme={theme} />
            </NextIntlClientProvider>
          </section>
        );
      }))}
    </main>
  );
}
