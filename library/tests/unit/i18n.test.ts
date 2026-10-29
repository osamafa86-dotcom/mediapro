import { describe, expect, it } from 'vitest';
import { dirOf, intlLocale, isLocale } from '@/i18n/config';

describe('i18n config', () => {
  it('maps locales to direction', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('tr')).toBe('ltr');
  });
  it('pins the numbering system — Latin digits unless Arabic-Indic is requested', () => {
    expect(new Intl.NumberFormat(intlLocale('ar')).format(1284)).toBe('1,284');
    expect(new Intl.NumberFormat(intlLocale('ar', true)).format(12)).toBe('١٢');
    expect(new Intl.NumberFormat(intlLocale('tr')).format(1284)).toBe('1.284');
  });
  it('rejects unknown locales', () => {
    expect(isLocale('en')).toBe(false);
    expect(isLocale('tr')).toBe(true);
  });
});
