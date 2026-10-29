'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { SearchField } from '@/components/ui';
import s from './admin.module.css';

type Sel = { key: string; label: string; value: string; options: { value: string; label: string }[]; emptyLabel?: string };

/** Search + chip filters for the smaller lists (clients, team). The URL is the state. */
export function ListFilters({ q, placeholder, selects }: { q: string; placeholder: string; selects: Sel[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [v, setV] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const go = (patch: Record<string, string>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, val] of Object.entries(patch)) { if (val) u.set(k, val); else u.delete(k); }
    router.replace(`${path}${u.size ? `?${u}` : ''}`, { scroll: false });
  };
  return (
    <div className={s.listFilters}>
      <SearchField label={placeholder} aria-label={placeholder} placeholder={placeholder} clearLabel={t('archive.clearSearch')} shortcut="" value={v}
        onChange={(x) => { setV(x); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => go({ q: x.trim() }), 300); }} />
      {selects.map((sel) => (
        <select key={sel.key} className={s.chipSelect} aria-label={sel.label} data-active={sel.value ? 'true' : 'false'} value={sel.value}
          onChange={(e) => go({ [sel.key]: e.target.value })}>
          <option value="">{sel.emptyLabel ?? sel.label}</option>
          {sel.options.map((o) => <option key={o.value} value={o.value}>{`${sel.label}: ${o.label}`}</option>)}
        </select>
      ))}
    </div>
  );
}
