import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import type { AssetEdit, Renditions } from '@/db/schema';
import { ProcessingError } from './errors';
import { run } from './run';
import { putBuffer } from './s3io';

/*
 * Images: AVIF → WebP → JPEG at grid widths, larger WebP/JPEG for zoom and the 2048px web download,
 * watermarked copies for guests, ThumbHash for the blurred placeholder. RAW is shown through its
 * embedded JPEG preview (DESIGN: «معاينة JPEG المضمّنة أولًا»), fully decoded only when it has none.
 */

const GRID = [320, 640, 1280];
const LARGE = [2048, 3840];
const PHONE_MAKES = /^(apple|samsung|google|xiaomi|huawei|honor|oneplus|oppo|vivo|realme|motorola|nokia|tecno|infinix|redmi|poco)/i;

export interface ExifInfo { takenAt: Date | null; captureSource: 'phone' | 'camera' | null; orientation: number | null }

/** exiftool reads every format we accept (HEIC, CR3, NEF…); the date is taken in the studio time zone unless the file says its offset. */
export async function readExif(file: string, timeZone = 'Asia/Hebron'): Promise<ExifInfo> {
  let m: Record<string, unknown> = {};
  try {
    m = (JSON.parse((await run('exiftool', ['-json', '-n', '-DateTimeOriginal', '-CreateDate', '-OffsetTimeOriginal', '-Make', '-Model', '-Orientation', file], { timeoutMs: 60_000 })).toString()) as Record<string, unknown>[])[0] ?? {};
  } catch { /* no metadata is not a failure */ }
  const raw = String(m.DateTimeOriginal ?? m.CreateDate ?? '');
  const d = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  let takenAt: Date | null = null;
  if (d && d[1] !== '0000') {
    const local = `${d[1]}-${d[2]}-${d[3]}T${d[4]}:${d[5]}:${d[6]}`;
    const off = typeof m.OffsetTimeOriginal === 'string' && /^[+-]\d{2}:\d{2}$/.test(m.OffsetTimeOriginal) ? m.OffsetTimeOriginal : zoneOffset(local, timeZone);
    takenAt = new Date(`${local}${off}`);
    if (Number.isNaN(takenAt.getTime())) takenAt = null;
  }
  const make = String(m.Make ?? '').trim();
  return { takenAt, captureSource: make ? (PHONE_MAKES.test(make) ? 'phone' : 'camera') : null, orientation: typeof m.Orientation === 'number' ? m.Orientation : null };
}

function zoneOffset(local: string, tz: string) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(`${local}Z`)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const mm = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return mm ? `${mm[1]}:${mm[2] ?? '00'}` : '+00:00';
}

/** The largest embedded JPEG a RAW carries, else a half-size LibRaw decode. */
export async function rawSource(file: string, dir: string): Promise<{ path: string; embedded: boolean }> {
  for (const tag of ['-JpgFromRaw', '-PreviewImage', '-OtherImage']) {
    try {
      const buf = await run('exiftool', ['-b', tag, file], { timeoutMs: 120_000 });
      if (buf.length > 10_000 && buf[0] === 0xff && buf[1] === 0xd8) {
        const p = join(dir, 'raw-preview.jpg');
        await writeFile(p, buf);
        return { path: p, embedded: true };
      }
    } catch { /* try the next tag */ }
  }
  try {
    await run('dcraw_emu', ['-h', '-w', '-T', '-Z', join(dir, 'raw-decoded.tiff'), file], { timeoutMs: 10 * 60_000 });
    return { path: join(dir, 'raw-decoded.tiff'), embedded: false };
  } catch (e) {
    throw new ProcessingError('raw_no_preview', (e as Error).message);
  }
}

const ROT: Record<number, number> = { 3: 180, 6: 90, 8: 270 };

