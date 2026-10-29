import { describe, expect, it } from 'vitest';
import { daysUntil, formatBytes, formatDay, normalizeSearch } from '@/lib/format';

describe('format', () => {
  it('bytes with Latin digits in Arabic by default', () => {
    expect(formatBytes(18.4 * 1024 ** 3, 'ar')).toBe('18.4 GB');
    expect(formatBytes(2.1 * 1024 ** 4, 'tr')).toBe('2,1 TB');
    expect(formatBytes(512, 'ar')).toBe('512 B');
    expect(formatBytes(18.4 * 1024 ** 3, 'ar', 'arab')).toBe('١٨٫٤ GB');
  });
  it('Levantine months', () => {
    expect(formatDay('2026-10-12T10:00:00Z', 'ar')).toBe('12 تشرين الأول 2026');
    expect(formatDay('2026-10-12T10:00:00Z', 'tr')).toBe('12 Ekim 2026');
  });
  it('search folding: Arabic letter forms and Turkish i', () => {
    expect(normalizeSearch('أَحمد')).toBe(normalizeSearch('احمد'));
    expect(normalizeSearch('مدرسة')).toBe(normalizeSearch('مدرسه'));
    expect(normalizeSearch('مستشفى')).toBe(normalizeSearch('مستشفي'));
    expect(normalizeSearch('İstanbul')).toBe('istanbul');
    expect(normalizeSearch('ISPARTA')).toBe(normalizeSearch('ısparta'));
  });
  it('daysUntil', () => {
    expect(daysUntil(new Date(Date.now() + 4.2 * 86_400_000))).toBe(5);
  });
});

describe('bidi isolation', async () => {
  const { formatPct, joinNames, ltr } = await import('@/lib/format');
  it('isolates figures with units so the sign stays put inside Arabic text', () => {
    expect(formatPct(64, 'ar')).toBe('⁦64%⁩');
    expect(formatPct(64, 'tr')).toBe('⁦%64⁩'); // Turkish writes the sign first
    expect(ltr('18.4 GB')).toBe('⁦18.4 GB⁩');
  });
  it('isolates each name in a list', () => {
    expect(joinNames(['ريم حسن', 'سامي'], 'tr')).toBe('⁨ريم حسن⁩, ⁨سامي⁩');
    expect(joinNames([], 'ar')).toBe('—');
  });
});
