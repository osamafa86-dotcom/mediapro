'use client';
import { postJson } from './api';

/**
 * One file through the same M3 path as the uploader (server opens the multipart upload, the browser PUTs
 * the parts to signed URLs, the server checks the real size). Used for «رفع نسخة معدّلة».
 */
export async function uploadOne(file: File, opts: { projectId: string; replaces?: string }, onProgress?: (pct: number) => void) {
  const open = await postJson<{ id: string; key: string; uploadId: string; partSize: number; error?: string }>('/api/uploads', {
    projectId: opts.projectId, filename: file.name, size: file.size, mime: file.type || 'application/octet-stream',
    fingerprint: `one:${opts.replaces ?? ''}:${file.name}:${file.size}:${file.lastModified}`, replaces: opts.replaces,
  });
  if (!open.ok) throw new Error(open.data.error ?? `open_${open.status}`);
  const u = open.data;
  const sign = async (body: Record<string, unknown>) => {
    const r = await postJson<{ url?: string }>('/api/uploads/sign', { key: u.key, uploadId: u.uploadId, ...body });
    if (!r.ok || !r.data.url) throw new Error(`sign_${r.status}`);
    return r.data.url;
  };
  const parts: { n: number; etag: string }[] = [];
  const count = Math.max(1, Math.ceil(file.size / u.partSize));
  for (let n = 1; n <= count; n++) {
    const r = await fetch(await sign({ method: 'PUT', partNumber: n }), { method: 'PUT', body: file.slice((n - 1) * u.partSize, n * u.partSize) });
    const etag = r.headers.get('etag');
    if (!r.ok || !etag) throw new Error('part_failed');
    parts.push({ n, etag });
    onProgress?.(Math.round((n / count) * 100));
  }
  const xml = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
  const c = await fetch(await sign({ method: 'POST' }), { method: 'POST', body: xml });
  if (!c.ok) throw new Error('complete_failed');
  const done = await postJson<{ assetId?: string; error?: string }>(`/api/uploads/${u.id}/complete`, {});
  if (!done.ok) throw new Error(done.data.error ?? 'finish_failed');
  return done.data.assetId!;
}