export async function imageRenditions(opts: {
  src: string; id: string; keyPrefix: string; watermark: string; rotateFromExif?: number | null; maxWidths?: number[];
  /** the admin's edit (quarter turns, then a crop of the turned picture), applied after EXIF orientation */
  edit?: Pick<AssetEdit, 'rotate' | 'crop'> | null;
}): Promise<{ renditions: Partial<Renditions>; width: number; height: number; thumbhash: string }> {
  let base: Sharp;
  try {
    base = sharp(await readFile(opts.src), { failOn: 'error', limitInputPixels: 500_000_000 });
    // embedded RAW previews carry no orientation of their own: use the RAW's
    base = opts.rotateFromExif && ROT[opts.rotateFromExif] ? base.rotate(ROT[opts.rotateFromExif]) : base.rotate();
    const flat = await base.toBuffer({ resolveWithObject: true });
    base = sharp(flat.data);
  } catch (e) {
    throw new ProcessingError('decode_failed', (e as Error).message);
  }
  const k = (name: string) => `${opts.keyPrefix}${opts.id}/${name}`;
  const extra: Partial<Renditions> = {};
  if (opts.edit) {
    // what the edit dialog draws from: the picture as shot (oriented), never the edited one
    extra.source = k('source.webp');
    await putBuffer(extra.source, await base.clone().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(), 'image/webp');
    base = await applyEdit(base, opts.edit);
    const full = await base.clone().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    extra.edited = { key: k('edited.jpg'), size: full.length };
    await putBuffer(extra.edited.key, full, 'image/jpeg');
  }
  const { width = 0, height = 0 } = await base.metadata();
  if (!width || !height) throw new ProcessingError('decode_failed', 'no dimensions');
  const widths = (opts.maxWidths ?? [...GRID, ...LARGE]).filter((w) => w <= width);
  if (!widths.length) widths.push(width);

  const images: NonNullable<Renditions['images']> = [];
  for (const w of widths) {
    const resized = base.clone().resize({ width: w, withoutEnlargement: true });
    const h = Math.round((height * Math.min(w, width)) / width);
    const entry: (typeof images)[number] = { w, h };
    if (GRID.includes(w)) {
      entry.avif = k(`${w}.avif`);
      await putBuffer(entry.avif, await resized.clone().avif({ quality: 50, effort: 4 }).toBuffer(), 'image/avif');
    }
    entry.webp = k(`${w}.webp`);
    await putBuffer(entry.webp, await resized.clone().webp({ quality: 80 }).toBuffer(), 'image/webp');
    entry.jpeg = k(`${w}.jpg`);
    await putBuffer(entry.jpeg, await resized.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer(), 'image/jpeg');
    images.push(entry);
  }
  // the 2048px web download (or the largest we have below it)
  const web = [...images].reverse().find((i) => i.w <= 2048)?.jpeg ?? images[images.length - 1]!.jpeg;

  // guest previews: always watermarked, never larger than 1280
  const wm: NonNullable<Renditions['wm']> = [];
  for (const w of [640, 1280].filter((x) => x <= width || x === 640)) {
    const resized = await base.clone().resize({ width: Math.min(w, width), withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const mark = Buffer.from(watermarkSvg(resized.info.width, resized.info.height, opts.watermark));
    const out = sharp(resized.data).composite([{ input: mark, top: 0, left: 0 }]);
    const entry = { w, h: resized.info.height, webp: k(`wm-${w}.webp`), jpeg: k(`wm-${w}.jpg`) };
    await putBuffer(entry.webp, await out.clone().webp({ quality: 78 }).toBuffer(), 'image/webp');
    await putBuffer(entry.jpeg, await out.clone().jpeg({ quality: 80 }).toBuffer(), 'image/jpeg');
    wm.push(entry);
  }

  // ThumbHash from ≤100px RGBA
  const small = await base.clone().resize(100, 100, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const thumbhash = Buffer.from(rgbaToThumbHash(small.info.width, small.info.height, small.data)).toString('base64');

  return { renditions: { images, web, wm, ...extra }, width, height, thumbhash };
}

/** Quarter turns, then the crop (0..1 of the turned picture, clamped to whole pixels inside it). Exported for tests. */
export async function applyEdit(img: Sharp, e: Pick<AssetEdit, 'rotate' | 'crop'>): Promise<Sharp> {
  let out = img;
  if (e.rotate) out = sharp(await out.rotate(e.rotate).toBuffer());
  if (e.crop) {
    const { width = 0, height = 0 } = await out.metadata();
    const left = Math.min(width - 1, Math.max(0, Math.round(e.crop.x * width)));
    const top = Math.min(height - 1, Math.max(0, Math.round(e.crop.y * height)));
    const w = Math.max(1, Math.min(width - left, Math.round(e.crop.w * width)));
    const h = Math.max(1, Math.min(height - top, Math.round(e.crop.h * height)));
    out = sharp(await out.extract({ left, top, width: w, height: h }).toBuffer());
  }
  return out;
}

/** Diagonal repeated text; Latin name so it renders with the base fonts in the worker image. */
function watermarkSvg(w: number, h: number, text: string) {
  const safe = text.replace(/[<>&"']/g, '');
  const size = Math.max(14, Math.round(w / 22));
  const rows: string[] = [];
  for (let y = -h; y < h * 2; y += size * 5) {
    for (let x = -w; x < w * 2; x += size * safe.length * 0.75 + size * 3) {
      rows.push(`<text x="${x}" y="${y}">${safe}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="rotate(-30 ${w / 2} ${h / 2})" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="600" fill="#fff" fill-opacity="0.28" stroke="#000" stroke-opacity="0.12" stroke-width="1">${rows.join('')}</g></svg>`;
}
