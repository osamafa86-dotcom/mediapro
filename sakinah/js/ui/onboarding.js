/**
 * تهيئة أول تشغيل (شاشة كاملة، أربع خطوات): ترحيب وخصوصية → الموقع → التذكير والصوت → جاهز.
 * تظهر مرة واحدة (seenIntro) حين لا يوجد موقع محفوظ؛ يمكن تخطي أي خطوة، وتُستكمل لاحقًا من الإعدادات.
 */
import { h, icon, render, toast, switchEl, labelFields } from './components.js';
import { describeLocation } from '../platform/location.js';
import * as notif from '../platform/notifications.js';
import { isNative } from '../platform/native.js';

export function needsOnboarding(app) { return !app.settings.seenIntro && !app.location; }

export function showOnboarding(app) {
  if (document.getElementById('onboard')) return;
  let step = 0; let off = null;
  const root = h('div', { id: 'onboard', class: 'onboard-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'تهيئة سكينة' });
  document.body.append(root); document.body.classList.add('onboarding');
  const finish = () => { app.set('seenIntro', true); if (off) off(); root.classList.add('leaving'); setTimeout(() => { root.remove(); document.body.classList.remove('onboarding'); }, 260); app.navigate('prayer', { replace: true }); };
  const dots = () => h('div', { class: 'ob-dots', 'aria-hidden': 'true' }, ...[0, 1, 2, 3].map((i) => h('i', { class: i === step ? 'on' : i < step ? 'done' : '' })));
  const next = () => { step = Math.min(3, step + 1); draw(); };
  const back = () => { step = Math.max(0, step - 1); draw(); };

  function welcome() {
    return h('div', { class: 'ob-step' },
      h('div', { class: 'ob-logo', html: icon('kaaba') }),
      h('h1', {}, 'سكينة'),
      h('p', { class: 'ob-lead' }, 'مواقيت الصلاة، القبلة، المصحف، الأذكار والأحاديث — في تطبيق واحد يعمل دون اتصال، بلا حساب ولا إعلانات ولا تتبّع.'),
      h('ul', { class: 'ob-list' },
        h('li', {}, h('span', { html: icon('prayer') }), 'مواقيت بحساب فلكي دقيق وطرق الهيئات الرسمية'),
        h('li', {}, h('span', { html: icon('book') }), 'مصحف المدينة بصفحاته مع تلاوات وتفسير وحفظ'),
        h('li', {}, h('span', { html: icon('qibla') }), 'قبلة جيوديسية مع تصحيح الانحراف المغناطيسي'),
        h('li', {}, h('span', { html: icon('adhkar') }), 'حصن المسلم كاملًا، المسبحة، والأربعون النووية')),
      h('p', { class: 'tiny' }, 'كل الحسابات على جهازك. الشبكة تُستخدم فقط لجلب التلاوات والتفاسير وخطوط المصحف عند طلبها.'),
      h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: next }, 'ابدأ'));
  }
  function location() {
    const loc = app.location;
    const gpsBtn = h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: async () => {
      gpsBtn.disabled = true; render(gpsBtn, h('span', { class: 'spinner' }), ' جارٍ تحديد الموقع…');
      const ok = await app.detectLocation({ silent: true });
      if (!ok) { gpsBtn.disabled = false; render(gpsBtn, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا'); toast('تعذّر تحديد الموقع — اختر مدينتك من القائمة', 3500); }
    } }, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا');
    return h('div', { class: 'ob-step' },
      h('div', { class: 'ob-logo', html: icon('location') }),
      h('h2', {}, 'أين أنت؟'),
      h('p', { class: 'ob-lead' }, 'نحتاج موقعك لحساب المواقيت واتجاه القبلة. يبقى الموقع على جهازك، ولا يُرسل منه إلا نسخة مقرّبة إلى نحو كيلومتر لتسمية مدينتك (ويمكن إيقاف ذلك من الإعدادات).'),
      loc ? h('div', { class: 'notice ok' }, h('span', { html: icon('check') }), `تم: ${describeLocation(loc)}`) : null,
      h('div', { class: 'stack' },
        loc ? h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: next }, 'متابعة') : gpsBtn,
        h('button', { class: 'btn btn-outline btn-block', onclick: () => app.openLocationSheet() }, h('span', { html: icon('search') }), loc ? ' تغيير المدينة' : ' اختيار مدينة من القائمة'),
        loc ? null : h('button', { class: 'btn btn-ghost btn-block', onclick: next }, 'لاحقًا')));
  }
  function reminders() {
    const s = app.settings;
    const sel = h('select', { class: 'input' }, ...notif.ADHAN_SOUNDS.map((x) => h('option', { value: x.id, selected: (s.notifications.sound || 'chime') === x.id ? true : null }, x.name)));
    sel.addEventListener('change', () => app.set('notifications.sound', sel.value));
    const supported = notif.isSupported();
    return h('div', { class: 'ob-step' },
      h('div', { class: 'ob-logo', html: icon('bell') }),
      h('h2', {}, 'التذكير بالصلاة'),
      h('p', { class: 'ob-lead' }, supported ? (isNative() ? 'إشعارات النظام بمواعيد الصلاة تصل حتى والتطبيق مغلق، بصوت الأذان أو نغمة هادئة.' : 'تنبيه ونغمة عند دخول وقت الصلاة ما دام التطبيق مفتوحًا أو مثبّتًا على الشاشة الرئيسية.') : 'المتصفح لا يدعم الإشعارات؛ يمكنك تصدير المواقيت إلى تقويم هاتفك من شاشة الصلاة.'),
      supported ? h('div', { class: 'card', style: { textAlign: 'right' } },
        h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'تفعيل التذكير بالصلاة')), switchEl(s.notifications.enabled, async (v) => { await app.enableNotifications(v); draw(); }, 'تفعيل التذكير')),
        h('div', { class: 'field', style: { marginTop: '8px' } }, h('label', {}, 'صوت دخول الوقت'), sel),
        h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'أذكار الصباح والمساء'), h('div', { class: 'desc' }, 'تذكير بعد الفجر وبعد العصر')), switchEl(!!(s.notifications.adhkar && s.notifications.adhkar.morning), (v) => { app.set('notifications.adhkar.morning', v); app.set('notifications.adhkar.evening', v); }, 'تذكير الأذكار'))) : null,
      h('div', { class: 'stack' },
        h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: next }, 'متابعة'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: back }, 'رجوع')));
  }
  function done() {
    const s = app.settings; const loc = app.location;
    const seg = h('div', { class: 'segmented' }, ...[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => h('button', { class: s.theme === v ? 'active' : '', onclick: () => { app.set('theme', v); app.applyTheme(); draw(); } }, l)));
    return h('div', { class: 'ob-step' },
      h('div', { class: 'ob-logo', html: icon('check') }),
      h('h2', {}, 'كل شيء جاهز'),
      h('ul', { class: 'ob-list' },
        h('li', {}, h('span', { html: icon('location') }), loc ? describeLocation(loc) : 'الموقع: لاحقًا من الإعدادات'),
        h('li', {}, h('span', { html: icon('clock') }), `طريقة الحساب: ${app.methodName()}`),
        h('li', {}, h('span', { html: icon('bell') }), s.notifications.enabled ? 'التذكير بالصلاة مفعّل' : 'التذكير بالصلاة: لاحقًا من الإعدادات')),
      h('div', { class: 'field' }, h('label', {}, 'السمة'), seg),
      h('div', { class: 'stack' },
        h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: finish }, 'إلى شاشة الصلاة'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: back }, 'رجوع')));
  }
  function draw() {
    render(root, h('div', { class: 'ob-inner' }, dots(), [welcome, location, reminders, done][step]()));
    labelFields(root);
    const first = root.querySelector('button.btn-primary, button'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    root.scrollTop = 0;
  }
  // تحديد الموقع (من GPS أو القائمة) في خطوة الموقع ينتقل تلقائيًا
  off = app.on('change', () => { if (step === 1 && app.location) { step = 2; draw(); } });
  draw();
  return { finish };
}
