'use client';
import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, SearchField, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

type Opt = { value: string; label: string };
export interface FilterValues { q: string; period: string; client: string; photographer: string; type: string; media: string; status: string; tag: string; archived: string }

/**
 * The always-visible filter bar (Figma 28:2). Every filter is a chip that shows its value; the URL
 * is the state, so a view can be bookmarked, shared, or saved by name.
 */
export function ArchiveFilters({ values, facets, showPeople }: {
  values: FilterValues; facets: { clients: Opt[]; people: Opt[]; types: Opt[]; tags: Opt[] }; showPeople: boolean;
}) {
  const t = useTranslations('admin');
  const ts = useTranslations('status');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(values.q);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (patch: Partial<FilterValues>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    u.delete('page');
    router.replace(`${path}${u.size ? `?${u}` : ''}`, { scroll: false });
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: v.trim() }), 300);
  };

  const chips: { key: keyof FilterValues; label: string; opts: Opt[] }[] = [
    { key: 'period', label: t('archive.f.period'), opts: (['3m', '6m', '12m'] as const).map((p) => ({ value: p, label: t(`archive.periods.${p}`) })) },
    { key: 'client', label: t('archive.f.client'), opts: facets.clients },
    ...(showPeople ? [{ key: 'photographer' as const, label: t('archive.f.photographer'), opts: facets.people }] : []),
    { key: 'type', label: t('archive.f.type'), opts: facets.types },
    { key: 'media', label: t('archive.f.media'), opts: (['photos', 'videos'] as const).map((m) => ({ value: m, label: t(`archive.mediaKinds.${m}`) })) },
    { key: 'status', label: t('archive.f.status'), opts: (['draft', 'uploading', 'review', 'published', 'expired'] as const).map((x) => ({ value: x, label: ts(x) })) },
    { key: 'tag', label: t('archive.f.tag'), opts: facets.tags },
    { key: 'archived', label: t('archive.f.archived'), opts: [{ value: '1', label: t('archive.f.archived') }] },
  ];
  const anyActive = Object.values(values).some(Boolean);

  return (
    <section className={`${s.card} ${s.filters}`} aria-label={t('archive.f.status')} data-testid="archive-filters">
      <div className={s.searchRow}>
        <SearchField label={t('archive.searchPlaceholder')} placeholder={t('archive.searchPlaceholder')} clearLabel={t('archive.clearSearch')} value={q} onChange={onSearch}
          onSubmit={() => go({ q: q.trim() })} aria-label={t('archive.searchPlaceholder')} />
        <Button variant="ghost" onPress={() => { setViewName(''); setSaveOpen(true); }} isDisabled={!anyActive}>{t('archive.saveView')}</Button>
      </div>
      <div className={s.chips}>
        {chips.filter((c) => c.opts.length > 0 || values[c.key]).map((c) => {
          const v = values[c.key];
          const current = c.opts.find((o) => o.value === v);
          return (
            <select key={c.key} className={s.chipSelect} data-active={v ? 'true' : 'false'} aria-label={c.label} value={v}
              onChange={(e) => go({ [c.key]: e.target.value })} data-filter={c.key}>
              <option value="">{c.label}</option>
              {c.opts.map((o) => <option key={o.value} value={o.value}>{c.key === 'archived' ? o.label : `${c.label}: ${o.label}`}</option>)}
              {v && !current ? <option value={v}>{`${c.label}: ${v}`}</option> : null}
            </select>
          );
        })}
        {anyActive ? (
          <button type="button" className={s.clearAll} onClick={() => { setQ(''); router.replace(path, { scroll: false }); }}>
            <X size={16} aria-hidden />{t('archive.clearAll')}
          </button>
        ) : null}
      </div>
      <AdminDialog open={saveOpen} onOpenChange={setSaveOpen} title={t('archive.saveView')} closeLabel={t('common.close')}>
        <form className={s.form} onSubmit={async (e) => {
          e.preventDefault();
          const u = new URLSearchParams(sp.toString()); u.delete('page');
          const r = await postJson('/api/admin/views', { name: viewName, query: u.toString() });
          if (r.ok) { setSaveOpen(false); router.refresh(); }
        }}>
          <TextField label={t('archive.saveViewPrompt')} value={viewName} onChange={setViewName} isRequired autoFocus maxLength={40} />
          <div className={s.actions}><Button type="submit" variant="primary" isDisabled={!viewName.trim()}>{t('common.save')}</Button></div>
        </form>
      </AdminDialog>
    </section>
  );
}
