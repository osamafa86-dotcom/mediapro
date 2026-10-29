'use client';
import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import s from './portal.module.css';

/** The header search (⌘K / Ctrl+K). It only writes `?q=`; the page below filters by it, so a search can be shared. */
export function PortalSearch({ scope }: { scope: 'library' | 'project' }) {
  const t = useTranslations('portal.search');
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // marks the box as React's: before that, Escape in a type=search box is the browser's own clear, which leaves
    // `?q=` and the results as they were — tests wait for this before pressing keys
    input.current?.setAttribute('data-hydrated', 'true');
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const push = (v: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const u = new URLSearchParams(window.location.search);
      if (v.trim()) u.set('q', v.trim()); else u.delete('q');
      router.replace(`${path}${u.size ? `?${u}` : ''}`, { scroll: false });
    }, 200);
  };

  return (
    <div className={s.search} role="search">
      <Search size={16} aria-hidden className={s.searchIcon} />
      <input ref={input} type="search" className={s.searchInput} value={q} placeholder={t(scope)} aria-label={t(scope)} data-testid="portal-search"
        onChange={(e) => { setQ(e.target.value); push(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); push(''); } }} />
      {q ? (
        <button type="button" className={s.searchClear} aria-label={t('clear')} onClick={() => { setQ(''); push(''); input.current?.focus(); }}><X size={14} aria-hidden /></button>
      ) : <kbd className={s.kbd} aria-hidden>⌘K</kbd>}
    </div>
  );
}
