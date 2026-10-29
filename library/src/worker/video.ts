import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProcessingError } from './errors';
import { run } from './run';
import { putBuffer, putFile } from './s3io';

/*
 * Video: H.264 HLS in fMP4/CMAF segments, lowest rung first so playback can start while the rest
 * encodes (DESIGN); SVT-AV1 rungs above 1080p; a WebVTT sprite for scrubbing; a 1080p MP4 download.
 */

export interface Probe { duration: number; width: number; height: number; hasAudio: boolean; rotation: number }

export async function probe(file: string): Promise<Probe> {
  let j: { streams?: { codec_type: string; width?: number; height?: number; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[]; format?: { duration?: string } };
  try {
    j = JSON.parse((await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { timeoutMs: 120_000 })).toString());
  } catch (e) {
    throw new ProcessingError('decode_failed', (e as Error).message);
  }
  const v = j.streams?.find((s) => s.codec_type === 'video');
  if (!v?.width || !v.height) throw new ProcessingError('decode_failed', 'no video stream');
  const rotation = Math.abs(Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0)) % 180;
  const [width, height] = rotation === 90 ? [v.height, v.width] : [v.width, v.height];
  return { duration: Number(j.format?.duration ?? 0), width, height, hasAudio: !!j.streams?.some((s) => s.codec_type === 'audio'), rotation };
}

export async function posterFrame(file: string, p: Probe, out: string) {
  const at = Math.max(0, Math.min(p.duration * 0.1, p.duration - 0.5));
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', at.toFixed(2), '-i', file, '-frames:v', '1', '-q:v', '2', out], { timeoutMs: 5 * 60_000 });
}

export interface Rung { height: number; codec: 'h264' | 'av1'; bandwidth: number; width: number }

/** Rungs for a source: 360/720/1080 H.264 up to the source size; 1440/2160 AV1 above it. The smallest always exists. */
export function plan(p: Probe): { height: number; codec: 'h264' | 'av1' }[] {
  const h264 = [360, 720, 1080].filter((h) => h <= p.height);
  const av1 = [1440, 2160].filter((h) => h <= p.height);
  if (!h264.length) h264.push(p.height - (p.height % 2));
  return [...h264.map((height) => ({ height, codec: 'h264' as const })), ...av1.map((height) => ({ height, codec: 'av1' as const }))];
}

const BITRATE: Record<number, string> = { 360: '800k', 720: '2800k', 1080: '5000k', 1440: '6000k', 2160: '12000k' };

export async function encodeRung(file: string, p: Probe, r: { height: number; codec: 'h264' | 'av1' }, dir: string): Promise<Rung> {
  await mkdir(dir, { recursive: true });
  const v = r.codec === 'h264'
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-crf', '21', '-maxrate', BITRATE[r.height] ?? '5000k', '-bufsize', '10M', '-pix_fmt', 'yuv420p']
    : ['-c:v', 'libsvtav1', '-preset', '8', '-crf', '32', '-pix_fmt', 'yuv420p'];
  const a = p.hasAudio ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : [];
  try {
    await run('ffmpeg', [
      '-v', 'error', '-y', '-i', file, '-map', '0:v:0', ...a,
      '-vf', `scale=-2:${r.height}`, ...v, '-force_key_frames', 'expr:gte(t,n_forced*4)', '-sc_threshold', '0',
      '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
      '-hls_fmp4_init_filename', 'init.mp4', '-hls_segment_filename', join(dir, 'seg_%05d.m4s'), join(dir, 'index.m3u8'),
    ], { timeoutMs: 6 * 3600_000 });
  } catch (e) {
    throw new ProcessingError('transcode_failed', (e as Error).message);
  }
  let bytes = 0;
  for (const f of await readdir(dir)) bytes += (await stat(join(dir, f))).size;
  const width = Math.round((p.width * r.height) / p.height / 2) * 2;
  return { height: r.height, codec: r.codec, width, bandwidth: Math.ceil((bytes * 8) / Math.max(1, p.duration) * 1.1) };
}

/** Uploads a rung directory: playlists and init/segments. */
export async function uploadRung(dir: string, keyDir: string) {
  for (const f of await readdir(dir)) {
    const type = f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : f.endsWith('.mp4') ? 'video/mp4' : 'video/iso.segment';
    await putFile(`${keyDir}/${f}`, join(dir, f), type);
  }
}

export function masterPlaylist(rungs: Rung[], hasAudio: boolean) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
  for (const r of [...rungs].sort((a, b) => a.height - b.height)) {
    const codecs = [r.codec === 'h264' ? 'avc1.640028' : 'av01.0.08M.08', ...(hasAudio ? ['mp4a.40.2'] : [])].join(',');
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="${codecs}"`, `${r.height}/index.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}

export async function putMaster(key: string, rungs: Rung[], hasAudio: boolean) {
  await putBuffer(key, Buffer.from(masterPlaylist(rungs, hasAudio)), 'application/vnd.apple.mpegurl');
}

/** One sprite (10 columns) of up to 100 frames + WebVTT cues with #xywh, for the player's scrub preview. */
export async function sprite(file: string, p: Probe, dir: string, keyDir: string) {
  const every = Math.max(1, p.duration / 100);
  const frames = Math.max(1, Math.min(100, Math.floor(p.duration / every)));
  const tw = 160;
  const th = Math.round((tw * p.height) / p.width / 2) * 2;
  const cols = Math.min(10, frames);
  const rows = Math.ceil(frames / cols);
  const img = join(dir, 'sprite.jpg');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `fps=1/${every.toFixed(3)},scale=${tw}:${th},tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '5', img], { timeoutMs: 3600_000 });
  const cues = ['WEBVTT', ''];
  const t = (s: number) => new Date(s * 1000).toISOString().slice(11, 23);
  for (let i = 0; i < frames; i++) {
    cues.push(`${t(i * every)} --> ${t(Math.min(p.duration, (i + 1) * every))}`, `sprite.jpg#xywh=${(i % cols) * tw},${Math.floor(i / cols) * th},${tw},${th}`, '');
  }
  await writeFile(join(dir, 'sprite.vtt'), cues.join('\n'));
  await putFile(`${keyDir}/sprite.jpg`, img, 'image/jpeg');
  await putFile(`${keyDir}/sprite.vtt`, join(dir, 'sprite.vtt'), 'text/vtt');
  return { vtt: `${keyDir}/sprite.vtt`, image: `${keyDir}/sprite.jpg` };
}

/** Progressive 1080p MP4 for «تنزيل نسخة الويب». */
export async function webMp4(file: string, p: Probe, out: string) {
  const h = Math.min(1080, p.height - (p.height % 2));
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0:v:0', ...(p.hasAudio ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', '160k'] : []),
      '-vf', `scale=-2:${h}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { timeoutMs: 6 * 3600_000 });
  } catch (e) {
    throw new ProcessingError('transcode_failed', (e as Error).message);
  }
}
