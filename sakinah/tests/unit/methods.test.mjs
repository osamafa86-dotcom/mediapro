import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as adhan from 'adhan';
import { METHODS, METHOD_ORDER, COUNTRY_METHOD, TZ_METHOD, defaultMethodFor, getMethod } from '../../js/core/methods.js';

test('معاملات الطرق المشتركة مطابقة لـ adhan-js (زوايا، فواصل، تعديلات)', () => {
  const map = { MuslimWorldLeague: 'MuslimWorldLeague', Egyptian: 'Egyptian', Karachi: 'Karachi', UmmAlQura: 'UmmAlQura', Dubai: 'Dubai', MoonsightingCommittee: 'MoonsightingCommittee', NorthAmerica: 'NorthAmerica', Kuwait: 'Kuwait', Qatar: 'Qatar', Singapore: 'Singapore', Tehran: 'Tehran', Turkey: 'Turkey' };
  for (const [ours, theirs] of Object.entries(map)) {
    const a = adhan.CalculationMethod[theirs](); const m = METHODS[ours];
    assert.equal(m.fajrAngle, a.fajrAngle, `${ours} fajr`);
    assert.equal(m.ishaAngle, a.ishaAngle, `${ours} isha`);
    assert.equal(m.ishaInterval, a.ishaInterval, `${ours} interval`);
    assert.equal(m.maghribAngle || 0, a.maghribAngle || 0, `${ours} maghrib angle`);
    for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) assert.equal(m.adjustments[k] || 0, a.methodAdjustments[k] || 0, `${ours} adj ${k}`);
    assert.equal(m.rounding, a.rounding === 'up' ? 'up' : 'nearest', `${ours} rounding`);
  }
});

test('الطرق الإضافية مطابقة لجدول AlAdhan', () => {
  assert.deepEqual([METHODS.Jordan.fajrAngle, METHODS.Jordan.ishaAngle, METHODS.Jordan.maghribInterval], [18, 18, 5]);
  assert.deepEqual([METHODS.Gulf.fajrAngle, METHODS.Gulf.ishaInterval], [19.5, 90]);
  assert.deepEqual([METHODS.France.fajrAngle, METHODS.France.ishaAngle], [12, 12]);
  assert.deepEqual([METHODS.Russia.fajrAngle, METHODS.Russia.ishaAngle], [16, 15]);
  assert.deepEqual([METHODS.JAKIM.fajrAngle, METHODS.JAKIM.ishaAngle], [20, 18]);
  assert.deepEqual([METHODS.Indonesia.fajrAngle, METHODS.Indonesia.ishaAngle], [20, 18]);
  assert.deepEqual([METHODS.Tunisia.fajrAngle, METHODS.Tunisia.ishaAngle], [18, 18]);
  assert.deepEqual([METHODS.Algeria.fajrAngle, METHODS.Algeria.ishaAngle], [18, 17]);
  assert.deepEqual([METHODS.Morocco.fajrAngle, METHODS.Morocco.ishaAngle], [19, 17]);
  assert.deepEqual([METHODS.Portugal.fajrAngle, METHODS.Portugal.ishaInterval, METHODS.Portugal.maghribInterval], [18, 77, 3]);
  assert.deepEqual([METHODS.Jafari.fajrAngle, METHODS.Jafari.ishaAngle, METHODS.Jafari.maghribAngle], [16, 14, 4]);
  assert.equal(METHODS.UmmAlQura.ishaIntervalRamadan, 120);
});

test('كل طريقة في METHOD_ORDER معرّفة ولها اسم عربي، وكل خريطة تشير إلى طريقة موجودة', () => {
  for (const id of METHOD_ORDER) { assert.ok(METHODS[id], id); assert.ok(METHODS[id].nameAr.length > 2, id); assert.equal(METHODS[id].id, id); }
  assert.equal(new Set(METHOD_ORDER).size, METHOD_ORDER.length);
  for (const [k, v] of Object.entries(COUNTRY_METHOD)) assert.ok(METHODS[v], `${k} -> ${v}`);
  for (const [k, v] of Object.entries(TZ_METHOD)) { assert.ok(METHODS[v], `${k} -> ${v}`); new Intl.DateTimeFormat('en', { timeZone: k }); }
});

test('الطريقة الافتراضية حسب الدولة ثم المنطقة الزمنية ثم الاحتياط', () => {
  assert.equal(defaultMethodFor({ countryCode: 'SA' }), 'UmmAlQura');
  assert.equal(defaultMethodFor({ countryCode: 'JO' }), 'Jordan');
  assert.equal(defaultMethodFor({ countryCode: 'EG' }), 'Egyptian');
  assert.equal(defaultMethodFor({ countryCode: 'TR' }), 'Turkey');
  assert.equal(defaultMethodFor({ countryCode: 'xx', tz: 'Asia/Amman' }), 'Jordan');
  assert.equal(defaultMethodFor({ tz: 'America/Denver' }), 'NorthAmerica');
  assert.equal(defaultMethodFor({ tz: 'Europe/Berlin' }), 'MuslimWorldLeague');
  assert.equal(defaultMethodFor({}), 'MuslimWorldLeague');
  assert.equal(getMethod('nope').id, 'MuslimWorldLeague');
});
