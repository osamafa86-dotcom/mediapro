'use client';
import { Archive, CloudDownload, LayoutGrid, MessageSquare, SlidersHorizontal, Upload, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from './admin.module.css';

const ICONS = { dashboard: LayoutGrid, archive: Archive, notes: MessageSquare, upload: Upload, clients: Users, team: UserCog, import: CloudDownload, settings: SlidersHorizontal } as const;
export type NavKey = keyof typeof ICONS;

export interface NavItem { key: NavKey; href: string; label: string; count?: number }

export function NavLinks({ items, views }: { items: NavItem[]; views: { name: string; query: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
  return (
    <ul className={s.nav}>
      {items.map((it) => {
        const Icon = ICONS[it.key];
        return (
          <li key={it.key}>
            {/* title: the name on hover when the sidebar is folded to icons */}
            <Link href={it.href} className={s.navItem} aria-current={active(it.href) ? 'page' : undefined} title={it.label}>
              <Icon size={18} aria-hidden />
              <span className={s.navLabel}>{it.label}</span>
              {it.count !== undefined ? <span className={s.navCount}>{it.count}</span> : null}
            </Link>
            {it.key === 'archive' && views.length > 0 ? (
              <ul className={s.subnav}>
                {views.map((v) => <li key={v.name}><Link href={`/admin/archive?${v.query}`} className={s.subItem}>{v.name}</Link></li>)}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
