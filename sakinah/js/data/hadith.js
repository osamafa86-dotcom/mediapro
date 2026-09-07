/**
 * أحاديث مختارة من صحيحي البخاري ومسلم.
 * النصوص منقولة حرفيًا (المتن) من نسخة الصحيحين المرقّمة بترقيم فتح الباري (البخاري)
 * وترقيم محمد فؤاد عبد الباقي (مسلم)، وتُتحقَّق آليًا في tests/data/hadith.test.mjs.
 */
import { PART_A } from './hadith/part-a.js';
import { PART_B } from './hadith/part-b.js';

export const HADITH_TOPICS = [
  'العقيدة', 'العبادة', 'الأخلاق', 'المعاملات', 'الذكر والدعاء', 'الآداب', 'العلم', 'الأسرة', 'الرقائق'
];

export const HADITHS = [...PART_A, ...PART_B];

/** حديث اليوم: اختيار ثابت لليوم الواحد (يتغير يوميًا ولا يتكرر قبل مرور القائمة) */
export function hadithOfDay(date = new Date()) {
  const dayIndex = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return HADITHS[((dayIndex % HADITHS.length) + HADITHS.length) % HADITHS.length];
}

export function hadithReference(h) {
  const col = h.collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم';
  let ref = `${col} (${h.number})`;
  if (h.alsoIn) {
    const col2 = h.alsoIn.collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم';
    ref += ` و${col2} (${h.alsoIn.number})`;
  }
  return ref;
}
