import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';
import { OpenInput, openUpload } from '@/lib/uploads';

/** Open (or re-open, for resume) a multipart upload. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  return json(await openUpload(staff, OpenInput.parse(await readJson(req))));
});
