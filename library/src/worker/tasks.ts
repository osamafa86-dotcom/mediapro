import type { JobHelpers, TaskList } from 'graphile-worker';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSql } from '@/db';
import type { AssetEdit, Renditions } from '@/db/schema';
import { ProcessingError } from './errors';
import { imageRenditions, rawSource, readExif } from './image';
import { download, head, prefix, purge, purgeExcept, putFile } from './s3io';
import { fits, sniff } from './sniff';
import { driveImport } from './drive';
import { encodeRung, plan, posterFrame, probe, putMaster, sprite, uploadRung, webMp4, type Rung } from './video';

interface AssetRow { id: string; r2_key: string; section: 'photos' | 'videos'; group: string; mime: string; renditions: Renditions; status: string }

async function libraryPrefs() {
  const rows = await getSql()<{ key: string; value: Record<string, string> }[]>`select key, value from settings where key in ('region', 'identity')`;
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? {};
  return { timeZone: get('region').timeZone ?? 'Asia/Hebron', watermark: get('identity').nameTr ?? 'EMDATRA' };
}

/**
 * Runs one job for one asset in its own temp dir. A ProcessingError (a reason we can show) fails the
 * asset at once; anything else is retried, and only the last attempt marks the asset failed.
 */
async function guarded(assetId: string, helpers: JobHelpers, onFail: 'asset' | 'note', fn: (a: AssetRow, dir: string) => Promise<void>) {
  const sql = getSql();
  const [a] = await sql<AssetRow[]>`select id, r2_key, section, "group", mime, renditions, status from assets where id = ${assetId}`;
  if (!a) return; // deleted meanwhile
  const dir = await mkdtemp(join(tmpdir(), `asset-${assetId.slice(0, 8)}-`));
  try {
    await fn(a, dir);
  } catch (e) {
    const final = e instanceof ProcessingError || helpers.job.attempts >= helpers.job.max_attempts;
    const msg = (e instanceof ProcessingError ? e.message : `processing_failed: ${(e as Error).message}`).slice(0, 500);
    helpers.logger.error(`asset ${assetId}: ${msg}`);
    if (!final) throw e;
    if (onFail === 'asset') await sql`update assets set status = 'failed', error = ${msg} where id = ${assetId}`;
    else await sql`update assets set error = ${msg} where id = ${assetId}`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const keyPrefix = () => `${prefix()}renditions/`;

export const taskList: TaskList = {
  /**
   * A photo's edit (rotate, crop) from the untouched original into its own folder `<id>/e<v>/`, swapped in with one
   * update — the previous renditions stay on screen until then, and stay if this fails. A newer save supersedes it.
   */
  apply_edit: async (payload, helpers) => {
    const { assetId, v } = payload as { assetId: string; v: number };
    const sql = getSql();
    const [a] = await sql<{ id: string; r2_key: string; edit: AssetEdit | null }[]>`select id, r2_key, edit from assets where id = ${assetId}`;
    if (!a || a.edit?.v !== v) return; // deleted, or a newer save took over
    const dir = await mkdtemp(join(tmpdir(), `edit-${assetId.slice(0, 8)}-`));
    const folder = `${keyPrefix()}${a.id}/e${v}/`;
    try {
      const src = join(dir, 'original');
      await download(a.r2_key, src);
      const prefs = await libraryPrefs();
      const identity = !a.edit.rotate && !a.edit.crop; // a reset: plain renditions, the upload is the original again
      const out = await imageRenditions({ src, id: `${a.id}/e${v}`, keyPrefix: keyPrefix(), watermark: prefs.watermark, edit: identity ? null : a.edit });
      const done = await sql`update assets set renditions = ${JSON.stringify(out.renditions)}::jsonb, width = ${out.width}, height = ${out.height},
          thumbhash = ${out.thumbhash}, edit = jsonb_set(edit, '{state}', '"done"') - 'error'
        where id = ${a.id} and (edit->>'v')::int = ${v} returning id`;
      if (!done.length) { await purge([], [folder]); return; } // superseded while we worked
      helpers.logger.info(`asset ${a.id}: edit v${v} applied, ${await purgeExcept(`${keyPrefix()}${a.id}/`, [folder, `${keyPrefix()}${a.id}/raw-preview.jpg`])} old objects removed`);
    } catch (e) {
      const final = e instanceof ProcessingError || helpers.job.attempts >= helpers.job.max_attempts;
      helpers.logger.error(`asset ${assetId}: edit v${v}: ${(e as Error).message}`);
      if (!final) throw e;
      await purge([], [folder]).catch(() => {});
      await sql`update assets set edit = jsonb_set(jsonb_set(edit, '{state}', '"failed"'), '{error}', to_jsonb(${(e as Error).message.slice(0, 300)}::text))
        where id = ${assetId} and (edit->>'v')::int = ${v}`;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },


  /** Storage of deleted assets (the rows are already gone): originals and renditions folders. */
  purge_objects: async (payload, helpers) => {
    const { keys, prefixes } = payload as { keys: string[]; prefixes: string[] };
    // only our own objects: a payload naming anything outside the prefix is a bug, not a request
    const mine = (k: string) => k.startsWith(prefix()) && !k.includes('..');
    if (![...keys, ...prefixes].every(mine)) throw new Error('purge_objects: key outside the library prefix');
    helpers.logger.info(`purged ${await purge(keys, prefixes)} objects`);
  },

  /** A Drive folder copied into its project; every file then goes through process_asset like an upload. */
  drive_import: driveImport,

  /** Originals → everything the grid, viewer and player need; video becomes playable after its lowest rung. */
  process_asset: async (payload, helpers) => {
    const { assetId } = payload as { assetId: string };
    await guarded(assetId, helpers, 'asset', async (a, dir) => {
      const sql = getSql();
      const kind = sniff(await head(a.r2_key).catch(() => { throw new ProcessingError('source_missing'); }));
      if (!fits(kind, a.section, a.group)) throw new ProcessingError('type_mismatch', kind);
      const src = join(dir, 'original');
      await download(a.r2_key, src);
      const prefs = await libraryPrefs();

      if (a.section === 'photos') {
        const exif = await readExif(src, prefs.timeZone);
        let input = src;
        let rotate: number | null = null;
        const r: Partial<Renditions> = {};
        if (a.group === 'raw') {
          const rs = await rawSource(src, dir);
          input = rs.path;
          if (rs.embedded) {
            rotate = exif.orientation;
            r.rawPreview = `${keyPrefix()}${a.id}/raw-preview.jpg`;
            await putFile(r.rawPreview, rs.path, 'image/jpeg');
          }
        }
        const out = await imageRenditions({ src: input, id: a.id, keyPrefix: keyPrefix(), watermark: prefs.watermark, rotateFromExif: rotate });
        await sql`update assets set status = 'ready', error = null, width = ${out.width}, height = ${out.height},
          taken_at = ${exif.takenAt?.toISOString() ?? null}, capture_source = ${exif.captureSource}, thumbhash = ${out.thumbhash},
          renditions = ${JSON.stringify({ ...r, ...out.renditions })}::jsonb where id = ${a.id}`;
        return;
      }

      // video: poster + lowest rung first → playable; the rest in video_more
      const p = await probe(src);
      const exif = await readExif(src, prefs.timeZone);
      const poster = join(dir, 'poster.jpg');
      await posterFrame(src, p, poster);
      const img = await imageRenditions({ src: poster, id: a.id, keyPrefix: keyPrefix(), watermark: prefs.watermark, maxWidths: [320, 640, 1280] });
      const rungs = plan(p);
      const dirKey = `${keyPrefix()}${a.id}/hls`;
      const first = await encodeRung(src, p, rungs[0]!, join(dir, String(rungs[0]!.height)));
      await uploadRung(join(dir, String(first.height)), `${dirKey}/${first.height}`);
      await putMaster(`${dirKey}/master.m3u8`, [first], p.hasAudio);
      const renditions: Renditions = {
        ...img.renditions, poster: img.renditions.images?.at(-1)?.jpeg,
        hls: { master: `${dirKey}/master.m3u8`, rungs: [first.height], dir: dirKey, meta: [first], audio: p.hasAudio },
      };
      await sql`update assets set status = 'ready', error = null, width = ${p.width}, height = ${p.height}, duration = ${p.duration},
        taken_at = ${exif.takenAt?.toISOString() ?? null}, capture_source = ${exif.captureSource}, thumbhash = ${img.thumbhash},
        renditions = ${JSON.stringify(renditions)}::jsonb where id = ${a.id}`;
      await helpers.addJob('video_more', { assetId: a.id }, { jobKey: `more:${a.id}`, priority: 10, maxAttempts: 2 });
    });
  },

  /** Higher rungs (master updated after each), the scrub sprite, and the 1080p download copy. */
  video_more: async (payload, helpers) => {
    const { assetId } = payload as { assetId: string };
    await guarded(assetId, helpers, 'note', async (a, dir) => {
      const sql = getSql();
      const src = join(dir, 'original');
      await download(a.r2_key, src);
      const p = await probe(src);
      const hls = a.renditions.hls;
      if (!hls?.dir) return;
      const done: Rung[] = [...(hls.meta ?? [])];
      for (const r of plan(p).filter((x) => !done.some((d) => d.height === x.height))) {
        const rung = await encodeRung(src, p, r, join(dir, String(r.height)));
        await uploadRung(join(dir, String(r.height)), `${hls.dir}/${r.height}`);
        done.push(rung);
        await putMaster(hls.master, done, p.hasAudio);
        await sql`update assets set renditions = jsonb_set(renditions, '{hls}', ${JSON.stringify({ ...hls, rungs: done.map((d) => d.height), meta: done })}::jsonb) where id = ${a.id}`;
      }
      const sp = await sprite(src, p, dir, hls.dir.replace(/\/hls$/, ''));
      const mp4 = join(dir, 'web-1080.mp4');
      await webMp4(src, p, mp4);
      const mp4Key = `${keyPrefix()}${a.id}/web-1080.mp4`;
      await putFile(mp4Key, mp4, 'video/mp4');
      await sql`update assets set renditions = renditions || ${JSON.stringify({ sprite: sp, mp4_1080: mp4Key })}::jsonb where id = ${a.id}`;
    });
  },
};
