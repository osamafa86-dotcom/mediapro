/*
 * Upload rules shared by the browser and the server — one source, so both split a file the same way
 * (a resumed upload must reuse the original part boundaries) and agree on what a file is.
 */

export const MIB = 1024 * 1024;
export const MAX_FILE_BYTES = 200 * 1024 ** 3; // 200 GB per file
const MAX_PARTS = 9_000; // S3 allows 10,000; keep headroom

/** 16 MiB parts; bigger (whole MiB) only when a file would need more than 9,000 parts. */
export function partSizeFor(size: number): number {
  return Math.max(16 * MIB, Math.ceil(size / MAX_PARTS / MIB) * MIB);
}

export const partCount = (size: number) => Math.max(1, Math.ceil(size / partSizeFor(size)));

const RAW = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw', '3fr', 'iiq', 'x3f', 'erf', 'kdc', 'mrw', 'rwl'];
const PHOTO = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'tif', 'tiff', 'avif'];
const VIDEO = ['mp4', 'mov', 'm4v', 'mxf', 'mkv', 'avi', 'mts', 'm2ts', 'webm', '3gp', 'mpg', 'mpeg'];

export const ACCEPT = [...RAW, ...PHOTO, ...VIDEO].map((e) => `.${e}`).join(',');

export type Section = 'photos' | 'videos';
export type Group = 'final' | 'raw' | 'footage';

export const extOf = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toLowerCase();

/**
 * Where a file belongs, by its extension (the bytes are checked again by the worker in M4).
 * RAW always goes to «خام»; a video can be final or footage («رشزات»); a photo is final.
 * Returns null for anything we do not accept.
 */
export function classify(name: string, wanted: Group = 'final'): { section: Section; group: Group; raw: boolean } | null {
  const ext = extOf(name);
  if (RAW.includes(ext)) return { section: 'photos', group: 'raw', raw: true };
  if (PHOTO.includes(ext)) return { section: 'photos', group: 'final', raw: false };
  if (VIDEO.includes(ext)) return { section: 'videos', group: wanted === 'footage' ? 'footage' : 'final', raw: false };
  return null;
}

/** Object key part from a file name: ASCII-safe, extension kept; the original name is stored separately. */
export function safeName(name: string): string {
  const ext = extOf(name);
  const base = name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
  return `${base || 'file'}${ext ? `.${ext}` : ''}`;
}
