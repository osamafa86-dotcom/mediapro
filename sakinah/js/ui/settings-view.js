/**
 * شاشة الإعدادات: الموقع، طريقة الحساب، المذهب، خطوط العرض العالية، التعديلات، الهجري، العرض، التنبيهات، البوصلة، حول.
 */
import { h, icon, render, openSheet, closeSheet, toast, switchEl, stepper, settingRow, labelFields } from './components.js';
import { METHODS, METHOD_ORDER, defaultMethodFor } from '../core/methods.js';
import { PRAYERS, PRAYER_NAMES_AR, HIGH_LATITUDE_RULE_NAMES_AR } from '../core/prayer-times.js';
import * as store from '../platform/storage.js';
import { isNative } from '../platform/native.js';
import { downloadFile } from '../platform/notifications.js';
import { describeLocation, deviceTimeZone } from '../platform/location.js';
import * as notif from '../platform/notifications.js';
import { resetAll } from '../platform/storage.js';
import * as backup from '../platform/backup.js';

export function mount(container, app) {
  function select(value, options, onChange) {
    const sel = h('select', { class: 'input' }, ...options.map(([v, label]) => h('option', { value: v, selected: v === value ? true : null }, label)));
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }
  function section(title, iconName, ...rows) {
    return h('div', { class: 'card' }, h('div', { class: 'card-title' }, h('h3', {}, h('span', { html: icon(iconName) }), title)), ...rows);
  }

  function build() {
    const s = app.settings; const loc = app.location;
    const autoMethod = defaultMethodFor({ countryCode: loc && loc.countryCode, tz: app.tz });
    const methodOptions = [['auto', `تلقائي حسب الموقع (${METHODS[autoMethod].nameAr})`], ...METHOD_ORDER.map((id) => [id, METHODS[id].nameAr])];
    const m = METHODS[app.methodId()];
    const methodDesc = m.ishaInterval ? `الفجر ${app.num(m.fajrAngle, 1)}° · العشاء بعد المغرب بـ ${app.num(m.ishaInterval)} دقيقة${m.ishaIntervalRamadan ? ` (${app.num(m.ishaIntervalRamadan)} في رمضان)` : ''}` : `الفجر ${app.num(m.fajrAngle, 1)}° · العشاء ${app.num(m.ishaAngle, 1)}°`;
    const perm = notif.permissionState();
    const ad = { morning: false, evening: false, morningAfter: 30, eveningAfter: 30, ...(s.notifications.adhkar || {}) };
    const hdp = { enabled: false, time: '09:00', ...(s.notifications.hadithDaily || {}) };

    render(container,
      section('الموقع', 'location',
        settingRow(describeLocation(loc), loc ? `${app.num(loc.lat, 4)}, ${app.num(loc.lon, 4)} · ${loc.tz}${loc.source === 'gps' ? ' · GPS' : loc.source === 'city' ? ' · من القائمة' : ' · يدوي'}` : 'لم يُحدَّد بعد',
          h('button', { class: 'btn btn-sm btn-soft', onclick: () => app.openLocationSheet() }, 'تغيير')),
        loc && loc.tz !== deviceTimeZone() ? h('div', { class: 'notice', style: { marginTop: '8px' } }, h('span', { html: icon('info') }), `تُعرض الأوقات بتوقيت ${loc.tz} (منطقة الموقع المختار) وليس بتوقيت جهازك (${deviceTimeZone()}).`) : null,
        settingRow('تسمية المدينة عبر الإنترنت', 'يرسل إحداثيات مقرّبة إلى نحو كيلومتر (لا موقعك الدقيق) إلى خدمة BigDataCloud لمعرفة اسم المدينة والدولة؛ عند الإيقاف يُكتفى بأقرب مدينة من القائمة المضمّنة',
          switchEl(!(s.privacy && s.privacy.geocode === false), (v) => app.set('privacy.geocode', v), 'تسمية المدينة عبر الإنترنت'))),

      section('حساب المواقيت', 'clock',
        h('div', { class: 'field' }, h('label', {}, 'طريقة الحساب'), select(s.method, methodOptions, (v) => app.set('method', v)), h('div', { class: 'tiny' }, methodDesc)),
        s.method === 'Custom' ? h('div', { class: 'grid-2' },
          h('div', { class: 'field' }, h('label', {}, 'زاوية الفجر (4–30°)'), numInput(s.custom.fajrAngle, (v) => app.set('custom.fajrAngle', v), { min: 4, max: 30 })),
          h('div', { class: 'field' }, h('label', {}, 'زاوية العشاء (4–30°)'), numInput(s.custom.ishaAngle, (v) => app.set('custom.ishaAngle', v), { min: 4, max: 30 })),
          h('div', { class: 'field' }, h('label', {}, 'العشاء بعد المغرب (دقائق، 0 = زاوية)'), numInput(s.custom.ishaInterval, (v) => app.set('custom.ishaInterval', v), { min: 0, max: 180 })),
          h('div', { class: 'field' }, h('label', {}, 'زاوية المغرب (0 = الغروب)'), numInput(s.custom.maghribAngle, (v) => app.set('custom.maghribAngle', v), { min: 0, max: 10 }))) : null,
        h('div', { class: 'field' }, h('label', {}, 'مذهب العصر'),
          h('div', { class: 'segmented' },
            h('button', { class: s.madhab === 'shafi' ? 'active' : '', onclick: () => app.set('madhab', 'shafi') }, 'الجمهور (ظل المثل)'),
            h('button', { class: s.madhab === 'hanafi' ? 'active' : '', onclick: () => app.set('madhab', 'hanafi') }, 'الحنفي (ظل المثلين)'))),
        h('div', { class: 'field' }, h('label', {}, 'خطوط العرض العالية (حين لا يتحقق الشفق)'),
          select(s.highLatitudeRule, Object.entries(HIGH_LATITUDE_RULE_NAMES_AR), (v) => app.set('highLatitudeRule', v))),
        app.methodId() === 'MoonsightingCommittee' ? h('div', { class: 'field' }, h('label', {}, 'الشفق المعتمد للعشاء (لجنة رؤية الهلال)'),
          select(s.shafaq || 'general', [['general', 'عام (بين الأحمر والأبيض)'], ['ahmer', 'الشفق الأحمر (أبكر)'], ['abyad', 'الشفق الأبيض (أبعد)']], (v) => app.set('shafaq', v))) : null,
        settingRow('تعديل يدوي بالدقائق', Object.values(s.adjustments).some((v) => v) ? `مفعّل: ${PRAYERS.filter((k) => s.adjustments[k]).map((k) => `${PRAYER_NAMES_AR[k]} ${s.adjustments[k] > 0 ? '+' : ''}${app.num(s.adjustments[k])}`).join('، ')}` : 'لمطابقة تقويم مسجدك المحلي عند الحاجة',
          h('button', { class: 'btn btn-sm btn-outline', onclick: openAdjustments }, 'تعديل')),
        settingRow('تعديل التاريخ الهجري', 'لمطابقة إعلان الرؤية في بلدك', stepper(s.hijriOffset, { min: -2, max: 2, format: (v) => (v > 0 ? '+' : '') + app.num(v) + ' يوم', onChange: (v) => app.set('hijriOffset', v) }))),

      section('التذكير بالصلاة', 'bell',
        settingRow('تفعيل التذكير', perm === 'denied' ? (isNative() ? 'الإذن مرفوض — فعّله من إعدادات النظام للتطبيق' : 'الإذن مرفوض في المتصفح — فعّله من إعدادات الموقع') : perm === 'unsupported' ? 'المتصفح لا يدعم الإشعارات' : isNative() ? 'إشعارات النظام بمواعيد الصلاة، تصل حتى والتطبيق مغلق' : 'إشعار ونغمة عند دخول وقت كل صلاة',
          switchEl(s.notifications.enabled, (v) => app.enableNotifications(v), 'تفعيل التذكير')),
        ...PRAYERS.map((k) => settingRow(PRAYER_NAMES_AR[k], k === 'sunrise' ? 'تنبيه بانتهاء وقت الفجر' : null, switchEl(s.notifications.prayers[k], (v) => app.set(`notifications.prayers.${k}`, v), PRAYER_NAMES_AR[k]))),
        h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', {}, 'تذكير مسبق قبل الأذان'),
          select(String(s.notifications.preMinutes), [['0', 'بدون'], ['5', 'قبل 5 دقائق'], ['10', 'قبل 10 دقائق'], ['15', 'قبل 15 دقيقة'], ['30', 'قبل 30 دقيقة']], (v) => app.set('notifications.preMinutes', Number(v)))),
        h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', {}, 'صوت دخول الوقت'),
          h('div', { class: 'row' }, select(s.notifications.sound || 'chime', notif.ADHAN_SOUNDS.map((x) => [x.id, x.name]), (v) => app.set('notifications.sound', v)),
            h('button', { class: 'btn btn-outline btn-sm', 'aria-label': 'تجربة الصوت', onclick: () => { notif.unlockAudio(); if (notif.isAdhanPlaying()) notif.stopAdhan(); else notif.playAdhan(app.settings.notifications.sound || 'chime'); } }, h('span', { html: icon('play') }))),
          h('div', { class: 'tiny' }, isNative() ? 'في الإشعار (والتطبيق مغلق) يُسمع مقطع 28 ثانية من الأذان، وداخل التطبيق الأذان كاملًا' : 'الأذان الكامل يُسمع ما دام التطبيق مفتوحًا؛ إشعار المتصفح يستخدم صوت النظام')),
        settingRow('الاهتزاز', null, switchEl(s.notifications.vibrate, (v) => app.set('notifications.vibrate', v), 'الاهتزاز')),
        h('div', { class: 'grid-2', style: { marginTop: '10px' } },
          h('button', { class: 'btn btn-outline', onclick: async () => { notif.unlockAudio(); notif.playChime(); const ok = await notif.showNotification('سكينة — تجربة', 'هكذا سيظهر تنبيه الصلاة', { tag: 'sakinah-test' }); if (!ok) toast('فعّل إذن الإشعارات أولًا'); } }, h('span', { html: icon('play') }), ' تجربة التنبيه'),
          h('button', { class: 'btn btn-outline', onclick: () => app.navigate('prayer') }, h('span', { html: icon('download') }), ' تصدير للتقويم')),
        h('div', { class: 'notice info', style: { marginTop: '12px' } }, h('span', { html: icon('info') }),
          h('span', {}, isNative()
            ? `تُجدوَل إشعارات النظام لنحو أسبوع مقدّمًا وتُجدَّد عند كل فتح للتطبيق${s.notifications.nativeUntil ? ` (مجدولة حتى ${new Date(s.notifications.nativeUntil).toLocaleDateString('ar', { day: 'numeric', month: 'long' })})` : ''}. افتح التطبيق مرة في الأسبوع على الأقل لتستمر.`
            : /iP(hone|ad|od)/.test(navigator.userAgent)
              ? 'على iPhone تعمل الإشعارات فقط بعد إضافة التطبيق إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) وما دام مفتوحًا. للتذكير المضمون حتى مع إغلاقه، صدّر المواقيت إلى تقويم هاتفك بمنبّهات من شاشة الصلاة، أو ثبّت تطبيق iOS.'
              : 'تعمل الإشعارات ما دام التطبيق مفتوحًا أو في الخلفية (ثبّته على الشاشة الرئيسية لأفضل نتيجة). للتذكير المضمون حتى مع إغلاق التطبيق، صدّر المواقيت إلى تقويم هاتفك بمنبّهات من شاشة الصلاة.'))),

      section('تذكير الأذكار وحديث اليوم', 'adhkar',
        !s.notifications.enabled ? h('div', { class: 'notice', style: { marginBottom: '10px' } }, h('span', { html: icon('info') }), 'فعّل «التذكير بالصلاة» أعلاه أولًا؛ هذه التذكيرات تصل بالطريقة نفسها (إشعارات النظام في التطبيق الأصلي).') : null,
        settingRow('أذكار الصباح', `تذكير بعد الفجر بـ ${app.num(ad.morningAfter)} دقيقة`, switchEl(!!ad.morning, (v) => app.set('notifications.adhkar.morning', v), 'أذكار الصباح')),
        ad.morning ? h('div', { class: 'field' }, h('label', {}, 'موعد تذكير الصباح'), select(String(ad.morningAfter), [['15', 'بعد الفجر بـ 15 دقيقة'], ['30', 'بعد الفجر بـ 30 دقيقة'], ['45', 'بعد الفجر بـ 45 دقيقة'], ['60', 'بعد الفجر بساعة'], ['90', 'بعد الفجر بساعة ونصف']], (v) => app.set('notifications.adhkar.morningAfter', Number(v)))) : null,
        settingRow('أذكار المساء', `تذكير بعد العصر بـ ${app.num(ad.eveningAfter)} دقيقة`, switchEl(!!ad.evening, (v) => app.set('notifications.adhkar.evening', v), 'أذكار المساء')),
        ad.evening ? h('div', { class: 'field' }, h('label', {}, 'موعد تذكير المساء'), select(String(ad.eveningAfter), [['15', 'بعد العصر بـ 15 دقيقة'], ['30', 'بعد العصر بـ 30 دقيقة'], ['45', 'بعد العصر بـ 45 دقيقة'], ['60', 'بعد العصر بساعة'], ['90', 'بعد العصر بساعة ونصف']], (v) => app.set('notifications.adhkar.eveningAfter', Number(v)))) : null,
        settingRow('حديث اليوم', 'إشعار يومي بحديث من الصحيحين في وقت تختاره', switchEl(!!hdp.enabled, (v) => app.set('notifications.hadithDaily.enabled', v), 'حديث اليوم')),
        hdp.enabled ? h('div', { class: 'field' }, h('label', {}, 'وقت حديث اليوم'), (() => { const i = h('input', { class: 'input ltr', type: 'time', value: hdp.time || '09:00', style: { width: '140px' } }); i.addEventListener('change', () => { if (/^\d{2}:\d{2}$/.test(i.value)) app.set('notifications.hadithDaily.time', i.value); }); return i; })()) : null),

      section('العرض', 'sun',
        settingRow('نظام 12 ساعة', 'مثال: 5:12 ص بدل 05:12', switchEl(s.hour12, (v) => app.set('hour12', v), '12 ساعة')),
        settingRow('الأرقام العربية المشرقية', '١٢٣ بدل 123', switchEl(s.numerals === 'arab', (v) => app.set('numerals', v ? 'arab' : 'latn'), 'الأرقام')),
        h('div', { class: 'field', style: { marginTop: '8px' } }, h('label', {}, 'السمة'), select(s.theme, [['auto', 'تلقائي (حسب الجهاز)'], ['light', 'فاتح'], ['dark', 'داكن']], (v) => { app.set('theme', v); app.applyTheme(); }))),

      section('البوصلة', 'compass',
        h('div', { class: 'field' }, h('label', {}, 'تصحيح الانحراف المغناطيسي'),
          select(s.compass.declinationMode, [['auto', 'تلقائي — إضافة انحراف WMM2025 (موصى به)'], ['off', 'بدون تصحيح (شمال مغناطيسي)']], (v) => app.set('compass.declinationMode', v)),
          h('div', { class: 'tiny' }, 'مستشعرات الهواتف تعطي الشمال المغناطيسي على iOS وAndroid؛ التصحيح يحوّله إلى الشمال الحقيقي الذي يُحسب عليه اتجاه القبلة.'))),

      section('النسخ الاحتياطي', 'download',
        backup.available() ? nativeBackupRows() : null,
        settingRow('تصدير الإعدادات والعلامات', 'ملف JSON يحوي الموقع والطريقة والتذكيرات وعلامات المصحف وموضع القراءة وتقدّم الأذكار',
          h('button', { class: 'btn btn-sm btn-soft', onclick: () => { downloadFile(`sakinah-backup-${app.todayKey()}.json`, store.exportJSON(), 'application/json;charset=utf-8'); toast('تم إنشاء ملف النسخة الاحتياطية'); } }, 'تصدير')),
        settingRow('استيراد نسخة احتياطية', 'يستبدل الإعدادات الحالية بما في الملف', (() => {
          const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
          input.addEventListener('change', async () => {
            const f = input.files && input.files[0]; if (!f) return;
            const r = store.importJSON(await f.text());
            if (r.ok) { toast('تم استيراد النسخة الاحتياطية'); app.applyTheme(); app.applyTextScale(); app.emit('change'); }
            else toast(r.error === 'not-sakinah' ? 'الملف ليس نسخة احتياطية من سكينة' : 'تعذّر قراءة الملف', 3500);
            input.value = '';
          });
          return h('span', {}, input, h('button', { class: 'btn btn-sm btn-outline', onclick: () => input.click() }, 'استيراد'));
        })())),

      section('حول التطبيق', 'info',
        h('div', { class: 'about' },
          h('p', {}, h('b', {}, `سكينة ${app.version}${app.build ? ` (بناء ${app.build})` : ''}`), ' — تطبيق ويب تقدمي يعمل دون اتصال بعد أول تحميل. كل الحسابات (المواقيت، القبلة، التقويم) تتم على جهازك، ولا حساب ولا تحليلات. الشبكة تُستخدم لجلب التلاوات والتفاسير وخطوط المصحف عند الطلب، ولتسمية مدينتك بإحداثيات مقرّبة إلى نحو كيلومتر (يمكن إيقافها من قسم الموقع أعلاه).'),
          h('p', {}, h('b', {}, 'المواقيت: '), 'حساب فلكي بخوارزميات Jean Meeus مع طرق الهيئات الرسمية (أم القرى، رابطة العالم الإسلامي، الهيئة المصرية، الأوقاف الأردنية…)، وقد تُختبر مطابقتها آليًا مع مكتبة adhan المرجعية.'),
          h('p', {}, h('b', {}, 'القبلة: '), 'اتجاه جيوديسي على WGS‑84 (Vincenty) نحو الكعبة (21.4225°N, 39.8262°E) مع الانحراف المغناطيسي من النموذج العالمي WMM2025 (NOAA/NCEI) والتحقق بالشمس.'),
          h('p', {}, h('b', {}, 'الأذكار: '), 'حصن المسلم كاملًا (132 بابًا) بنصوص الطبعة الرسمية للكتاب، مع أذكار الصباح والمساء بتخريجها؛ التلاوة الصوتية للذكر تُجلب من موقع الكتاب عند الطلب.'),
          h('p', {}, h('b', {}, 'الأحاديث: '), 'متون منقولة حرفيًا من صحيح البخاري (ترقيم فتح الباري) وصحيح مسلم (ترقيم محمد فؤاد عبد الباقي)، والأربعون النووية بمتونها وتخريجها بعد مقارنة نسختين مستقلتين.'),
          h('p', { class: 'tiny' }, 'تنبيه: المواقيت المحسوبة قد تختلف دقيقة أو دقيقتين عن التقاويم المحلية؛ استخدم التعديل اليدوي للمطابقة عند الحاجة.')),
        h('button', { class: 'btn btn-outline btn-block', style: { marginTop: '8px', color: 'var(--danger)' }, onclick: () => { if (confirm('إعادة ضبط جميع الإعدادات والتقدّم؟')) { resetAll(); app.applyTheme(); app.applyTextScale(); app.emit('change'); toast('تمت إعادة الضبط'); } } }, h('span', { html: icon('reset') }), ' إعادة ضبط التطبيق')));
  }

  /** التطبيق الأصلي: لقطات يومية في مجلد المستندات (تظهر في تطبيق الملفات) مع استعادة ومشاركة */
  function nativeBackupRows() {
    const list = h('div', { class: 'tiny' }, 'جارٍ قراءة اللقطات…');
    const draw = async () => {
      const items = await backup.listBackups();
      render(list, items.length ? h('div', { class: 'city-list' }, ...items.map((b) => h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, b.key), h('div', { class: 'desc' }, `${Math.round((b.size || 0) / 1024)} ك.ب`)),
        h('button', { class: 'btn btn-sm btn-outline', onclick: async () => { if (!confirm(`استعادة نسخة ${b.key}؟ ستُستبدل الإعدادات الحالية.`)) return; const r = await backup.restoreBackup(b.name); if (r.ok) { toast('تمت الاستعادة'); app.applyTheme(); app.applyTextScale(); app.emit('change'); } else toast('تعذّرت الاستعادة', 3000); } }, 'استعادة')))) : h('div', { class: 'tiny' }, 'لا لقطات بعد — تُؤخذ لقطة تلقائية يوميًا عند فتح التطبيق.'));
    };
    draw();
    return h('div', { style: { marginBottom: '10px' } },
      settingRow('لقطات تلقائية يومية', 'تُحفظ آخر 7 لقطات في «الملفات ← على جهازي ← سكينة ← sakinah-backups»؛ انسخها إلى iCloud Drive لتبقى بعد حذف التطبيق',
        h('button', { class: 'btn btn-sm btn-soft', onclick: async () => { const ok = await backup.autoBackup(app.todayKey()); toast(ok ? 'أُخذت لقطة اليوم' : 'لقطة اليوم موجودة'); draw(); } }, 'لقطة الآن')),
      list,
      settingRow('مشاركة نسخة احتياطية', 'إرسالها أو حفظها في iCloud Drive / Google Drive', h('button', { class: 'btn btn-sm btn-outline', onclick: () => backup.shareBackup(app.todayKey()) }, 'مشاركة')));
  }
  function numInput(value, onChange, { min = 0, max = 30 } = {}) {
    const i = h('input', { class: 'input ltr', type: 'number', step: '0.1', value, min, max });
    i.addEventListener('change', () => { const v = Number(i.value); onChange(Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0); });
    return i;
  }
  function openAdjustments() {
    const s = app.settings; const adj = { ...s.adjustments };
    openSheet({ title: 'تعديل المواقيت بالدقائق', content: h('div', {},
      h('p', { class: 'muted', style: { fontSize: '13px', marginBottom: '10px' } }, 'يُضاف التعديل إلى الوقت المحسوب (موجب = تأخير). استخدمه فقط لمطابقة التقويم الرسمي المحلي.'),
      ...PRAYERS.map((k) => settingRow(PRAYER_NAMES_AR[k], null, stepper(adj[k], { min: -30, max: 30, format: (v) => (v > 0 ? '+' : '') + app.num(v), onChange: (v) => { adj[k] = v; } }))),
      h('div', { class: 'grid-2', style: { marginTop: '12px' } },
        h('button', { class: 'btn btn-outline', onclick: () => { for (const k of PRAYERS) adj[k] = 0; app.update({ adjustments: adj }); closeSheet(); } }, 'تصفير'),
        h('button', { class: 'btn btn-primary', onclick: () => { app.update({ adjustments: adj }); closeSheet(); toast('تم حفظ التعديلات'); } }, 'حفظ'))) });
  }

  app.on('change', () => { if (app.current === 'settings') build(); });
  const build0 = build; build = () => { build0(); labelFields(container); };
  build();
  return { refresh: build, show: build };
}
