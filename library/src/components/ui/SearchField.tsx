'use client';
import { SearchField as RACSearchField, Input, Button, Label, type SearchFieldProps as RACProps } from 'react-aria-components';
import { Search, X } from 'lucide-react';
import s from './ui.module.css';

export interface SearchFieldProps extends RACProps {
  label: string;
  placeholder?: string;
  clearLabel: string;
  shortcut?: string;
}

export function SearchField({ label, placeholder, clearLabel, shortcut = '⌘K', className, ...rest }: SearchFieldProps) {
  return (
    <RACSearchField {...rest} className={[s.search, typeof className === 'string' ? className : ''].join(' ')}>
      <Label className="sr-only">{label}</Label>
      <Search size={16} strokeWidth={1.5} className={s.searchIcon} aria-hidden="true" />
      <Input placeholder={placeholder} className={s.searchInput} />
      <Button className={s.searchClear} aria-label={clearLabel}>
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      {shortcut ? <kbd className={s.kbd} aria-hidden="true">{shortcut}</kbd> : null}
    </RACSearchField>
  );
}
