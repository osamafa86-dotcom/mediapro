import { PresetInput, removePreset } from '@/lib/admin/mutations';
import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';

/** POST {kind, value}: removes that saved choice from the project form's list (projects keep their names). */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  await removePreset(staff, PresetInput.parse(await readJson(req)));
  return json({ ok: true });
});
