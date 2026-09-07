/**
 * سكينة — نقطة الدخول: الحالة المشتركة، التنقل، المؤقّتات، التذكيرات، السمة، التثبيت.
 */
import * as store from './platform/storage.js';
import { dayTimeline, computePrayerTimes, civilDate, formatTime, defaultParams, PRAYER_NAMES_AR, addDays } from './core/prayer-times.js';
import { defaultMethodFor, METHODS } from './core/methods.js';
import { hijriDate, isRamadan, gregorianFormatted } from './core/hijri.js';
import { detectLocation, locationFromCity, locationFromCoords, searchCities, describeLocation, deviceTimeZone, isGeolocationSupported } from './platform/location.js';
import * as notif from './platform/notifications.js';
import { h, icon, initSheet, openSheet, closeSheet, toast, render, fmtNum, vibrate } from './ui/components.js';
import * as prayerView from './ui/prayer-view.js';
import * as qiblaView from './ui/qibla-view.js';
import * as adhkarView from './ui/adhkar-view.js';
import * as hadithView from './ui/hadith-view.js';
import * as settingsView from './ui/settings-view.js';
import * as quranView from './ui/quran-view.js';
import * as moreView from './ui/more-view.js';

const listeners = new Map();
const VIEWS = {
  prayer: { title: 'الصلاة', icon: 'prayer', mod: prayerView, tab: 'prayer' },
  quran: { title: 'المصحف', icon: 'book', mod: quranView, tab: 'quran' },
  qibla: { title: 'القبلة', icon: 'qibla', mod: qiblaView, tab: 'qibla' },
  adhkar: { title: 'الأذكار', icon: 'adhkar', mod: adhkarView, tab: 'adhkar' },
  more: { title: 'المزيد', icon: 'more', mod: moreView, tab: 'more' },
  hadith: { title: 'الأحاديث', icon: 'hadith', mod: hadithView, tab: 'more' },
  settings: { title: 'الإعدادات', icon: 'settings', mod: settingsView, tab: 'more' },
};
const TABS = ['prayer', 'quran', 'qibla', 'adhkar', 'more'];

