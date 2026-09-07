/**
 * شاشة الإعدادات: الموقع، طريقة الحساب، المذهب، خطوط العرض العالية، التعديلات، الهجري، العرض، التنبيهات، البوصلة، حول.
 */
import { h, icon, render, openSheet, closeSheet, toast, switchEl, stepper, settingRow } from './components.js';
import { METHODS, METHOD_ORDER, defaultMethodFor } from '../core/methods.js';
import { PRAYERS, PRAYER_NAMES_AR, HIGH_LATITUDE_RULE_NAMES_AR } from '../core/prayer-times.js';
import { describeLocation, deviceTimeZone } from '../platform/location.js';
import * as notif from '../platform/notifications.js';
import { resetAll } from '../platform/storage.js';

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

    render(container,
      section('الموقع', 'location',
        settingRow(describeLocation(loc), loc ? `${app.num(loc.lat, 4)}, ${app.num(loc.lon, 4)} · ${loc.tz}${loc.source === 'gps' ? ' · GPS' : loc.source === 'city' ? ' · من القائمة' : ' · يدوي'}` : 'لم يُحدَّد بعد',
          h('button', { class: 'btn btn-sm btn-soft', onclick: () => app.openLocationSheet() }, 'تغيير')),
        loc && loc.tz !== deviceTimeZone() ? h('div', { class: 'notice', style: { marginTop: '8px' } }, h('span', { html: icon('info') }), `تُعرض الأوقات بتوقيت ${loc.tz} (منطقة الموقع المختار) وليس بتوقيت جهازك (${deviceTimeZone()}).`) : null),

      section('حساب المواقيت', 'clock',
        h('div', { class: 'field' }, h('label', {}, 'طريقة الحساب'), select(s.method, methodOptions, (v) => app.set('method', v)), h('div', { class: 'tiny' }, methodDesc)),
        s.method === 'Custom' ? h('div', { class: 'grid-2' },
          h('div', { class: 'field' }, h('label', {}, 'زاوية الفجر'), numInput(s.custom.fajrAngle, (v) => app.set('custom.fajrAngle', v))),
          h('div', { class: 'field' }, h('label', {}, 'زاوية العشاء'), numInput(s.custom.ishaAngle, (v) => app.set('custom.ishaAngle', v))),
          h('div', { class: 'field' }, h('label', {}, 'العشاء بعد المغرب (دقائق، 0 = زاوية)'), numInput(s.custom.ishaInterval, (v) => app.set('custom.ishaInterval', v))),
          h('div', { class: 'field' }, h('label', {}, 'زاوية المغرب (0 = الغروب)'), numInput(s.custom.maghribAngle, (v) => app.set('custom.maghribAngle', v)))) : null,
        h('div', { class: 'field' }, h('label', {}, 'مذهب العصر'),
          h('div', { class: 'segmented' },
            h('button', { class: s.madhab === 'shafi' ? 'active' : '', onclick: () => app.set('madhab', 'shafi') }, 'الجمهور (ظل المثل)'),
            h('button', { class: s.madhab === 'hanafi' ? 'active' : '', onclick: () => app.set('madhab', 'hanafi') }, 'الحنفي (ظل المثلين)'))),
        h('div', { class: 'field' }, h('label', {}, 'خطوط العرض العالية (حين لا يتحقق الشفق)'),
          select(s.highLatitudeRule, Object.entries(HIGH_LATITUDE_RULE_NAMES_AR), (v) => app.set('highLatitudeRule', v))),
        settingRow('تعديل يدوي بالدقائق', Object.values(s.adjustments).some((v) => v) ? `مفعّل: ${PRAYERS.filter((k) => s.adjustments[k]).map((k) => `${PRAYER_NAMES_AR[k]} ${s.adjustments[k] > 0 ? '+' : ''}${app.num(s.adjustments[k])}`).join('، ')}` : 'لمطابقة تقويم مسجدك المحلي عند الحاجة',
          h('button', { class: 'btn btn-sm btn-outline', onclick: openAdjustments }, 'تعديل')),
        settingRow('تعديل التاريخ الهجري', 'لمطابقة إعلان الرؤية في بلدك', stepper(s.hijriOffset, { min: -2, max: 2, format: (v) => (v > 0 ? '+' : '') + app.num(v) + ' يوم', onChange: (v) => app.set('hijriOffset', v) }))),

      section('التذكير بالصلاة', 'bell',
        settingRow('تفعيل التذكير', perm === 'denied' ? 'الإذن مرفوض في المتصفح — فعّله من إعدادات الموقع' : perm === 'unsupported' ? 'المتصفح لا يدعم الإشعارات' : 'إشعار ونغمة عند دخول وقت كل صلاة',
          switchEl(s.notifications.enabled, (v) => app.enableNotifications(v), 'تفعيل التذكير')),
        ...PRAYERS.map((k) => settingRow(PRAYER_NAMES_AR[k], k === 'sunrise' ? 'تنبيه بانتهاء وقت الفجر' : null, switchEl(s.notifications.prayers[k], (v) => app.set(`notifications.prayers.${k}`, v), PRAYER_NAMES_AR[k]))),
        h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', {}, 'تذكير مسبق قبل الأذان'),
          select(String(s.notifications.preMinutes), [['0', 'بدون'], ['5', 'قبل 5 دقائق'], ['10', 'قبل 10 دقائق'], ['15', 'قبل 15 دقيقة'], ['30', 'قبل 30 دقيقة']], (v) => app.set('notifications.preMinutes', Number(v)))),
        settingRow('نغمة التنبيه', 'نغمة هادئة عند دخول الوقت', switchEl(s.notifications.sound !== 'none', (v) => app.set('notifications.sound', v ? 'chime' : 'none'), 'النغمة')),
        settingRow('الاهتزاز', null, switchEl(s.notifications.vibrate, (v) => app.set('notifications.vibrate', v), 'الاهتزاز')),
        h('div', { class: 'grid-2', style: { marginTop: '10px' } },
          h('button', { class: 'btn btn-outline', onclick: async () => { notif.unlockAudio(); notif.playChime(); const ok = await notif.showNotification('سكينة — تجربة', 'هكذا سيظهر تنبيه الصلاة', { tag: 'sakinah-test' }); if (!ok) toast('فعّل إذن الإشعارات أولًا'); } }, h('span', { html: icon('play') }), ' تجربة التنبيه'),
          h('button', { class: 'btn btn-outline', onclick: () => app.navigate('prayer') }, h('span', { html: icon('download') }), ' تصدير للتقويم')),
        h('div', { class: 'notice info', style: { marginTop: '12px' } }, h('span', { html: icon('info') }),
          h('span', {}, 'تعمل الإشعارات ما دام التطبيق مفتوحًا أو في الخلفية (ثبّته على الشاشة الرئيسية لأفضل نتيجة). للتذكير المضمون حتى مع إغلاق التطبيق، صدّر المواقيت إلى تقويم هاتفك بمنبّهات من شاشة الصلاة.'))),

      section('العرض', 'sun',
        settingRow('نظام 12 ساعة', 'مثال: 5:12 ص بدل 05:12', switchEl(s.hour12, (v) => app.set('hour12', v), '12 ساعة')),
        settingRow('الأرقام العربية المشرقية', '١٢٣ بدل 123', switchEl(s.numerals === 'arab', (v) => app.set('numerals', v ? 'arab' : 'latn'), 'الأرقام')),
        h('div', { class: 'field', style: { marginTop: '8px' } }, h('label', {}, 'السمة'), select(s.theme, [['auto', 'تلقائي (حسب الجهاز)'], ['light', 'فاتح'], ['dark', 'داكن']], (v) => { app.set('theme', v); app.applyTheme(); }))),

      section('البوصلة', 'compass',
        h('div', { class: 'field' }, h('label', {}, 'تصحيح الانحراف المغناطيسي'),
          select(s.compass.declinationMode, [['auto', 'تلقائي — إضافة انحراف WMM2025 (موصى به)'], ['off', 'بدون تصحيح (شمال مغناطيسي)']], (v) => app.set('compass.declinationMode', v)),
          h('div', { class: 'tiny' }, 'مستشعرات الهواتف تعطي الشمال المغناطيسي على iOS وAndroid؛ التصحيح يحوّله إلى الشمال الحقيقي الذي يُحسب عليه اتجاه القبلة.'))),

      section('حول التطبيق', 'info',
        h('div', { class: 'about' },
          h('p', {}, h('b', {}, `سكينة ${app.version}`), ' — تطبيق ويب تقدمي يعمل دون اتصال بعد أول تحميل، ولا يرسل موقعك إلى أي خادم (جميع الحسابات على جهازك).'),
          h('p', {}, h('b', {}, 'المواقيت: '), 'حساب فلكي بخوارزميات Jean Meeus مع طرق الهيئات الرسمية (أم القرى، رابطة العالم الإسلامي، الهيئة المصرية، الأوقاف الأردنية…)، وقد تُختبر مطابقتها آليًا مع مكتبة adhan المرجعية.'),
          h('p', {}, h('b', {}, 'القبلة: '), 'اتجاه جيوديسي على WGS‑84 (Vincenty) نحو الكعبة (21.4225°N, 39.8262°E) مع الانحراف المغناطيسي من النموذج العالمي WMM2025 (NOAA/NCEI) والتحقق بالشمس.'),
          h('p', {}, h('b', {}, 'الأذكار: '), 'حصن المسلم — أذكار الصباح والمساء بنصوصها وتخريجها.'),
          h('p', {}, h('b', {}, 'الأحاديث: '), 'متون منقولة حرفيًا من صحيح البخاري (ترقيم فتح الباري) وصحيح مسلم (ترقيم محمد فؤاد عبد الباقي).'),
          h('p', { class: 'tiny' }, 'تنبيه: المواقيت المحسوبة قد تختلف دقيقة أو دقيقتين عن التقاويم المحلية؛ استخدم التعديل اليدوي للمطابقة عند الحاجة.')),
        h('button', { class: 'btn btn-outline btn-block', style: { marginTop: '8px', color: 'var(--danger)' }, onclick: () => { if (confirm('إعادة ضبط جميع الإعدادات والتقدّم؟')) { resetAll(); app.emit('change'); toast('تمت إعادة الضبط'); } } }, h('span', { html: icon('reset') }), ' إعادة ضبط التطبيق')));
  }

  function numInput(value, onChange) {
    const i = h('input', { class: 'input ltr', type: 'number', step: '0.1', value });
    i.addEventListener('change', () => onChange(Number(i.value) || 0));
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
  build();
  return { refresh: build, show: build };
}
