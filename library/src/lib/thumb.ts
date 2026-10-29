import { thumbHashToDataURL } from 'thumbhash';

/** ThumbHash (base64) → a tiny PNG data URL used as the placeholder behind an image. */
export function placeholder(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  try { return thumbHashToDataURL(Buffer.from(hash, 'base64')); } catch { return undefined; }
}