export const app = {
  version: '1.0.0',
  current: 'prayer',
  mounted: {},
  installPrompt: null,

  get settings() { return store.getSettings(); },
  get location() { return store.get('location'); },
  get tz() { return (this.location && this.location.tz) || deviceTimeZone(); },
  get numerals() { return this.settings.numerals; },

  methodId() {
    const s = this.settings;
    if (s.method && s.method !== 'auto') return s.method;
    return defaultMethodFor({ countryCode: this.location && this.location.countryCode, tz: this.tz });
  },
  methodName() { const m = METHODS[this.methodId()]; return m ? m.nameAr : this.methodId(); },
  prayerParams(now = new Date()) {
    const s = this.settings;
    return defaultParams({
      method: this.methodId(), madhab: s.madhab, highLatitudeRule: s.highLatitudeRule, adjustments: s.adjustments, custom: s.custom,
      isRamadan: isRamadan(now, this.tz, s.hijriOffset), tz: this.tz,
    });
  },
  coords() { const l = this.location; return l ? { latitude: l.lat, longitude: l.lon } : null; },
  timeline(now = new Date()) {
    const c = this.coords(); if (!c) return null;
    return dayTimeline(c, this.tz, this.prayerParams(now), now);
  },
  timesFor(civil) { const c = this.coords(); return c ? computePrayerTimes(c, civil, this.prayerParams(new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12)))) : null; },
  fmt(date) { return formatTime(date, this.tz, { hour12: this.settings.hour12, numerals: this.numerals }); },
  num(n, digits = 0, group = false) { return fmtNum(n, this.numerals, digits, group); },
  hijri(now = new Date()) { return hijriDate(now, this.tz, this.settings.hijriOffset); },
  gregorian(now = new Date()) { return gregorianFormatted(now, this.tz, this.numerals); },
  todayKey(now = new Date()) { const d = civilDate(now, this.tz); return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`; },

  update(patch) { store.update(patch); this.emit('change'); },
  set(path, value) { store.set(path, value); this.emit('change'); },
  replace(path, value) { store.replace(path, value); this.emit('change'); },
  applyTextScale() { document.documentElement.style.setProperty('--text-scale', String(this.settings.textScale || 1)); },
  on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return () => listeners.get(ev).delete(fn); },
  emit(ev, data) { (listeners.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },

  navigate(view, { replace = false } = {}) {
    if (!VIEWS[view]) view = 'prayer';
    const prev = this.current; this.current = view;
    for (const k of Object.keys(VIEWS)) document.getElementById(`view-${k}`).classList.toggle('active', k === view);
    for (const t of TABS) {
      const el = document.getElementById(`tab-${t}`);
      el.classList.toggle('active', VIEWS[view].tab === t);
      el.setAttribute('aria-current', VIEWS[view].tab === t ? 'page' : 'false');
    }
    if (prev !== view && this.mounted[prev] && this.mounted[prev].hide) this.mounted[prev].hide();
    if (this.mounted[view] && this.mounted[view].show) this.mounted[view].show();
    const hash = `#/${view}`;
    if (location.hash !== hash) { if (replace) history.replaceState(null, '', hash); else history.pushState(null, '', hash); }
    window.scrollTo({ top: 0 });
  },

  /* ---------- الموقع ---------- */
  async detectLocation({ silent = false } = {}) {
    if (!isGeolocationSupported()) { toast('المتصفح لا يدعم تحديد الموقع'); return null; }
    try {
      const loc = await detectLocation();
      this.update({ location: loc });
      if (!silent) toast(`تم تحديد الموقع: ${describeLocation(loc)}`);
      return loc;
    } catch (e) {
      if (!silent) {
        const msg = e.code === 'denied' ? 'تم رفض إذن الموقع — يمكنك اختيار مدينتك يدويًا' : e.code === 'timeout' ? 'انتهت مهلة تحديد الموقع — حاول مجددًا أو اختر مدينة' : 'تعذّر تحديد الموقع — اختر مدينتك يدويًا';
        toast(msg, 3800);
      }
      return null;
    }
  },
  setCity(city) { this.update({ location: locationFromCity(city) }); toast(`تم اختيار ${city.nameAr}`); },

  openLocationSheet() {
    const list = h('div', { class: 'city-list' });
    const input = h('input', { class: 'input', type: 'search', placeholder: 'ابحث عن مدينة أو دولة…', autocomplete: 'off' });
    const gpsBtn = h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
      gpsBtn.disabled = true; render(gpsBtn, h('span', { class: 'spinner' }), ' جارٍ تحديد الموقع…');
      const loc = await this.detectLocation();
      gpsBtn.disabled = false; render(gpsBtn, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا (GPS)');
      if (loc) closeSheet();
    } }, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا (GPS)');
    const showList = (q) => {
      const cities = searchCities(q, 40);
      render(list, cities.length ? cities.map((c) => h('button', { class: 'city-item', onclick: () => { this.setCity(c); closeSheet(); } },
        h('span', {}, h('b', {}, c.nameAr), h('div', { class: 'c' }, `${c.countryAr} · ${c.nameEn}`)),
        h('span', { class: 'tiny ltr' }, c.tz))) : h('div', { class: 'empty' }, 'لا نتائج — جرّب اسمًا آخر أو أدخل الإحداثيات'));
    };
    input.addEventListener('input', () => showList(input.value));
    showList('');
    const lat = h('input', { class: 'input ltr', type: 'number', step: 'any', placeholder: 'خط العرض (lat)', inputmode: 'decimal' });
    const lon = h('input', { class: 'input ltr', type: 'number', step: 'any', placeholder: 'خط الطول (lon)', inputmode: 'decimal' });
    const tzIn = h('input', { class: 'input ltr', type: 'text', value: deviceTimeZone(), placeholder: 'المنطقة الزمنية' });
    const manual = h('details', { class: 'more' }, h('summary', {}, 'إدخال إحداثيات يدويًا'),
      h('div', { class: 'stack', style: { marginTop: '10px' } }, h('div', { class: 'grid-2' }, lat, lon), tzIn,
        h('button', { class: 'btn btn-outline btn-block', onclick: () => {
          const la = parseFloat(lat.value), lo = parseFloat(lon.value);
          if (!(la >= -90 && la <= 90 && lo >= -180 && lo <= 180)) return toast('إحداثيات غير صالحة');
          try { new Intl.DateTimeFormat('en', { timeZone: tzIn.value }); } catch { return toast('منطقة زمنية غير صالحة'); }
          this.update({ location: locationFromCoords(la, lo, tzIn.value) }); closeSheet(); toast('تم حفظ الموقع');
        } }, 'حفظ الإحداثيات')));
    openSheet({ title: 'تحديد الموقع', content: h('div', { class: 'stack' }, gpsBtn, input, list, manual) });
    setTimeout(() => input.focus({ preventScroll: true }), 350);
  },

  /* ---------- التذكيرات ---------- */
  reminderSchedule() {
    const c = this.coords(); const prefs = this.settings.notifications;
    if (!c || !prefs.enabled) return [];
    const now = new Date(); const out = [];
    for (const off of [-1, 0, 1]) { // الأمس أيضًا: قد يقع عشاء الأمس بعد منتصف الليل في خطوط العرض العالية
      const civil = addDays(civilDate(now, this.tz), off);
      const t = this.timesFor(civil);
      out.push(...notif.buildReminders(t, prefs, (d) => this.fmt(d), `${civil.year}-${civil.month}-${civil.day}`, (v) => this.num(v)));
    }
    return out;
  },
  async fireReminder(item) {
    const prefs = this.settings.notifications;
    await notif.showNotification(item.title, item.body, { tag: `sakinah-${item.kind}`, vibrate: prefs.vibrate, url: './index.html#/prayer' });
    if (prefs.sound !== 'none' && item.kind === 'adhan') notif.playChime();
    if (prefs.vibrate) vibrate([300, 100, 300]);
    toast(item.title, 6000);
  },
  async enableNotifications(on) {
    if (!on) { this.set('notifications.enabled', false); return false; }
    const perm = await notif.requestPermission();
    if (perm !== 'granted') { toast(perm === 'unsupported' ? 'المتصفح لا يدعم الإشعارات' : 'لم يُمنح إذن الإشعارات', 3500); this.set('notifications.enabled', false); return false; }
    notif.unlockAudio();
    this.set('notifications.enabled', true);
    toast('تم تفعيل التذكير بمواعيد الصلاة');
    return true;
  },

  /* ---------- السمة والتثبيت ---------- */
  applyTheme() {
    const t = this.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const btn = document.getElementById('btn-theme');
    btn.innerHTML = icon(t === 'auto' ? 'theme' : dark ? 'moon' : 'sun');
    btn.title = t === 'auto' ? 'السمة: تلقائي' : dark ? 'السمة: داكن' : 'السمة: فاتح';
  },
  cycleTheme() {
    const order = ['auto', 'light', 'dark']; const cur = this.settings.theme;
    this.set('theme', order[(order.indexOf(cur) + 1) % 3]); this.applyTheme();
    toast(`السمة: ${{ auto: 'تلقائي', light: 'فاتح', dark: 'داكن' }[this.settings.theme]}`);
  },
  async install() {
    if (!this.installPrompt) return toast('افتح قائمة المتصفح واختر "إضافة إلى الشاشة الرئيسية"', 4000);
    this.installPrompt.prompt();
    const r = await this.installPrompt.userChoice; this.installPrompt = null;
    document.getElementById('btn-install').hidden = true;
    if (r.outcome === 'accepted') toast('تم تثبيت التطبيق');
  },
};

