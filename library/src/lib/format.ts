import { dateLocale, type Locale } from '@/i18n/config';

/*
 * Display formatting shared by server and client. Digits are pinned (latn by default; arab only when the
 * library setting asks for it) — never left to the locale default, which differs by ICU version.
 */
export type Digits = 'latn' | 'arab';

export function numLocale(locale: Locale, digits: Digits = 'latn') {
  return locale === 'ar' ? `ar-u-nu-${digits}` : 'tr-TR';
}

export function formatNumber(n: number, locale: Locale, digits: Digits = 'latn') {
  return new Intl.NumberFormat(numLocale(locale, digits)).format(n);
}

/** 18.4 GB — binary units, one decimal from GB up; units are Latin in both languages (as in the design). */
export function formatBytes(bytes: number, locale: Locale, digits: Digits = 'latn') {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const n = new Intl.NumberFormat(numLocale(locale, digits), { minimumFractionDigits: i >= 3 ? 1 : 0, maximumFractionDigits: i >= 2 ? 1 : 0 }).format(v);
  return `${n} ${units[i]}`;
}

export function formatDay(d: Date | string, locale: Locale, timeZone = 'Asia/Hebron', digits: Digits = 'latn') {
  const base = dateLocale(locale);
  const loc = locale === 'ar' ? base.replace('-u-nu-latn', `-u-nu-${digits}`) : base;
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(d));
}

export function formatDateTime(d: Date | string, locale: Locale, timeZone = 'Asia/Hebron') {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'full', timeStyle: 'short', timeZone }).format(new Date(d));
}

/** «قبل ساعتين» / «2 saat önce», «أمس»; beyond a week the date itself. */
export function formatRelative(d: Date | string, locale: Locale, now = Date.now(), timeZone = 'Asia/Hebron') {
  const diff = (new Date(d).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(numLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
  return formatDay(d, locale, timeZone);
}

/** Days from now until d (ceil); negative once past. */
export function daysUntil(d: Date | string, now = Date.now()) {
  return Math.ceil((new Date(d).getTime() - now) / 86_400_000);
}

/**
 * Search key: Arabic hamza/alef forms, alef maqsura, taa marbuta, tatweel and harakat folded; Turkish
 * dotted/dotless i folded. The SQL twin is `normSql` in lib/admin/queries.ts — keep them identical.
 */
export function normalizeSearch(s: string) {
  return s.toLocaleLowerCase('tr-TR').normalize('NFC')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ı/g, 'i')
    .replace(/[ـً-ْٰ̇]/g, '').trim();
}

/** «الأربعاء 28 تشرين الأول 2026» */
export function formatWeekday(d: Date | string, locale: Locale, timeZone = 'Asia/Hebron') {
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(d));
}

/**
 * Wrap a number-with-unit (64%, 18.4 GB, +970…) in LRI…PDI so it keeps its order inside Arabic text —
 * a trailing % or unit otherwise jumps to the wrong side (measured; see the financial-tables skill).
 */
export const ltr = (s: string | number) => `⁦${s}⁩`;
export const formatPct = (n: number, locale: Locale) => ltr(locale === 'tr' ? `%${n}` : `${n}%`);

/** A list of names in either direction: each name isolated (FSI…PDI) so «ريم حسن، سامي» stays whole inside Turkish text. */
export function joinNames(names: string[] | null | undefined, locale: Locale) {
  const list = (names ?? []).map((n) => `⁨${n}⁩`);
  return list.length ? list.join(locale === 'ar' ? '، ' : ', ') : '—';
}
