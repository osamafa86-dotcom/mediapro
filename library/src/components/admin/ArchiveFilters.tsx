'use client';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog, DialogTrigger, Button as RACButton, Popover } from 'react-aria-components';
import { useEffect, useRef, useState } from 'react';
import { Button, SearchField, TextField } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { AdminDialog } from './Dialog';
import s from './admin.module.css';

type Opt = { value: string; label: string };
export interface FilterValues { q: string; period: string; day: string; month: string; from: string; to: string; client: string; photographer: string; type: string; media: string; status: string; tag: string; archived: string }

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
        <DateFilter values={values} go={go} />
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
          <button type="button" className={s.clearAll} onClick={() => {
            // filters go, the way the list is drawn (albums or table) stays
            setQ(''); const v = sp.get('view'); router.replace(v ? `${path}?view=${encodeURIComponent(v)}` : path, { scroll: false });
          }}>
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

const QUICK = ['today', 'yesterday', '7d', 'thisMonth', 'lastMonth', '3m', '6m', '12m'] as const;
const DATE_KEYS = { period: '', day: '', month: '', from: '', to: '' };

/**
 * «التاريخ»: one chip that says what it filters on, and a panel — quick periods, one day, one month, a range.
 * Choosing one clears the others (the URL holds one date rule at a time).
 */
function DateFilter({ values, go }: { values: FilterValues; go: (patch: Partial<FilterValues>) => void }) {
  const t = useTranslations('admin.archive');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(values.from);
  const [to, setTo] = useState(values.to);
  const thisYear = new Date().getFullYear();
  const [my, setMy] = useState(() => (values.month ? values.month.slice(0, 4) : String(thisYear)));
  const [mm, setMm] = useState(() => (values.month ? values.month.slice(5, 7) : ''));
  const loc = `${locale}-u-nu-latn`;
  const dayLabel = (d: string) => new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  const monthName = (m: number) => new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m - 1, 1)));
  const current = values.day ? dayLabel(values.day)
    : values.month ? `${monthName(Number(values.month.slice(5)))} ${values.month.slice(0, 4)}`
    : values.from || values.to ? `${values.from ? dayLabel(values.from) : '…'} – ${values.to ? dayLabel(values.to) : '…'}`
    : values.period ? t(`periods.${values.period}` as 'periods.today') : '';
  const pick = (patch: Partial<FilterValues>) => { go({ ...DATE_KEYS, ...patch }); setOpen(false); };

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <RACButton className={s.dateChip} data-active={current ? 'true' : 'false'} data-filter="date">
        <CalendarDays size={16} aria-hidden />
        <span>{current ? `${t('f.period')}: ` : t('f.period')}{current ? <bdi>{current}</bdi> : null}</span>
        <ChevronDown size={14} aria-hidden />
      </RACButton>
      <Popover className={s.datePop} placement="bottom start">
        <Dialog className={s.datePanel} aria-label={t('f.period')} data-testid="date-panel">
          <div className={s.dateQuick} role="group" aria-label={t('dateQuick')}>
            {QUICK.map((p) => (
              <button key={p} type="button" aria-pressed={values.period === p && !values.day && !values.month && !values.from && !values.to}
                onClick={() => pick({ period: p })}>{t(`periods.${p}`)}</button>
            ))}
          </div>
          <label className={s.dateRow}>
            <span>{t('dateDay')}</span>
            <input type="date" value={values.day} max="2100-12-31" onChange={(e) => { if (e.target.value) pick({ day: e.target.value }); }} data-testid="date-day" />
          </label>
          <div className={s.dateRow}>
            <span id="date-month">{t('dateMonth')}</span>
            <span className={s.dateInline}>
              <select aria-labelledby="date-month" value={mm} onChange={(e) => { setMm(e.target.value); if (e.target.value) pick({ month: `${my}-${e.target.value}` }); }} data-testid="date-month">
                <option value="">—</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>{monthName(Number(m))}</option>)}
              </select>
              <select aria-label={t('dateYear')} value={my} onChange={(e) => { setMy(e.target.value); if (mm) pick({ month: `${e.target.value}-${mm}` }); }} data-testid="date-year">
                {Array.from({ length: thisYear - 2009 }, (_, i) => String(thisYear - i)).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </span>
          </div>
          <form className={s.dateRow} onSubmit={(e) => { e.preventDefault(); if (from || to) pick({ from, to }); }}>
            <span>{t('dateRange')}</span>
            <span className={s.dateInline}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('dateFrom')} max={to || undefined} data-testid="date-from" />
              <span aria-hidden>–</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('dateTo')} min={from || undefined} data-testid="date-to" />
              <Button type="submit" variant="secondary" isDisabled={!from && !to}>{t('dateApply')}</Button>
            </span>
          </form>
          {current ? <button type="button" className={s.textBtn} onClick={() => pick({})}>{t('dateClear')}</button> : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
