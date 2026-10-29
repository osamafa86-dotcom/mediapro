import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { env } from '../env';

export class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

/** Route-handler wrapper: HttpError → its status, ZodError → 400, anything else → 500 without internals. */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
      if (e instanceof ZodError) return json({ error: 'invalid_input' }, 400);
      console.error('[api]', e instanceof Error ? e.message.split('\n')[0] : 'unknown error');
      return json({ error: 'server_error' }, 500);
    }
  };
}

/**
 * Every write must come from our own pages. Browsers always send Origin on POST/PUT/PATCH/DELETE;
 * a missing or foreign Origin is refused (login CSRF included — there is no session yet to bind to).
 */
export function requireSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(env.appOrigin).origin) throw new HttpError(403, 'bad_origin');
}

export function clientIp(req: Request): string {
  // Caddy is the only hop in front of the app and overwrites X-Forwarded-For with the peer address.
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
}

export async function readJson(req: Request): Promise<unknown> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new HttpError(415, 'json_required');
  try { return await req.json(); } catch { throw new HttpError(400, 'invalid_json'); }
}
