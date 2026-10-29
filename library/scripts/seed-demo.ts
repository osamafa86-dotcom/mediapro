/*
 * Demo data for local development and screenshots — the names and numbers of the Figma frames.
 * Refuses to run against a database that already has projects, so it can never touch real data.
 *   DATABASE_URL=postgres://…/media pnpm tsx scripts/seed-demo.ts
 */
import postgres from 'postgres';
import { hashSecret } from '../src/lib/auth/password';

const GB = 1024 ** 3;

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    if ((await sql`select count(*)::int as n from projects`)[0]!.n > 0 && !process.argv.includes('--reset')) {
      console.error('Database already has projects; refusing (use --reset only on a throwaway database).');
      process.exit(1);
    }
    if (process.argv.includes('--reset')) {
      if (!/\/(media_test|media_demo)$/.test(process.env.DATABASE_URL ?? '') || process.env.NODE_ENV === 'production') { console.error('refusing'); process.exit(1); }
      await sql`truncate users, clients, projects, links, sessions, viewer_sessions, magic_links, login_throttle, renewal_requests, audit_log, assets, uploads, settings, downloads restart identity cascade`;
    }
    const pw = await hashSecret(process.env.DEMO_PASSWORD ?? 'demo-password-123');
    const user = async (name: string, email: string, role: string, title: string | null, opts: { login?: boolean; disabled?: boolean } = {}) =>
      (await sql<{ id: string }[]>`insert into users (name, email, role, title, password_hash, last_login_at, disabled_at)
        values (${name}, ${email}, ${role}, ${title}, ${pw}, ${opts.login === false ? null : sql`now()`}, ${opts.disabled ? sql`now()` : null}) returning id`)[0]!.id;
    const admin = await user('أسامة م.', 'admin@demo.test', 'admin', null);
    const sami = await user('سامي عودة', 'sami@demo.test', 'photographer', 'مصوّر رئيسي');
    const reem = await user('ريم حسن', 'reem@demo.test', 'photographer', 'مصوّرة');
    const layla = await user('ليلى داود', 'layla@demo.test', 'editor', 'محرّرة فيديو');
    const ali = await user('علي ناصر', 'ali@demo.test', 'photographer', 'مصوّر');
    await user('يوسف كمال', 'yousef@demo.test', 'contributor', 'متعاون');
    await user('مها سليم', 'maha@demo.test', 'photographer', 'مصوّرة', { login: false });
    await user('خالد رضوان', 'khaled@demo.test', 'photographer', 'مصوّر', { disabled: true });

    const client = async (ar: string, tr: string, kind: string, contact: string, email: string | null) =>
      (await sql<{ id: string }[]>`insert into clients (name_ar, name_tr, kind, contact_name, contact_email) values (${ar}, ${tr}, ${kind}, ${contact}, ${email}) returning id`)[0]!.id;
    const nour = await client('مؤسسة النور للتنمية', 'Nur Kalkınma Vakfı', 'partner', 'هبة س.', 'heba@alnoor.org');
    const amal = await client('جمعية الأمل الخيرية', 'Umut Hayır Derneği', 'beneficiary', 'محمد ع.', null);
    const ihh = await client('İHH İnsani Yardım Vakfı', 'İHH İnsani Yardım Vakfı', 'partner', 'Ahmet Y.', 'ahmet@ihh.org.tr');
    const deir = await client('بلدية دير البلح', 'Deir el-Balah Belediyesi', 'beneficiary', 'رامي ح.', null);
    const rawdat = await client('روضة البراعم', 'Baraim Anaokulu', 'beneficiary', 'سمر ك.', null);
    const hamdan = await client('عائلة حمدان', 'Hamdan Ailesi', 'beneficiary', 'أبو أحمد', null);

    const project = async (cid: string, title: string, status: string, date: string, place: string, members: string[], photos: number, videos: number, gb: number, type: string) => {
      const [p] = await sql<{ id: string }[]>`insert into projects (client_id, title, status, shot_date, place, type, published_at, updated_at)
        values (${cid}, ${title}, ${status}, ${date}, ${place}, ${type}, ${status === 'published' ? sql`now()` : null}, now() - interval '9 hours') returning id`;
      for (const m of members) await sql`insert into project_members (project_id, user_id) values (${p!.id}, ${m})`;
      const per = Math.round((gb * GB) / Math.max(1, photos + videos));
      const rows = [
        ...Array.from({ length: photos }, (_, i) => ({ section: 'photos', name: `IMG_${String(1000 + i)}.jpg`, mime: 'image/jpeg' })),
        ...Array.from({ length: videos }, (_, i) => ({ section: 'videos', name: `CLIP_${String(100 + i)}.mp4`, mime: 'video/mp4' })),
      ];
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r, j) => ({ project_id: p!.id, section: r.section, group: 'final', r2_key: `demo/${p!.id}/${i + j}-${r.name}`,
          original_name: r.name, mime: r.mime, size: per, status: 'ready', uploaded_by: members[0] ?? null }));
        await sql`insert into assets ${sql(chunk)}`;
      }
      return p!.id;
    };
    const p1 = await project(nour, 'توزيع الطرود الغذائية — رفح', 'published', '2026-10-12', 'رفح', [sami, reem], 248, 14, 18.4, 'توزيع');
    const p2 = await project(amal, 'حفل زفاف جماعي — دير البلح', 'review', '2026-10-09', 'دير البلح', [sami], 612, 22, 64.2, 'فعالية');
    await project(nour, 'سلال رمضان — خان يونس', 'published', '2026-09-02', 'خان يونس', [reem], 96, 6, 7.9, 'توزيع');
    await project(amal, 'ورشة الخبز المجتمعي', 'published', '2026-08-18', 'غزة', [sami, ali], 132, 9, 11.3, 'ورشة');
    await project(hamdan, 'زفاف آل حمدان — غزة', 'uploading', '2026-08-02', 'غزة', [sami], 840, 31, 92.0, 'فعالية');
    await project(rawdat, 'تخريج روضة البراعم', 'expired', '2026-07-24', 'غزة', [ali], 210, 4, 6.1, 'فعالية');
    await project(nour, 'مبادرة المياه — بيت لاهيا', 'review', '2026-07-10', 'بيت لاهيا', [reem], 154, 12, 14.8, 'بناء');
    await project(ihh, 'Kurban 2026 — Gazze', 'published', '2026-06-06', 'Gazze', [layla], 300, 20, 25, 'توزيع');
    await project(deir, 'ترميم مدرسة الشهداء', 'draft', '2026-05-20', 'دير البلح', [ali], 0, 0, 0, 'بناء');

    const link = async (cid: string, pid: string | null, days: number, opens: number) =>
      sql`insert into links (client_id, project_id, kind, jti, code, pin_hash, expires_at, opens)
        values (${cid}, ${pid}, 'client', ${crypto.randomUUID()}, ${Math.random().toString(36).slice(2, 7) + '-' + Math.random().toString(36).slice(2, 7)}, ${pw}, now() + make_interval(days => ${days}), ${opens})`;
    await link(nour, p1, 60, 3); await link(amal, p2, 4, 0); await link(ihh, null, 45, 2);
    await sql`insert into audit_log (actor_type, actor_id, action, target_type, target_id, at) values
      ('user', ${sami}, 'project.review', 'project', ${p2}, now() - interval '20 hours'),
      ('user', ${admin}, 'project.published', 'project', ${p1}, now() - interval '2 hours')`;
    console.log('Demo data ready. Sign in as admin@demo.test with DEMO_PASSWORD (default demo-password-123).');
  } finally {
    await sql.end();
  }
}
void main();
