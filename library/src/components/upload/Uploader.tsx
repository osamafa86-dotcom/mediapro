'use client';
import AwsS3 from '@uppy/aws-s3';
import Uppy, { type UppyFile } from '@uppy/core';
import { CircleCheck, Film, FolderOpen, Image as ImageIcon, Pause, Play, RotateCcw, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { postJson } from '@/lib/client/api';
import { formatBytes, formatPct } from '@/lib/format';
import { ACCEPT, classify, MAX_FILE_BYTES, partSizeFor } from '@/lib/upload-rules';
import type { Locale } from '@/i18n/config';
import s from './upload.module.css';

type Meta = { rowId?: string; resumed?: boolean };
type Body = Record<string, never>;
type Row = {
  id: string; name: string; size: number; uploaded: number; pct: number; state: 'queued' | 'uploading' | 'paused' | 'offline' | 'verifying' | 'done' | 'failed';
  reason?: string; speed: number; eta: number | null; preview?: string; video: boolean; resumed?: boolean;
};

/**
 * Direct multipart upload to R2 with Uppy 6 (Figma 41:2). The server opens each upload and hands back
 * (key, uploadId); putting that on the file as `s3Multipart` makes Uppy list the parts already in R2
 * and send only the missing ones — that is the resume, after a dropped connection or a closed tab.
 */
export function Uploader({ projectId, counts, unfinished }: {
  projectId: string; counts: { photos: number; videos: number }; unfinished: { id: string; filename: string; size: number }[];
}) {
  const t = useTranslations('upload');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [section, setSection] = useState<'photos' | 'videos'>('photos');
  const [group, setGroup] = useState<'final' | 'footage'>('final');
  const groupRef = useRef(group); groupRef.current = group;
  const [rows, setRows] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [left, setLeft] = useState(unfinished);
  const [allPaused, setAllPaused] = useState(false);
  const samples = useRef(new Map<string, { at: number; bytes: number; speed: number }>());
  const extra = useRef(new Map<string, Partial<Row>>());
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const uppy = useMemo(() => {
    const u = new Uppy<Meta, Body>({ autoProceed: false, restrictions: { maxFileSize: MAX_FILE_BYTES } });
    u.use(AwsS3<Meta, Body>, {
      shouldUseMultipart: true,
      getChunkSize: ({ size }) => partSizeFor(size), // the server splits the same way (lib/upload-rules)
      limit: 3,
      signRequest: async (req) => {
        const r = await postJson<{ url?: string; error?: string }>('/api/uploads/sign', req);
        if (!r.ok || !r.data.url) throw new Error(r.status === 0 ? 'network' : r.data.error ?? 'server');
        return { url: r.data.url };
      },
    });
    return u;
  }, []);

  // Uppy state → rows (with a measured speed per file)
  useEffect(() => {
    const sync = () => {
      const now = Date.now();
      const files = uppy.getFiles();
      setRows(files.map((f) => {
        const p = f.progress;
        const done = p.bytesUploaded || 0;
        const total = f.size ?? 0;
        const smp = samples.current.get(f.id);
        let speed = smp?.speed ?? 0;
        if (smp && now - smp.at >= 700) { speed = Math.max(0, (done - smp.bytes) / ((now - smp.at) / 1000)); samples.current.set(f.id, { at: now, bytes: done, speed }); }
        else if (!smp) samples.current.set(f.id, { at: now, bytes: done, speed: 0 });
        const x = extra.current.get(f.id) ?? {};
        const state: Row['state'] = x.state === 'done' || x.state === 'failed' || x.state === 'verifying' ? x.state
          : !navigator.onLine && !p.uploadComplete ? 'offline' // dropped connection: progress is kept, it resumes on its own
          : f.error ? 'failed' : f.isPaused ? 'paused' : p.uploadStarted ? 'uploading' : 'queued';
        return {
          id: f.id, name: f.name ?? '', size: total, uploaded: done, pct: total ? Math.floor((done / total) * 100) : 0, state,
          reason: x.reason ?? (f.error ? String(f.error) : undefined), speed, eta: speed > 0 ? (total - done) / speed : null,
          preview: x.preview, video: classify(f.name ?? '')?.section === 'videos', resumed: f.meta.resumed,
        };
      }));
    };
    uppy.on('state-update', sync);
    const tick = setInterval(sync, 1000);
    const onSuccess = async (file: UppyFile<Meta, Body> | undefined) => {
      if (!file?.meta.rowId) return;
      extra.current.set(file.id, { ...extra.current.get(file.id), state: 'verifying' }); sync();
      const r = await postJson<{ error?: string }>(`/api/uploads/${file.meta.rowId}/complete`, {});
      extra.current.set(file.id, { ...extra.current.get(file.id), state: r.ok ? 'done' : 'failed', reason: r.ok ? undefined : r.data.error ?? 'server' });
      sync();
      if (r.ok) router.refresh();
    };
    uppy.on('upload-success', onSuccess);
    const online = () => { sync(); uppy.retryAll().catch(() => {}); };
    window.addEventListener('online', online);
    window.addEventListener('offline', sync);
    return () => {
      uppy.off('state-update', sync); uppy.off('upload-success', onSuccess); clearInterval(tick);
      window.removeEventListener('online', online); window.removeEventListener('offline', sync);
    };
  }, [uppy, router]);

  useEffect(() => () => { uppy.cancelAll(); uppy.destroy(); }, [uppy]);

  /** name|size|mtime|SHA-256 of the first and last MiB: the same file on another visit, cheaply. */
  async function fingerprint(f: File) {
    const head = await f.slice(0, 1 << 20).arrayBuffer();
    const tail = await f.slice(Math.max(0, f.size - (1 << 20))).arrayBuffer();
    const buf = new Uint8Array(head.byteLength + tail.byteLength);
    buf.set(new Uint8Array(head)); buf.set(new Uint8Array(tail), head.byteLength);
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('');
    return `${f.name}|${f.size}|${f.lastModified}|${h}`;
  }

  async function add(files: File[]) {
    const bad: { name: string; reason: string }[] = [];
    const ids: string[] = [];
    for (const f of files) {
      if (!classify(f.name)) { bad.push({ name: f.name, reason: t('err.unsupported_type') }); continue; }
      if (f.size > MAX_FILE_BYTES) { bad.push({ name: f.name, reason: t('err.too_large') }); continue; }
      let id: string;
      try { id = uppy.addFile({ name: f.name, type: f.type, data: f, source: 'local' }); } catch { continue; } // duplicate in this queue
      const r = await postJson<{ id?: string; key?: string; uploadId?: string; resumed?: boolean; error?: string }>('/api/uploads', {
        projectId, filename: f.name, size: f.size, mime: f.type || 'application/octet-stream', fingerprint: await fingerprint(f), lastModified: f.lastModified, group: groupRef.current,
      });
      if (!r.ok || !r.data.key || !r.data.uploadId) {
        uppy.removeFile(id);
        bad.push({ name: f.name, reason: t(`err.${(['unsupported_type', 'forbidden'] as const).find((e) => e === r.data.error) ?? 'server'}`) });
        continue;
      }
      // the server's (key, uploadId): Uppy resumes from ListParts instead of starting a new multipart upload
      uppy.setFileState(id, { s3Multipart: { uploadId: r.data.uploadId, key: r.data.key } } as never);
      uppy.setFileMeta(id, { rowId: r.data.id, resumed: r.data.resumed });
      if (f.type.startsWith('image/') && f.size < 30 * 1024 * 1024) extra.current.set(id, { preview: URL.createObjectURL(f) });
      if (r.data.resumed) setLeft((l) => l.filter((u) => u.id !== r.data.id));
      ids.push(id);
    }
    setRejected((x) => [...bad, ...x].slice(0, 20));
    if (ids.length) uppy.upload().catch(() => {});
  }

  async function fromDrop(e: React.DragEvent) {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items ?? []);
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
    if (!entries.length) { void add(Array.from(e.dataTransfer.files)); return; }
    const out: File[] = [];
    const walk = async (en: FileSystemEntry): Promise<void> => {
      if (en.isFile) out.push(await new Promise<File>((res, rej) => (en as FileSystemFileEntry).file(res, rej)));
      else if (en.isDirectory) {
        const reader = (en as FileSystemDirectoryEntry).createReader();
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          for (const b of batch) await walk(b);
        }
      }
    };
    for (const en of entries) await walk(en);
    void add(out);
  }

  const totalBytes = rows.reduce((a, r) => a + r.size, 0);
  const speed = rows.filter((r) => r.state === 'uploading').reduce((a, r) => a + r.speed, 0);
  const fb = (n: number) => formatBytes(n, locale);
  const eta = (sec: number | null) => (sec === null ? '—' : sec < 90 ? t('eta.s', { n: Math.ceil(sec) }) : sec < 5400 ? t('eta.m', { n: Math.ceil(sec / 60) }) : t('eta.h', { n: Math.round(sec / 3600) }));
  const active = rows.some((r) => ['uploading', 'paused', 'offline', 'queued'].includes(r.state));

  return (
    <div className={s.uploader} data-testid="uploader">
      <div className={s.target}>
        <span className={s.targetLabel}>{t('target')}</span>
        <div className={s.segmented} role="tablist" aria-label={t('target')}>
          {(['photos', 'videos'] as const).map((sec) => (
            <button key={sec} type="button" role="tab" aria-selected={section === sec} onClick={() => setSection(sec)}>
              {sec === 'photos' ? <ImageIcon size={16} aria-hidden /> : <Film size={16} aria-hidden />}{t(sec)}<span className={s.count}>{counts[sec]}</span>
            </button>
          ))}
        </div>
        {section === 'videos' ? (
          <div className={s.chips} role="radiogroup" aria-label={t('target')}>
            {(['final', 'footage'] as const).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={group === g} className={s.chip} onClick={() => setGroup(g)}>{t(g)}</button>
            ))}
          </div>
        ) : <span className={s.note}>{t('rawNote')}</span>}
      </div>

      <div className={s.drop} onDragOver={(e) => e.preventDefault()} onDrop={(e) => void fromDrop(e)} data-testid="dropzone">
        <span className={s.dropIcon} aria-hidden><Upload size={24} /></span>
        <h2>{t('dropTitle')}</h2>
        <p>{t('dropBody')}</p>
        <div className={s.dropActions}>
          <Button variant="primary" icon={<Upload size={16} />} onPress={() => fileInput.current?.click()}>{t('chooseFiles')}</Button>
          <Button variant="secondary" icon={<FolderOpen size={16} />} onPress={() => folderInput.current?.click()}>{t('chooseFolder')}</Button>
        </div>
        <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden data-testid="file-input"
          onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: '' }}
          onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>

      {left.length ? (
        <div className={s.unfinished} role="note" data-testid="unfinished">
          <strong>{t('unfinishedTitle')}</strong>
          <p>{t('unfinishedBody')}</p>
          <ul>{left.map((u) => <li key={u.id}><bdi dir="ltr">{u.filename}</bdi> · <bdi dir="ltr">{fb(u.size)}</bdi></li>)}</ul>
        </div>
      ) : null}

      {rejected.length ? (
        <ul className={s.rejected} role="alert">{rejected.map((r, i) => <li key={i}><bdi dir="ltr">{r.name}</bdi> — {r.reason}</li>)}</ul>
      ) : null}

      {rows.length ? (
        <section aria-labelledby="h-queue" className={s.queue}>
          <div className={s.queueHead}>
            <div>
              <h2 id="h-queue">{t('queue')}</h2>
              <p>{t('queueMeta', { n: rows.length, size: fb(totalBytes), speed: `${fb(speed)}/s` })}</p>
            </div>
            {active ? (
              <Button variant="ghost" icon={allPaused ? <Play size={16} /> : <Pause size={16} />}
                onPress={() => { if (allPaused) uppy.resumeAll(); else uppy.pauseAll(); setAllPaused(!allPaused); }}>
                {allPaused ? t('resumeAll') : t('pauseAll')}
              </Button>
            ) : null}
          </div>
          <ul className={s.items}>
            {rows.map((r) => (
              <li key={r.id} className={s.item} data-state={r.state} data-testid="queue-item">
                <span className={s.thumb} aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  {r.preview ? <img src={r.preview} alt="" /> : r.video ? <Film size={18} /> : <ImageIcon size={18} />}
                </span>
                <span className={s.itemBody}>
                  <span className={s.fileName} dir="ltr">{r.name}</span>
                  <span className={s.bar}><span style={{ inlineSize: `${r.state === 'done' ? 100 : r.pct}%` }} /></span>
                  <span className={s.status} aria-live="polite">
                    {r.state === 'done' ? t('done', { size: fb(r.size) })
                      : r.state === 'verifying' ? t('verifying')
                      : r.state === 'paused' ? t('paused', { pct: formatPct(r.pct, locale) })
                      : r.state === 'offline' ? t('offline', { pct: formatPct(r.pct, locale) })
                      : r.state === 'failed' ? t('failed', { reason: t(`err.${(['size_mismatch', 'unsupported_type', 'forbidden', 'network'] as const).find((e) => r.reason?.includes(e)) ?? 'server'}`) })
                      : r.state === 'queued' ? t('queued')
                      : `${t('progress', { pct: formatPct(r.pct, locale), speed: `${fb(r.speed)}/s`, eta: eta(r.eta) })}${r.resumed ? ` · ${t('resumed')}` : ''}`}
                  </span>
                </span>
                <span className={s.itemAction}>
                  {r.state === 'done' ? <CircleCheck size={20} className={s.ok} aria-hidden />
                    : r.state === 'failed' || r.state === 'offline' ? (
                      <button type="button" className={s.iconBtn} aria-label={`${t('retry')}: ${r.name}`} onClick={() => { uppy.retryUpload(r.id).catch(() => {}); }}><RotateCcw size={18} /></button>
                    ) : r.state === 'uploading' || r.state === 'paused' ? (
                      <button type="button" className={s.iconBtn} aria-label={`${r.state === 'paused' ? t('resume') : t('pause')}: ${r.name}`} onClick={() => uppy.pauseResume(r.id)}>
                        {r.state === 'paused' ? <Play size={18} /> : <Pause size={18} />}
                      </button>
                    ) : (
                      <button type="button" className={s.iconBtn} aria-label={`${t('remove')}: ${r.name}`} onClick={() => uppy.removeFile(r.id)}><X size={18} /></button>
                    )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
