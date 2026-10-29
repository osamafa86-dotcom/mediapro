'use client';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import s from './auth.module.css';

/** The other language, named in itself («Türkçe» / «العربية»). Server re-renders with the new lang/dir. */
export function LocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const other = locale === 'ar' ? 'tr' : 'ar';
  return (
    <button type="button" className={s.locale} lang={other} onClick={() => {
      document.cookie = `locale=${other}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }}>
      <Globe size={18} aria-hidden />
      <span>{other === 'tr' ? 'Türkçe' : 'العربية'}</span>
    </button>
  );
}
