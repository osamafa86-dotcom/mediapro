'use client';

/** The CSRF cookie this area uses (staff or viewer), with or without the __Host- prefix. */
function readCookie(base: string): string {
  for (const part of document.cookie.split('; ')) {
    const [k, ...v] = part.split('=');
    if (k === `__Host-ml_${base}` || k === `ml_${base}`) return decodeURIComponent(v.join('='));
  }
  return '';
}

export interface ApiResult<T> { ok: boolean; status: number; data: T }

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, csrf: 'csrf' | 'vcsrf' | null = 'csrf'): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf) headers['x-csrf-token'] = readCookie(csrf);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'same-origin' });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

/** mm:ss until `until`, never negative. */
export function mmss(until: Date, now = Date.now()) {
  const s = Math.max(0, Math.ceil((until.getTime() - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
