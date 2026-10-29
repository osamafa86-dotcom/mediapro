import { describe, expect, it } from 'vitest';
import type { Renditions } from '@/db/schema';
import { keyFor } from '@/lib/media-keys';

const R: Renditions = {
  images: [{ w: 320, avif: 'a320', webp: 'w320', jpeg: 'j320' }, { w: 640, avif: 'a640', webp: 'w640', jpeg: 'j640' }, { w: 2048, webp: 'w2048', jpeg: 'j2048' }],
  wm: [{ w: 640, webp: 'm640w', jpeg: 'm640j' }, { w: 1280, webp: 'm1280w', jpeg: 'm1280j' }],
  web: 'j2048', rawPreview: 'raw', poster: 'j640',
  hls: { master: 'v/hls/master.m3u8', rungs: [360, 720], dir: 'v/hls' },
  sprite: { vtt: 's.vtt', image: 's.jpg' },
};
const k = (v: string, who: 'staff' | 'client' | 'guest' = 'client') => keyFor(R, v.split('/'), who);

describe('keyFor', () => {
  it('staff and clients get the clean stills, in every format', () => {
    expect(k('w640.avif')).toBe('a640');
    expect(k('640.webp', 'staff')).toBe('w640');
    expect(k('w2048.jpg')).toBe('j2048');
    expect(k('w2048.avif')).toBeNull(); // no AVIF above the grid widths
    expect(k('web')).toBe('j2048');
    expect(k('raw', 'staff')).toBe('raw');
  });
  it('guests only ever get watermarked copies, never the web copy or the RAW preview', () => {
    expect(k('w640.jpg', 'guest')).toBe('m640j');
    expect(k('w2048.webp', 'guest')).toBe('m1280w'); // capped at the largest watermarked copy
    expect(k('w320.jpg', 'guest')).toBe('m640j');
    expect(k('w640.avif', 'guest')).toBeNull();
    expect(k('web', 'guest')).toBeNull();
    expect(k('raw', 'guest')).toBeNull();
    expect(k('poster', 'guest')).toBe('m1280j');
    expect(k('wm640.webp')).toBe('m640w');
  });
  it('the stream: master, known rungs and their files only', () => {
    expect(k('hls/master.m3u8')).toBe('v/hls/master.m3u8');
    expect(k('hls/720/index.m3u8')).toBe('v/hls/720/index.m3u8');
    expect(k('hls/360/seg_00012.m4s', 'guest')).toBe('v/hls/360/seg_00012.m4s');
    expect(k('hls/360/init.mp4')).toBe('v/hls/360/init.mp4');
    expect(k('hls/1080/index.m3u8')).toBeNull(); // not encoded (yet)
    expect(k('hls/360/master.m3u8')).toBeNull();
    expect(k('hls/../../other/x.m4s')).toBeNull();
    expect(k('hls/360/seg_1.m4s')).toBeNull();
  });
  it('anything else is refused', () => {
    for (const v of ['original', '../x', 'w640.png', 'w99999.jpg', 'sprite.png', '']) expect(k(v, 'staff'), v).toBeNull();
    expect(keyFor({}, ['w640', 'jpg'], 'staff')).toBeNull();
  });
});
