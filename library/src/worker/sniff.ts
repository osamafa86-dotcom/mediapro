/*
 * What a file really is, from its first bytes — the extension only chose the upload's group (M3).
 * A file whose bytes contradict its section never gets renditions and fails with a reason.
 */
export type Kind = 'jpeg' | 'png' | 'webp' | 'heif' | 'avif' | 'tiff' | 'raw' | 'video' | 'unknown';

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));

export function sniff(b: Uint8Array): Kind {
  if (b.length < 12) return 'unknown';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'AVI ') return 'video';
  if (ascii(b, 0, 15) === 'FUJIFILMCCD-RAW') return 'raw';
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (brand === 'crx ') return 'raw'; // Canon CR3
    if (['avif', 'avis'].includes(brand)) return 'avif';
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heif';
    return 'video'; // isom, mp41, mp42, qt  , M4V , 3gp…
  }
  // TIFF family: plain TIFF and the TIFF-based RAWs (CR2, NEF, ARW, DNG, PEF, SRW…), Olympus/Panasonic variants
  if ((b[0] === 0x49 && b[1] === 0x49 && (b[2] === 0x2a || b[2] === 0x52 || b[2] === 0x55)) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) {
    return b[2] === 0x2a || b[3] === 0x2a ? 'tiff' : 'raw';
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video'; // Matroska / WebM
  if (b[0] === 0x06 && b[1] === 0x0e && b[2] === 0x2b && b[3] === 0x34) return 'video'; // MXF
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && (b[3] === 0xba || b[3] === 0xb3)) return 'video'; // MPEG-PS
  if (b[0] === 0x47 && b.length > 188 && b[188] === 0x47) return 'video'; // MPEG-TS
  if (b.length > 196 && b[4] === 0x47 && b[196] === 0x47) return 'video'; // M2TS / MTS (192-byte packets)
  return 'unknown';
}

/** Does the content fit where the upload put it? TIFF counts as RAW-compatible (CR2/NEF/ARW/DNG start as TIFF). */
export function fits(kind: Kind, section: 'photos' | 'videos', group: string): boolean {
  if (section === 'videos') return kind === 'video';
  if (group === 'raw') return kind === 'raw' || kind === 'tiff';
  return ['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff'].includes(kind);
}
