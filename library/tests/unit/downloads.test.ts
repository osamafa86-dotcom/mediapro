import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ getSql: () => { throw new Error('no db in unit tests'); } }));
const { zipNames } = await import('@/lib/downloads');
const { contentDisposition } = await import('@/lib/storage');

const F = { photos: 'الصور', videos: 'الفيديو', final: 'نهائي', raw: 'خام', footage: 'رشزات' };

describe('zipNames', () => {
  it('puts each file under <section>/<group>/', () => {
    expect(zipNames([{ section: 'photos', group: 'raw', original_name: 'IMG_1.CR3' }, { section: 'videos', group: 'footage', original_name: 'C0047.MP4' }], F))
      .toEqual(['الصور/خام/IMG_1.CR3', 'الفيديو/رشزات/C0047.MP4']);
  });
  it('numbers duplicates instead of overwriting, case-insensitively, keeping the extension', () => {
    const n = zipNames([
      { section: 'photos', group: 'final', original_name: 'DSC_1.jpg' },
      { section: 'photos', group: 'final', original_name: 'dsc_1.jpg' },
      { section: 'photos', group: 'final', original_name: 'DSC_1.jpg' },
      { section: 'photos', group: 'raw', original_name: 'DSC_1.jpg' },
    ], F);
    expect(n).toEqual(['الصور/نهائي/DSC_1.jpg', 'الصور/نهائي/dsc_1 (2).jpg', 'الصور/نهائي/DSC_1 (3).jpg', 'الصور/خام/DSC_1.jpg']);
  });
  it('never lets a name climb out of its folder', () => {
    const [a, b, c] = zipNames([
      { section: 'photos', group: 'final', original_name: '../../etc/passwd' },
      { section: 'photos', group: 'final', original_name: 'a\\b.jpg' },
      { section: 'photos', group: 'final', original_name: '.hidden' },
    ], F);
    expect(a).toBe('الصور/نهائي/__.._etc_passwd');
    expect(b).toBe('الصور/نهائي/a_b.jpg');
    expect(c).toBe('الصور/نهائي/_hidden');
    for (const x of [a, b, c]) expect(x!.split('/')).toHaveLength(3);
  });
});

describe('contentDisposition', () => {
  it('keeps the exact UTF-8 name and gives an ASCII fallback', () => {
    const h = contentDisposition('توزيع الطرود (2).jpg');
    expect(h).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(decodeURIComponent(h.split("UTF-8''")[1]!)).toBe('توزيع الطرود (2).jpg');
    expect(h.split("UTF-8''")[1]).not.toMatch(/[()'*]/); // RFC 5987 attr-char only
  });
  it('cannot break out of the quoted fallback', () => {
    expect(contentDisposition('a"b\\c.jpg')).toContain('filename="a_b_c.jpg"');
  });
});
