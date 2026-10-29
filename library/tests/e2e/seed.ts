import { hash } from '@node-rs/argon2';
import postgres from 'postgres';
import { E2E_ENV } from './env';

export const ORIGIN = E2E_ENV.APP_ORIGIN;
export const PASSWORD = 'correct horse battery staple';

export interface Seed {
  admin: string; photoA: string; photoB: string; lockUser: string; disabled: string;
  clientX: string; clientY: string;
  p1: string; p2: string; p3: string; draft: string; expired: string;
  assetFinal: string; assetRaw: string; assetP2: string;
}

export const sql = () => postgres(E2E_ENV.DATABASE_URL, { max: 2, onnotice: () => {} });

/**
 * A small world with every boundary M1 must hold:
 *   client X: P1 (photographer A), P2 (photographer B), a draft, an expired project
 *   client Y: P3
 */
export async function seed(): Promise<Seed> {
  const db = sql();
  try {
    await db`truncate users, clients, projects, links, sessions, viewer_sessions, magic_links, login_throttle, renewal_requests, audit_log, assets restart identity cascade`;
    const pw = await hash(PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = async (name: string, email: string, role: string, disabled = false) =>
      (await db<{ id: string }[]>`insert into users (name, email, role, password_hash, disabled_at) values (${name}, ${email}, ${role}, ${pw}, ${disabled ? new Date() : null}) returning id`)[0]!.id;
    const admin = await user('سامي ع.', 'admin@e2e.test', 'admin');
    const photoA = await user('مصوّر أ', 'a@e2e.test', 'photographer');
    const photoB = await user('مصوّر ب', 'b@e2e.test', 'photographer');
    const lockUser = await user('مقفل', 'lock@e2e.test', 'photographer');
    const disabled = await user('معطّل', 'off@e2e.test', 'photographer', true);
    const client = async (ar: string, tr: string) =>
      (await db<{ id: string }[]>`insert into clients (name_ar, name_tr) values (${ar}, ${tr}) returning id`)[0]!.id;
    const clientX = await client('مؤسسة النور للتنمية', 'Nur Kalkınma Vakfı');
    const clientY = await client('جمعية أخرى', 'Başka Dernek');
    const project = async (cid: string, title: string, status: string, expires: Date | null = null) =>
      (await db<{ id: string }[]>`insert into projects (client_id, title, status, expires_at, published_at) values (${cid}, ${title}, ${status}, ${expires}, ${status === 'published' ? new Date() : null}) returning id`)[0]!.id;
    const p1 = await project(clientX, 'توزيع الطرود الغذائية — رفح', 'published');
    const p2 = await project(clientX, 'حفل تخرّج', 'published');
    const p3 = await project(clientY, 'مشروع عميل آخر', 'published');
    const draft = await project(clientX, 'مسودة', 'draft');
    const expired = await project(clientX, 'منتهٍ', 'published', new Date(Date.now() - 86_400_000));
    await db`insert into project_members (project_id, user_id) values (${p1}, ${photoA}), (${p2}, ${photoB})`;
    const asset = async (pid: string, group: string, name: string) =>
      (await db<{ id: string }[]>`insert into assets (project_id, section, "group", r2_key, original_name, mime, size, status)
        values (${pid}, 'photos', ${group}, ${`media-library/${pid}/${name}`}, ${name}, 'image/jpeg', 1000, 'ready') returning id`)[0]!.id;
    const assetFinal = await asset(p1, 'final', 'final-1.jpg');
    const assetRaw = await asset(p1, 'raw', 'raw-1.cr3');
    const assetP2 = await asset(p2, 'final', 'p2-1.jpg');
    return { admin, photoA, photoB, lockUser, disabled, clientX, clientY, p1, p2, p3, draft, expired, assetFinal, assetRaw, assetP2 };
  } finally {
    await db.end();
  }
}
