import { requireStaff } from '@/lib/auth/session';
import { handle, json, readJson } from '@/lib/server/http';
import { SignInput, signRequest } from '@/lib/uploads';

/** Uppy's signRequest: one presigned URL for UploadPart / ListParts / Complete / Abort on the caller's own upload. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  return json(await signRequest(staff, SignInput.parse(await readJson(req))));
});
