import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The fonts are self-hosted (README rule) and split by script: Zain draws Arabic, digits and punctuation;
 * Outfit draws every Latin letter. Zain has no Ğ ğ Ş ş İ at all — its own Latin would leave Turkish words
 * half in a fallback face — so these tests open the font files themselves and check the glyphs are there,
 * not just that a @font-face rule says so.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FONTS = join(ROOT, 'public/fonts');
const css = readFileSync(join(ROOT, 'src/styles/fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Face { family: string; weight: [number, number]; file: string; ranges: [number, number][] | null }
const faces: Face[] = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const body = m[1]!;
  const prop = (name: string) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();
  const w = (prop('font-weight') ?? '400').split(/\s+/).map(Number);
  const range = prop('unicode-range');
  return {
    family: (prop('font-family') ?? '').replace(/["']/g, ''),
    weight: [w[0]!, w[1] ?? w[0]!],
    file: /url\(["']?\/fonts\/([^"')]+)["']?\)/.exec(prop('src') ?? '')?.[1] ?? '',
    ranges: range ? range.split(',').map((r) => {
      const [a, b] = r.trim().replace(/^U\+/i, '').split('-');
      return [parseInt(a!, 16), parseInt(b ?? a!, 16)] as [number, number];
    }) : null,
  };
});
const claims = (f: Face, cp: number) => f.ranges === null || f.ranges.some(([a, b]) => cp >= a && cp <= b);

/* ── a WOFF2 reader, just far enough to list the code points a file can draw ───────────────────── */
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function codePoints(file: string): Set<number> {
  const buf = readFileSync(join(FONTS, file));
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file} is not WOFF2`);
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]!; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return v >>> 0; };
  const tables: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++]!;
    const idx = flags & 0x3f;
    const tag = idx === 63 ? buf.toString('latin1', p, (p += 4)) : KNOWN[idx]!;
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : origLength });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + compressedSize));
  let off = 0, cmap: Buffer | undefined;
  for (const t of tables) { if (t.tag === 'cmap') cmap = data.subarray(off, off + t.length); off += t.length; }
  if (!cmap) throw new Error(`${file} has no cmap`);

  const found = new Set<number>();
  const n = cmap.readUInt16BE(2);
  const subtables = Array.from({ length: n }, (_, i) => ({ platform: cmap!.readUInt16BE(4 + i * 8), encoding: cmap!.readUInt16BE(6 + i * 8), offset: cmap!.readUInt32BE(8 + i * 8) }));
  for (const st of subtables) {
    if (!(st.platform === 0 || (st.platform === 3 && (st.encoding === 1 || st.encoding === 10)))) continue;
    const t = cmap.subarray(st.offset);
    const format = t.readUInt16BE(0);
    if (format === 4) {
      const segCount = t.readUInt16BE(6) / 2;
      const end = 14, start = end + segCount * 2 + 2, delta = start + segCount * 2, rangeOff = delta + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const [e, b, d, ro] = [t.readUInt16BE(end + s * 2), t.readUInt16BE(start + s * 2), t.readInt16BE(delta + s * 2), t.readUInt16BE(rangeOff + s * 2)];
        for (let c = b; c <= e && c !== 0xffff; c++) {
          const gid = ro === 0 ? (c + d) & 0xffff : t.readUInt16BE(rangeOff + s * 2 + ro + (c - b) * 2);
          if (gid !== 0) found.add(c);
        }
      }
    } else if (format === 12) {
      const groups = t.readUInt32BE(12);
      for (let g = 0; g < groups; g++) {
        const [b, e, gid] = [t.readUInt32BE(16 + g * 12), t.readUInt32BE(20 + g * 12), t.readUInt32BE(24 + g * 12)];
        for (let c = b; c <= e; c++) if (gid + (c - b) !== 0) found.add(c);
      }
    }
  }
  return found;
}
const cmapCache = new Map<string, Set<number>>();
const draws = (f: Face, cp: number) => { if (!cmapCache.has(f.file)) cmapCache.set(f.file, codePoints(f.file)); return cmapCache.get(f.file)!.has(cp); };
/** A code point is covered when some face of that family and weight both claims it and really holds the glyph. */
const covered = (family: string, weight: number, cp: number) => faces.some((f) => f.family === family && weight >= f.weight[0] && weight <= f.weight[1] && claims(f, cp) && draws(f, cp));
const uncovered = (family: string, weight: number, text: string) => [...text].filter((ch) => !covered(family, weight, ch.codePointAt(0)!)).join('');

const TURKISH = 'ĞğŞşİıÇçÖöÜüÂâÎîÛû';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS_PUNCT = '0123456789 .,:;!?()[]/-+%·«»…';
const ARABIC = 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىيًٌٍَُِّْ،؛؟';

describe('self-hosted fonts', () => {
  it('every @font-face points at a file that exists, and nothing still points at IBM Plex', () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) expect(existsSync(join(FONTS, f.file)), f.file).toBe(true);
    expect(faces.filter((f) => /plex/i.test(f.family + f.file))).toEqual([]);
  });

  it('declares the three families in the weights the type scale uses', () => {
    const weights = (family: string) => [...new Set(faces.filter((f) => f.family === family).map((f) => f.weight.join('-')))].sort();
    expect(weights('Zain')).toEqual(['400-400', '700-700', '800-800']);
    expect(weights('Outfit')).toEqual(['400-400', '700-700', '800-800']);
    expect(weights('Geist Mono')).toEqual(['100-900']); // one cut answers every weight: numbers never go faux-bold
  });

  it('Zain draws Arabic, digits and punctuation in every weight', () => {
    for (const w of [400, 700, 800]) expect(uncovered('Zain', w, ARABIC + DIGITS_PUNCT), `weight ${w}`).toBe('');
  });

  it('Zain never claims a Latin letter — it has no Ğ ğ Ş ş İ, so Latin belongs to Outfit whole', () => {
    const latinLetters = [...LATIN + TURKISH].map((ch) => ch.codePointAt(0)!);
    for (const f of faces.filter((x) => x.family === 'Zain')) {
      expect(f.ranges, `${f.file} must carry a unicode-range`).not.toBeNull();
      expect(latinLetters.filter((cp) => claims(f, cp)).map((cp) => String.fromCodePoint(cp)).join(''), f.file).toBe('');
    }
  });

  it('Outfit really holds every Turkish letter, in every weight', () => {
    for (const w of [400, 700, 800]) expect(uncovered('Outfit', w, LATIN + TURKISH + DIGITS_PUNCT.replace(/[«»]/g, '')), `weight ${w}`).toBe('');
  });

  it('Geist Mono holds digits, Latin and Turkish letters (file names carry them)', () => {
    expect(uncovered('Geist Mono', 500, LATIN + TURKISH + '0123456789 .,:/-_×')).toBe('');
  });

  it('ships each licence beside its fonts (OFL 1.1 asks for it)', () => {
    for (const name of ['OFL-Zain.txt', 'OFL-Outfit.txt', 'OFL-Geist-Mono.txt']) expect(existsSync(join(FONTS, name)), name).toBe(true);
  });
});
