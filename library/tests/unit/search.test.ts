import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeSearch, searchTokens } from '@/lib/format';

/* The acceptance of M6 («الزفاف» = «زفاف», «istanbul» = «İstanbul») and the JS ⇄ SQL twins staying identical. */

const SAMPLES = [
  'حفل الزفاف الجماعي', 'زفاف', 'İstanbul Ofisi', 'ISTANBUL', 'ıstanbul', 'مؤسسة النور للتنمية', 'وَالبيت والد',
  'تخرّج', 'أحمد إبراهيم آل', 'مستشفى الأمل', 'الـــحفل', 'Çocuk Şenliği', 'بالمدرسة', 'ال', 'الل', 'Gıda kolisi — Refah',
  '  مسافات   كثيرة  ', 'DSC_4821.JPG', 'رشزة 2025',
];

describe('normalizeSearch', () => {
  it('«الزفاف» = «زفاف»; the article goes from every word, never from a 1-letter rest', () => {
    expect(normalizeSearch('الزفاف')).toBe(normalizeSearch('زفاف'));
    expect(normalizeSearch('حفل الزفاف الجماعي')).toBe('حفل زفاف جماعي');
    expect(normalizeSearch('مؤسسة النور للتنمية')).toBe('مؤسسه نور تنميه');
    expect(normalizeSearch('بالمدرسة')).toBe('مدرسه');
    expect(normalizeSearch('والد')).toBe('والد'); // «و+ال+د» would leave one letter
  });
  it('«istanbul» = «İstanbul» = «ISTANBUL»; Turkish letters otherwise kept', () => {
    for (const v of ['İstanbul', 'ISTANBUL', 'ıstanbul', 'istanbul']) expect(normalizeSearch(v)).toBe('istanbul');
    expect(normalizeSearch('Çocuk Şenliği')).toBe('çocuk şenliği');
  });
  it('harakat, tatweel, hamza forms, alef maqsura and taa marbuta fold', () => {
    expect(normalizeSearch('تخرّج')).toBe('تخرج');
    expect(normalizeSearch('الـــحفل')).toBe('حفل');
    expect(normalizeSearch('أحمد إبراهيم آل')).toBe('احمد ابراهيم ال');
    expect(normalizeSearch('مستشفى')).toBe('مستشفي');
  });
  it('tokens: words, de-duplicated, at most 8', () => {
    expect(searchTokens('  حفل   الحفل زفاف ')).toEqual(['حفل', 'زفاف']);
    expect(searchTokens('a b c d e f g h i j')).toHaveLength(8);
    expect(searchTokens('   ')).toEqual([]);
  });
});

// The SQL twin (needs the migrated database — CI and local runs both have it)
const url = process.env.DATABASE_URL;
const db = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;
afterAll(async () => { await db?.end(); });

describe.skipIf(!db)('ml_norm() in Postgres', () => {
  it('gives exactly what normalizeSearch gives, for every sample', async () => {
    const rows = await db!<{ v: string; n: string }[]>`select v, ml_norm(v) as n from unnest(${SAMPLES}::text[]) v`;
    for (const r of rows) expect(r.n, r.v).toBe(normalizeSearch(r.v));
  });
});
