'use client';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import s from './portal.module.css';

/** Dark ↔ light, remembered in a cookie so the server renders the same theme next time (no flash). */
export function ThemeToggle({ initial }: { initial: 'dark' | 'light' }) {
  const t = useTranslations('portal.theme');
  const [theme, setTheme] = useState(initial);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className={s.iconBtn} aria-label={t(next)} title={t(next)} onClick={() => {
      document.documentElement.dataset.theme = next;
      document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
      setTheme(next);
    }}>
      {theme === 'dark' ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
    </button>
  );
}
