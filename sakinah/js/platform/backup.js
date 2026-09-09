/**
 * النسخ الاحتياطي في التطبيق الأصلي: لقطة يومية تلقائية من الإعدادات والعلامات والتقدّم إلى مجلد المستندات
 * (تظهر في تطبيق «الملفات» تحت اسم التطبيق فيمكن نسخها إلى iCloud Drive)، مع الاحتفاظ بآخر 7 لقطات،
 * واستعادة أي لقطة، ومشاركة نسخة عبر ورقة المشاركة. على الويب يُكتفى بالتصدير/الاستيراد اليدوي.
 */
import { plugin, isNative, shareFile } from './native.js';
import * as store from './storage.js';

const DIR = 'sakinah-backups';
const KEEP = 7;
const fileName = (key) => `sakinah-${key}.json`;

export function available() { return isNative() && !!plugin('Filesystem'); }

async function ensureDir(F) { try { await F.mkdir({ path: DIR, directory: 'DOCUMENTS', recursive: true }); } catch { /* موجود */ } }

/** قائمة اللقطات (الأحدث أولًا): { name, key, size, mtime } */
export async function listBackups() {
  const F = plugin('Filesystem'); if (!F) return [];
  try {
    await ensureDir(F);
    const r = await F.readdir({ path: DIR, directory: 'DOCUMENTS' });
    const files = (r.files || []).map((f) => (typeof f === 'string' ? { name: f } : f)).filter((f) => /^sakinah-\d{4}-\d{2}-\d{2}\.json$/.test(f.name));
    return files.map((f) => ({ name: f.name, key: f.name.slice(8, 18), size: f.size || 0, mtime: f.mtime || 0 })).sort((a, b) => (a.key < b.key ? 1 : -1));
  } catch { return []; }
}
/** لقطة اليوم إن لم تُؤخذ بعد؛ تعيد true عند الكتابة. تُحذف الأقدم من KEEP */
export async function autoBackup(todayKey) {
  const F = plugin('Filesystem'); if (!F || !todayKey) return false;
  try {
    const list = await listBackups();
    if (list.some((b) => b.key === todayKey)) return false;
    await ensureDir(F);
    await F.writeFile({ path: `${DIR}/${fileName(todayKey)}`, data: store.exportJSON(), directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    for (const old of list.slice(KEEP - 1)) { try { await F.deleteFile({ path: `${DIR}/${old.name}`, directory: 'DOCUMENTS' }); } catch { /* تجاهل */ } }
    return true;
  } catch { return false; }
}
/** استعادة لقطة باسمها؛ تعيد نتيجة importJSON */
export async function restoreBackup(name) {
  const F = plugin('Filesystem'); if (!F) return { ok: false, error: 'unsupported' };
  try {
    const r = await F.readFile({ path: `${DIR}/${name}`, directory: 'DOCUMENTS', encoding: 'utf8' });
    return store.importJSON(typeof r.data === 'string' ? r.data : '');
  } catch { return { ok: false, error: 'read' }; }
}
/** مشاركة نسخة الآن (لحفظها في iCloud Drive أو إرسالها) */
export async function shareBackup(todayKey) {
  return shareFile(`sakinah-backup-${todayKey}.json`, store.exportJSON(), 'application/json');
}
