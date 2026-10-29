'use client';
import { MoreHorizontal } from 'lucide-react';
import { Button, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Header, Separator } from 'react-aria-components';
import s from './admin.module.css';

export type MenuEntry = { id: string; label: string; danger?: boolean; selected?: boolean; onAction: () => void } | 'separator' | { header: string };

/** The one quiet «⋯» per row (financial-tables: no row of buttons at rest). Keyboard and screen-reader complete via React Aria. */
export function RowMenu({ label, entries }: { label: string; entries: MenuEntry[] }) {
  const groups: { header?: string; items: Extract<MenuEntry, { id: string }>[] }[] = [{ items: [] }];
  for (const e of entries) {
    if (e === 'separator') groups.push({ items: [] });
    else if ('header' in e) groups.push({ header: e.header, items: [] });
    else groups[groups.length - 1]!.items.push(e);
  }
  return (
    <MenuTrigger>
      <Button aria-label={label} className={s.rowMenu}><MoreHorizontal size={18} aria-hidden /></Button>
      <Popover className={s.menuPopover} placement="bottom end">
        <Menu className={s.menu} onAction={(key) => entries.find((e): e is Extract<MenuEntry, { id: string }> => typeof e === 'object' && 'id' in e && e.id === key)?.onAction()}>
          {groups.filter((g) => g.items.length).map((g, i) => (
            <MenuSection key={i} className={s.menuSection}>
              {i > 0 ? <Separator className={s.menuSep} /> : null}
              {g.header ? <Header className={s.menuHeader}>{g.header}</Header> : null}
              {g.items.map((it) => (
                <MenuItem key={it.id} id={it.id} className={s.menuItem} data-danger={it.danger || undefined} data-checked={it.selected || undefined}>
                  {it.label}
                </MenuItem>
              ))}
            </MenuSection>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
