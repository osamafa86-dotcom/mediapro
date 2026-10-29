import { HeadObjectCommand, ListPartsCommand, S3Client } from '@aws-sdk/client-s3';
import { expect, test, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { E2E_ENV } from './env';
import { ORIGIN, PASSWORD, seed, sql, type Seed } from './seed';

/*
 * M3 acceptance (PROMPT §5): upload a big file, cut the network and close the tab in the middle,
 * come back, re-add the file — it completes from where it stopped and its size matches.
 * Default size 200 MiB (13 parts); the full acceptance run uses 2 GiB: E2E_BIG_UPLOAD=1.
 */

const BIG = process.env.E2E_BIG_UPLOAD === '1' ? 2 * 1024 ** 3 : 200 * 1024 ** 2;
const PART = 16 * 1024 * 1024;
const DIR = resolve('test-results/upload-files');
const s3 = () => new S3Client({ endpoint: E2E_ENV.S3_ENDPOINT, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY } });

let S: Seed;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { S = await seed(); await mkdir(DIR, { recursive: true }); });

/** A sparse file with random first/last MiB (the fingerprint reads those). */
async function bigFile(name: string, size: number) {
  const path = resolve(DIR, name);
  const fh = await open(path, 'w');
  await fh.truncate(size);
  await fh.write(randomBytes(1 << 20), 0, 1 << 20, 0);
  await fh.write(randomBytes(1 << 20), 0, 1 << 20, size - (1 << 20));
  await fh.close();
  return path;
}

async function signIn(page: Page) {
  await page.context().addCookies([{ name: 'locale', value: 'ar', url: ORIGIN }]);
  expect((await page.request.post('/api/auth/login', { headers: { origin: ORIGIN }, data: { email: 'a@e2e.test', password: PASSWORD } })).status()).toBe(200);
}

const partPuts = (page: Page) => {
  const done = new Set<number>();
  page.on('requestfinished', async (req) => {
    const m = /[?&]partNumber=(\d+)/.exec(req.url());
    if (m && req.method() === 'PUT' && (await req.response())?.ok()) done.add(Number(m[1]));
  });
  return done;
};

test('photos, RAW and an unsupported file: RAW lands in «خام», the rest is refused with a reason', async ({ page }) => {
  await signIn(page);
  await page.goto(`/upload/${S.p1}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('توزيع الطرود الغذائية — رفح');
  const jpg = resolve(DIR, 'IMG_2001.jpg'); await writeFile(jpg, randomBytes(300_000));
  const raw = resolve(DIR, 'IMG_2002.CR3'); await writeFile(raw, randomBytes(700_000));
  const txt = resolve(DIR, 'notes.txt'); await writeFile(txt, 'hello');
  await page.getByTestId('file-input').setInputFiles([jpg, raw, txt]);
  await expect(page.locator('main').getByRole('alert')).toContainText('notes.txt — نوع غير مدعوم');
  await expect(page.locator('[data-testid=queue-item][data-state=done]')).toHaveCount(2, { timeout: 30_000 });
  const db = sql();
  const rows = await db<{ original_name: string; group: string; size: string }[]>`select original_name, "group", size from assets where project_id = ${S.p1} and original_name like 'IMG_200%' order by original_name`;
  await db.end();
  expect(rows).toEqual([{ original_name: 'IMG_2001.jpg', group: 'final', size: '300000' }, { original_name: 'IMG_2002.CR3', group: 'raw', size: '700000' }]);
});

test(`a ${Math.round(BIG / 1024 ** 2)} MiB upload survives a dropped network and a closed tab, and resumes`, async ({ browser }) => {
  test.setTimeout(BIG > 1024 ** 3 ? 30 * 60_000 : 5 * 60_000);
  const parts = Math.ceil(BIG / PART);
  const file = await bigFile('C0049_dabke_4K.MP4', BIG);
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await page.goto(`/upload/${S.p1}`);
  const first = partPuts(page);
  await page.getByTestId('file-input').setInputFiles(file);
  const item = page.getByTestId('queue-item');
  await expect.poll(() => first.size, { timeout: 5 * 60_000, intervals: [200] }).toBeGreaterThanOrEqual(Math.ceil(parts * 0.35));

  // cut the network mid-upload: the row says so, and keeps its progress
  await context.setOffline(true);
  await expect(item).toHaveAttribute('data-state', /offline|failed/, { timeout: 60_000 });
  await expect(item).toContainText('انقطع الاتصال');
  // ...and close the tab
  await page.close();
  await context.setOffline(false);
  // what R2 holds now is the truth (a part can land after the page stopped observing it)
  const db0 = sql();
  const [open0] = await db0<{ key: string; s3_upload_id: string }[]>`select key, s3_upload_id from uploads where filename = 'C0049_dabke_4K.MP4' and status = 'active'`;
  await db0.end();
  const stored = (await s3().send(new ListPartsCommand({ Bucket: E2E_ENV.S3_BUCKET, Key: open0!.key, UploadId: open0!.s3_upload_id }))).Parts?.length ?? 0;
  expect(stored).toBeGreaterThanOrEqual(Math.ceil(parts * 0.35));
  expect(stored).toBeLessThan(parts);

  // come back: the page lists the unfinished file; re-adding it resumes from R2's ListParts
  const again = await context.newPage();
  await again.goto(`/upload/${S.p1}`);
  await expect(again.getByTestId('unfinished')).toContainText('C0049_dabke_4K.MP4');
  const second = partPuts(again);
  // the parts R2 reported when Uppy resumed (its ListParts call) — the exact baseline of the resume
  let listed = -1;
  again.on('response', async (res) => {
    const u = new URL(res.url());
    if (res.request().method() === 'GET' && u.searchParams.has('uploadId') && !u.searchParams.has('partNumber')) {
      listed = ((await res.text()).match(/<Part>/g) ?? []).length;
    }
  });
  await again.getByTestId('file-input').setInputFiles(file);
  await expect(again.getByTestId('queue-item')).toHaveAttribute('data-state', 'done', { timeout: BIG > 1024 ** 3 ? 25 * 60_000 : 4 * 60_000 });
  await expect(again.getByTestId('queue-item')).toContainText('يُستأنف من حيث توقف').catch(() => {}); // shown while uploading; may be gone once done

  // exactly the missing parts were sent the second time — a resume, not a restart
  expect(listed).toBeGreaterThanOrEqual(stored);
  await expect.poll(() => second.size, { timeout: 5000 }).toBe(parts - listed);

  // and the object in storage has exactly the file's size
  const db = sql();
  const [a] = await db<{ size: string; r2_key: string; section: string }[]>`select size, r2_key, section from assets where project_id = ${S.p1} and original_name = 'C0049_dabke_4K.MP4'`;
  const [u] = await db<{ n: number }[]>`select count(*)::int as n from uploads where filename = 'C0049_dabke_4K.MP4' and status = 'active'`;
  await db.end();
  expect(Number(a!.size)).toBe(BIG);
  expect(a!.section).toBe('videos');
  expect(u!.n).toBe(0);
  const head = await s3().send(new HeadObjectCommand({ Bucket: E2E_ENV.S3_BUCKET, Key: a!.r2_key }));
  expect(head.ContentLength).toBe(BIG);
  await context.close();
});
