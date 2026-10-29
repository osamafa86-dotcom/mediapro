'use client';
import { Calendar, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { normalizeSearch, searchTokens } from '@/lib/format';
import { Chip } from '@/components/ui';
import s from './portal.module.css';

export interface Card { key: string; id: string; title: string; year: number; date: string | null; place: string | null; counts: string; until: string | null; cover: string | null; bg?: string }

/** Project cards with a simple year filter (DESIGN §6: «فلتر تاريخ بسيط»). */
export function LibraryCards({ cards }: { cards: Card[] }) {
  const t = useTranslations('portal');
  const years = [...new Set(cards.map((c) => c.year))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | null>(null);
  const q = useSearchParams().get('q') ?? '';
  const toks = searchTokens(q);
  const keys = useMemo(() => new Map(cards.map((c) => [c.id, normalizeSearch(c.key)])), [cards]);
  const matching = toks.length ? cards.filter((c) => toks.every((tk) => keys.get(c.id)!.includes(tk))) : cards;
  const shown = year ? matching.filter((c) => c.year === year) : matching;
  // a search that finds nothing in the chosen year says where it did find something (Figma states 5)
  const elsewhere = year && toks.length && !shown.length ? matching : [];
  return (
    <>
      {years.length > 1 ? (
        <div className={s.chips} role="group" aria-label={t('years')}>
          <Chip label={t('allYears')} isSelected={year === null} onChange={() => setYear(null)} />
          {years.map((y) => <Chip key={y} label={<span className={s.num}>{y}</span>} isSelected={year === y} onChange={() => setYear(y)} />)}
        </div>
      ) : null}
      {toks.length && !shown.length ? (
        <section className={s.found} data-testid="search-empty">
          <h2 className="t-heading">{year ? t('search.noneYear', { q, year }) : t('search.none', { q })}</h2>
          <p className={s.muted}>{t('search.hint')}</p>
          {year && elsewhere.length ? <button type="button" className={s.secondary} onClick={() => setYear(null)}>{t('search.allYears')}</button> : null}
        </section>
      ) : null}
      <ul className={s.cards}>
        {(shown.length ? shown : elsewhere).map((c) => (
          <li key={c.id} data-project-id={c.id} data-elsewhere={!shown.length || undefined}>
            {!shown.length ? <p className={`${s.muted} ${s.small}`}>{t('search.foundIn', { year: c.year })}</p> : null}
            <Link href={`/p/${c.id}`} className={s.card}>
              <span className={s.cover} style={c.bg ? { backgroundImage: `url(${c.bg})` } : undefined}>
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authorized /m route, not next/image
                  <img src={`/m/${c.cover}/w640.webp`} srcSet={`/m/${c.cover}/w640.webp 640w, /m/${c.cover}/w1280.webp 1280w`} sizes="(max-width: 700px) 100vw, 420px" alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
              <h2 className={s.cardTitle}>{c.title}</h2>
              <span className={s.meta}>
                {c.date ? <span><Calendar size={14} aria-hidden />{c.date}</span> : null}
                {c.place ? <span><MapPin size={14} aria-hidden />{c.place}</span> : null}
                {c.counts ? <span>{c.counts}</span> : null}
              </span>
              {c.until ? <span className={s.meta}><span><Clock size={14} aria-hidden />{c.until}</span></span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
