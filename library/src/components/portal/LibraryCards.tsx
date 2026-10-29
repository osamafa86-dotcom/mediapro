'use client';
import { Calendar, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/ui';
import s from './portal.module.css';

export interface Card { id: string; title: string; year: number; date: string | null; place: string | null; counts: string; until: string | null; cover: string | null; bg?: string }

/** Project cards with a simple year filter (DESIGN §6: «فلتر تاريخ بسيط»). */
export function LibraryCards({ cards }: { cards: Card[] }) {
  const t = useTranslations('portal');
  const years = [...new Set(cards.map((c) => c.year))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | null>(null);
  const shown = year ? cards.filter((c) => c.year === year) : cards;
  return (
    <>
      {years.length > 1 ? (
        <div className={s.chips} role="group" aria-label={t('years')}>
          <Chip label={t('allYears')} isSelected={year === null} onChange={() => setYear(null)} />
          {years.map((y) => <Chip key={y} label={<span className={s.num}>{y}</span>} isSelected={year === y} onChange={() => setYear(y)} />)}
        </div>
      ) : null}
      <ul className={s.cards}>
        {shown.map((c) => (
          <li key={c.id} data-project-id={c.id}>
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
