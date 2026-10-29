import { describe, expect, it } from 'vitest';
import { findDate, groupFromPath, suggest } from '@/lib/import-suggest';

const clients = [
  { id: 'nur', name_ar: 'مؤسسة النور للتنمية', name_tr: 'Nur Kalkınma Vakfı' },
  { id: 'amal', name_ar: 'جمعية الأمل', name_tr: null },
  { id: 'one', name_ar: 'اليونيسف', name_tr: 'UNICEF' },
];

describe('findDate', () => {
  it.each([
    ['2025-03-14 حفل', '2025-03-14'], ['حفل 2025.03.14', '2025-03-14'], ['20250314_حفل', '2025-03-14'],
    ['14-03-2025 حفل', '2025-03-14'], ['İstanbul Ofisi 12.06.2024', '2024-06-12'], ['حفل 3/1/2026', '2026-01-03'],
  ])('%s → %s', (name, date) => expect(findDate(name).date).toBe(date));
  it('refuses impossible dates and bare years', () => {
    expect(findDate('2025-02-30 حفل').date).toBeNull();
    expect(findDate('أرشيف 2024').date).toBeNull();
    expect(findDate('IMG_20251399').date).toBeNull();
  });
});

describe('suggest', () => {
  it('finds the client from the words of its Arabic or Turkish name, and keeps a clean title', () => {
    expect(suggest('2025-03-14 حفل تخرج مؤسسة النور', clients)).toEqual({ clientId: 'nur', date: '2025-03-14', title: 'حفل تخرج مؤسسة النور' });
    expect(suggest('Nur Vakfı — Gıda kolisi 01.02.2026', clients).clientId).toBe('nur');
    expect(suggest('توزيع جمعية الامل', clients).clientId).toBe('amal'); // «الأمل» = «الامل»
    expect(suggest('UNICEF field visit', clients).clientId).toBe('one'); // a one-word name needs its one word
  });
  it('does not guess from one shared word of a longer name', () => {
    expect(suggest('حفل النور السنوي', clients).clientId).toBeNull(); // «نور» alone is not «مؤسسة النور للتنمية»
    expect(suggest('منوعات', clients)).toEqual({ clientId: null, date: null, title: 'منوعات' });
  });
});

describe('groupFromPath', () => {
  it('reads RAW / خام / footage / رشزات / Ham çekim from sub-folders', () => {
    expect(groupFromPath(['RAW'])).toBe('raw');
    expect(groupFromPath(['صور', 'خام'])).toBe('raw');
    expect(groupFromPath(['Ham çekim'])).toBe('footage');
    expect(groupFromPath(['فيديو', 'رشزات'])).toBe('footage');
    expect(groupFromPath(['B-roll'])).toBe('footage');
    expect(groupFromPath(['Final'])).toBeNull();
    expect(groupFromPath([])).toBeNull();
    expect(groupFromPath(['Drawings'])).toBeNull(); // «raw» inside a word is not RAW
  });
});
