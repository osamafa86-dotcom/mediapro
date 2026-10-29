import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

/*
 * Real media made on the spot (nothing binary in Git): a camera JPEG with EXIF, a TIFF-based RAW with
 * an embedded JPEG preview (the same layout as DNG/CR2/NEF/ARW), and a 1080p clip with sound.
 * Needs the worker's own tools (exiftool, ffmpeg) — docs/testing.md.
 */
export const FX = resolve(process.cwd(), 'test-results/fixtures');

export async function makeFixtures() {
  mkdirSync(FX, { recursive: true });
  const p = (f: string) => join(FX, f);
  if (!existsSync(p('cam.jpg'))) {
    await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 40, g: 120, b: 90 } } }).jpeg().toFile(p('cam.jpg'));
    execFileSync('exiftool', ['-q', '-overwrite_original', '-Make=Canon', '-Model=EOS R5', '-DateTimeOriginal=2026:10:12 10:30:00', p('cam.jpg')]);
  }
  if (!existsSync(p('IMG_0042.DNG'))) {
    await sharp({ create: { width: 640, height: 400, channels: 3, background: { r: 200, g: 80, b: 30 } } }).tiff().toFile(p('base.tif'));
    await sharp({ create: { width: 1600, height: 1067, channels: 3, background: { r: 20, g: 20, b: 160 } } }).jpeg().toFile(p('preview.jpg'));
    execFileSync('exiftool', ['-q', '-PreviewImage<=' + p('preview.jpg'), '-Make=Canon', '-o', p('IMG_0042.DNG'), p('base.tif')]);
  }
  if (!existsSync(p('clip.mp4'))) {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=25:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('clip.mp4')]);
  }
  // a shell script renamed to .jpg: the extension says photo, the bytes say otherwise
  if (!existsSync(p('holiday.jpg'))) writeFileSync(p('holiday.jpg'), '#!/bin/sh\necho not a photo\n'.repeat(40));
  // more photos of different shapes, so the justified grid has real rows to justify
  const shapes: [string, number, number, [number, number, number]][] = [
    ['wide.jpg', 3000, 1500, [180, 120, 60]], ['tall.jpg', 1600, 2400, [60, 90, 150]], ['square.jpg', 2000, 2000, [150, 40, 70]],
    ['ممر الطرود.jpg', 2400, 1600, [90, 140, 110]],
  ];
  for (const [name, w, h, [r, g, b]] of shapes) {
    if (existsSync(p(name))) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${r},${g},${b})"/><stop offset="1" stop-color="rgb(${b},${r},${g})"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="rgba(255,255,255,.35)"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(p(name));
  }
  return {
    cam: p('cam.jpg'), raw: p('IMG_0042.DNG'), clip: p('clip.mp4'), fakeJpg: p('holiday.jpg'),
    photos: shapes.map(([n]) => p(n)),
  };
}
