import { requireStaff } from '@/lib/auth/session';
import { audit } from '@/lib/server/audit';
import { handle, HttpError, json, readJson } from '@/lib/server/http';
import { saveSetting, schemas, type SettingKey } from '@/lib/settings';

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const staff = await requireStaff(req, ['admin']);
  const { key } = await ctx.params;
  if (!(key in schemas)) throw new HttpError(404, 'not_found');
  const value = await saveSetting(key as SettingKey, await readJson(req));
  await audit('user', staff.id, 'settings.updated', { type: 'settings', id: key });
  return json({ value });
});
