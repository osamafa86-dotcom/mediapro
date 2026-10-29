import { requireStaff } from '@/lib/auth/session';
import { browse } from '@/lib/drive';
import { GoogleError } from '@/lib/google';
import { handle, HttpError, json } from '@/lib/server/http';

/** One level of Drive folders with the suggested client, date and title for each. */
export const GET = handle(async (req: Request) => {
  const staff = await requireStaff(req, ['admin']);
  const parent = new URL(req.url).searchParams.get('parent') || 'root';
  if (!/^[\w-]{1,200}$/.test(parent)) throw new HttpError(400, 'invalid_parent');
  try {
    return json({ folders: await browse(staff, parent) });
  } catch (e) {
    if (e instanceof GoogleError) throw new HttpError(e.status === 401 || e.status === 400 ? 409 : 502, e.status === 401 || e.status === 400 ? 'drive_reconnect' : 'drive_unavailable');
    throw e;
  }
});
