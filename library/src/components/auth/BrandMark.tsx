import { Film } from 'lucide-react';
import s from './auth.module.css';

export function BrandMark() {
  return <div className={s.mark} aria-hidden><Film size={22} /></div>;
}
