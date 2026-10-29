'use client';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import s from './portal.module.css';

/** The other language, named in itself; the server re-renders with the new lang and dir. */
export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const other = locale === 'ar' ? 'tr' : 'ar';
  return (
    <button type="button" className={s.iconBtn} lang={other} aria-label={other === 'tr' ? 'Türkçe' : 'العربية'} onClick={() => {
      document.cookie = `locale=${other}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }}>
      <Globe size={18} aria-hidden />
      <span className={s.langLabel}>{other === 'tr' ? 'Türkçe' : 'العربية'}</span>
    </button>
  );
}
