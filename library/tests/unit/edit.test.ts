import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { applyEdit } from '@/worker/image';

/* The worker's edit: quarter turns first, then the crop as fractions of the turned picture (what react-easy-crop reports). */
const img = () => sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 10, b: 10 } } }).png();
const size = async (s: Sharp) => { const m = await s.metadata(); return [m.width, m.height]; };

describe('applyEdit', () => {
  it('a quarter turn swaps the sides; a half turn keeps them', async () => {
    expect(await size(await applyEdit(img(), { rotate: 90, crop: null }))).toEqual([200, 300]);
    expect(await size(await applyEdit(img(), { rotate: 180, crop: null }))).toEqual([300, 200]);
  });
  it('the crop is a share of the turned picture', async () => {
    expect(await size(await applyEdit(img(), { rotate: 0, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }))).toEqual([150, 200]);
    expect(await size(await applyEdit(img(), { rotate: 90, crop: { x: 0, y: 0.5, w: 1, h: 0.5 } }))).toEqual([200, 150]);
  });
  it('a crop past the edge is clamped to whole pixels inside the picture', async () => {
    expect(await size(await applyEdit(img(), { rotate: 0, crop: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } }))).toEqual([30, 20]);
  });
});
