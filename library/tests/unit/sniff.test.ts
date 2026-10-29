import { describe, expect, it } from 'vitest';
import { fits, sniff } from '@/worker/sniff';

const bytes = (...parts: (number[] | string)[]) => {
  const out: number[] = [];
  for (const p of parts) out.push(...(typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p));
  while (out.length < 400) out.push(0);
  return Uint8Array.from(out);
};

describe('sniff', () => {
  it('recognises images, RAW and video from their bytes', () => {
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe1]))).toBe('jpeg');
    expect(sniff(bytes([0x89], 'PNG'))).toBe('png');
    expect(sniff(bytes('RIFF', [0, 0, 0, 0], 'WEBP'))).toBe('webp');
    expect(sniff(bytes([0, 0, 0, 0x18], 'ftypheic'))).toBe('heif');
    expect(sniff(bytes([0, 0, 0, 0x18], 'ftypcrx '))).toBe('raw');
    expect(sniff(bytes([0, 0, 0, 0x18], 'ftypisom'))).toBe('video');
    expect(sniff(bytes([0, 0, 0, 0x14], 'ftypqt  '))).toBe('video');
    expect(sniff(bytes('II', [0x2a, 0]))).toBe('tiff'); // TIFF and TIFF-based RAW (CR2/NEF/ARW/DNG)
    expect(sniff(bytes('IIU', [0]))).toBe('raw'); // Panasonic RW2
    expect(sniff(bytes('FUJIFILMCCD-RAW 0201'))).toBe('raw');
    expect(sniff(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video');
  });
  it('a script or document renamed .jpg is unknown', () => {
    expect(sniff(bytes('<?php echo 1; ?>'))).toBe('unknown');
    expect(sniff(bytes('<html><script>'))).toBe('unknown');
    expect(sniff(bytes('%PDF-1.7'))).toBe('unknown');
  });
  it('content must fit its section and group', () => {
    expect(fits('jpeg', 'photos', 'final')).toBe(true);
    expect(fits('video', 'photos', 'final')).toBe(false);
    expect(fits('jpeg', 'videos', 'final')).toBe(false);
    expect(fits('tiff', 'photos', 'raw')).toBe(true);
    expect(fits('raw', 'photos', 'final')).toBe(false);
    expect(fits('unknown', 'photos', 'final')).toBe(false);
  });
});
