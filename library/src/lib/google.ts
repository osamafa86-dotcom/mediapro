/*
 * Google OAuth + Drive v3, only what the importer needs. Shared by the app (connect, browse) and the
 * worker (download) — so no server-only import here. Endpoints can be pointed elsewhere for tests.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER = 'application/vnd.google-apps.folder';

const authBase = () => process.env.GOOGLE_AUTH_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';
const driveBase = () => process.env.GOOGLE_DRIVE_API ?? 'https://www.googleapis.com/drive/v3';

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export class GoogleError extends Error {
  constructor(public status: number, public reason: string) { super(`google ${status}: ${reason}`); }
}

export function authUrl(state: string, redirectUri: string) {
  const u = new URL(authBase());
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: 'code', scope: DRIVE_SCOPE,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  }).toString();
  return u.toString();
}

async function token(params: Record<string, string>) {
  const r = await fetch(tokenUrl(), {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
  if (!r.ok || !j.access_token) throw new GoogleError(r.status, j.error ?? 'token_failed');
  return j;
}

export const exchangeCode = (code: string, redirectUri: string) => token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
export const accessToken = async (refreshToken: string) => (await token({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token!;

async function drive<T>(access: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const u = new URL(`${driveBase()}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { authorization: `Bearer ${access}` } });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new GoogleError(r.status, j.error?.message ?? r.statusText);
  }
  return (await r.json()) as T;
}

export interface DriveItem { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }

export async function whoAmI(access: string) {
  return (await drive<{ user?: { emailAddress?: string } }>(access, '/about', { fields: 'user(emailAddress)' })).user?.emailAddress ?? null;
}

/** Children of a folder (all pages). Folders only when asked. Shared drives included. */
export async function children(access: string, folderId: string, onlyFolders = false): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken: string | undefined;
  const safe = folderId.replace(/'/g, "\\'");
  do {
    const r = await drive<{ files: DriveItem[]; nextPageToken?: string }>(access, '/files', {
      q: `'${safe}' in parents and trashed = false${onlyFolders ? ` and mimeType = '${FOLDER}'` : ''}`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)', pageSize: '1000', orderBy: 'name',
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...r.files);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

/** Every file under a folder, with the sub-folder path it sits in («RAW», «فيديو/رشزات»…). Depth-limited. */
export async function walk(access: string, folderId: string, path: string[] = [], depth = 0): Promise<(DriveItem & { path: string[] })[]> {
  const items = await children(access, folderId);
  const files: (DriveItem & { path: string[] })[] = [];
  for (const it of items) {
    if (it.mimeType === FOLDER) {
      if (depth < 6) files.push(...(await walk(access, it.id, [...path, it.name], depth + 1)));
    } else files.push({ ...it, path });
  }
  return files;
}

/** The file's bytes as a stream (never buffered whole). */
export async function download(access: string, fileId: string): Promise<Response> {
  const r = await fetch(`${driveBase()}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${access}` } });
  if (!r.ok || !r.body) {
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new GoogleError(r.status, j.error?.message ?? r.statusText);
  }
  return r;
}

export const isGoogleNative = (mime: string) => mime.startsWith('application/vnd.google-apps.');
export const DRIVE_FOLDER = FOLDER;
