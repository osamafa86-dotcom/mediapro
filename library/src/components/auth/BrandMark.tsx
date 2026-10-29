import { Film } from 'lucide-react';
import { getSql } from '@/db';
import s from './auth.module.css';

/** The library logo from settings when there is one, else the film mark (Figma 14:2). */
export async function BrandMark() {
  let logo = false;
  try { logo = (await getSql()`select 1 from settings where key = 'logo'`).length > 0; } catch { /* no DB: keep the mark */ }
  return (
    <div className={s.mark} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny same-origin logo */}
      {logo ? <img src="/api/branding/logo" alt="" width={32} height={32} style={{ objectFit: 'contain' }} /> : <Film size={22} />}
    </div>
  );
}
