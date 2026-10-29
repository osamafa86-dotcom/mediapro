// A stand-in for Google's OAuth and Drive v3 endpoints (only what the importer uses), so the whole Drive
// import runs end to end in CI with no Google account. Folders and files are real bytes from test-results/fixtures.
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 3192);
const FX = join(process.cwd(), 'test-results/fixtures');
const FOLDER = 'application/vnd.google-apps.folder';

// root ─ «2025-03-14 حفل تخرج مؤسسة النور» ─ cam.jpg, wide.jpg, RAW/IMG_0042.DNG, notes (a Google Doc)
//      ─ «İstanbul Ofisi 12.06.2024» ─ clip.mp4
//      ─ «منوعات» (no date, no client)
const tree = [
  { id: 'f-grad', name: '2025-03-14 حفل تخرج مؤسسة النور', mimeType: FOLDER, parent: 'root' },
  { id: 'f-ist', name: 'İstanbul Ofisi 12.06.2024', mimeType: FOLDER, parent: 'root' },
  { id: 'f-misc', name: 'منوعات', mimeType: FOLDER, parent: 'root' },
  { id: 'f-raw', name: 'RAW', mimeType: FOLDER, parent: 'f-grad' },
  { id: 'd-cam', name: 'cam.jpg', mimeType: 'image/jpeg', parent: 'f-grad', file: 'cam.jpg' },
  { id: 'd-wide', name: 'wide.jpg', mimeType: 'image/jpeg', parent: 'f-grad', file: 'wide.jpg' },
  { id: 'd-dng', name: 'IMG_0042.DNG', mimeType: 'image/x-adobe-dng', parent: 'f-raw', file: 'IMG_0042.DNG' },
  { id: 'd-doc', name: 'ملاحظات', mimeType: 'application/vnd.google-apps.document', parent: 'f-grad' },
  { id: 'd-clip', name: 'clip.mp4', mimeType: 'video/mp4', parent: 'f-ist', file: 'clip.mp4' },
  { id: 'd-gone', name: 'broken.jpg', mimeType: 'image/jpeg', parent: 'f-ist', file: 'does-not-exist.jpg' },
];
const meta = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, ...(f.file && existsSync(join(FX, f.file)) ? { size: String(statSync(join(FX, f.file)).size) } : f.file ? { size: '1000' } : {}) });
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const authed = (req) => req.headers.authorization === 'Bearer fake-access-token';

createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (u.pathname === '/health') return json(res, 200, { ok: true });
  // consent screen: the user says yes at once
  if (u.pathname === '/o/oauth2/v2/auth') {
    const back = new URL(u.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'fake-code');
    back.searchParams.set('state', u.searchParams.get('state'));
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (u.pathname === '/token' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = new URLSearchParams(body);
      if (p.get('client_secret') !== 'fake-secret') return json(res, 401, { error: 'invalid_client' });
      if (p.get('grant_type') === 'authorization_code' && p.get('code') === 'fake-code') return json(res, 200, { access_token: 'fake-access-token', refresh_token: 'fake-refresh-token', expires_in: 3599, token_type: 'Bearer' });
      if (p.get('grant_type') === 'refresh_token' && p.get('refresh_token') === 'fake-refresh-token') return json(res, 200, { access_token: 'fake-access-token', expires_in: 3599, token_type: 'Bearer' });
      return json(res, 400, { error: 'invalid_grant' });
    });
    return;
  }
  if (!authed(req)) return json(res, 401, { error: { code: 401, message: 'Invalid Credentials' } });
  if (u.pathname === '/drive/v3/about') return json(res, 200, { user: { emailAddress: 'archive@emdatra.test', displayName: 'Archive' } });
  if (u.pathname === '/drive/v3/files') {
    const q = u.searchParams.get('q') ?? '';
    const parent = /'([^']+)' in parents/.exec(q)?.[1];
    const onlyFolders = q.includes(`mimeType = '${FOLDER}'`) || q.includes(`mimeType='${FOLDER}'`);
    const files = tree.filter((f) => f.parent === parent && (!onlyFolders || f.mimeType === FOLDER)).map(meta);
    return json(res, 200, { files });
  }
  const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
  if (m) {
    const f = tree.find((x) => x.id === m[1]);
    if (!f) return json(res, 404, { error: { code: 404, message: 'File not found' } });
    if (u.searchParams.get('alt') !== 'media') return json(res, 200, meta(f));
    const path = f.file ? join(FX, f.file) : null;
    if (!path || !existsSync(path)) return json(res, 404, { error: { code: 404, message: 'File not found' } });
    res.writeHead(200, { 'content-type': f.mimeType, 'content-length': statSync(path).size });
    return res.end(readFileSync(path));
  }
  json(res, 404, { error: 'unknown' });
}).listen(PORT, '127.0.0.1', () => console.log(`[fake-google] on ${PORT}`));