function updateHeader() {
  const sub = document.getElementById('header-sub');
  const hj = app.hijri();
  sub.textContent = `${hj.weekday}، ${app.num(hj.day)} ${hj.monthName} ${app.num(hj.year)}هـ`;
}

function boot() {
  initSheet();
  // التبويبات
  for (const t of TABS) {
    const tab = document.getElementById(`tab-${t}`);
    tab.innerHTML = `${icon(VIEWS[t].icon)}<span>${VIEWS[t].title}</span>`;
    tab.addEventListener('click', () => app.navigate(t));
  }
  for (const [k, v] of Object.entries(VIEWS)) app.mounted[k] = v.mod.mount(document.getElementById(`view-${k}`), app);
  document.getElementById('btn-theme').addEventListener('click', () => app.cycleTheme());
  document.getElementById('btn-settings').innerHTML = icon('settings');
  document.getElementById('btn-settings').addEventListener('click', () => app.navigate('settings'));
  document.documentElement.style.setProperty('--quran-scale', String((app.settings.quran && app.settings.quran.fontScale) || 1));
  document.getElementById('btn-install').innerHTML = icon('install');
  document.getElementById('btn-install').addEventListener('click', () => app.install());
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); app.installPrompt = e; document.getElementById('btn-install').hidden = false; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => app.applyTheme());
  app.applyTheme();
  app.applyTextScale();

  const route = () => app.navigate((location.hash.replace(/^#\/?/, '') || 'prayer').split('?')[0], { replace: true });
  window.addEventListener('hashchange', route);
  route();
  updateHeader();
  app.on('change', updateHeader);

  // المؤقّت: كل ثانية للعدّ التنازلي، وفحص تغيّر اليوم
  let lastDay = app.todayKey();
  setInterval(() => {
    app.emit('tick');
    const k = app.todayKey();
    if (k !== lastDay) { lastDay = k; app.emit('change'); }
  }, 1000);

  // التذكيرات
  notif.startScheduler(() => app.reminderSchedule(), (item) => app.fireReminder(item));

  // عامل الخدمة
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.SAKINAH_STANDALONE) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  // تحديث الموقع بصمت إذا كان من GPS وقديمًا (> 12 ساعة)
  const loc = app.location;
  if (loc && loc.source === 'gps' && Date.now() - (loc.updatedAt || 0) > 12 * 3600e3 && navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then((p) => { if (p.state === 'granted') app.detectLocation({ silent: true }); }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
window.sakinah = app;
