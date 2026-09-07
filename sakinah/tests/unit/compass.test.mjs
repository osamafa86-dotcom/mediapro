import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingFromEuler, HeadingSmoother, magneticToTrue, trueToMagnetic, accuracyLabel } from '../../js/platform/compass.js';

test('headingFromEuler: جهاز مستوٍ، alpha=0 → الشمال، alpha=90 → الغرب (W3C: alpha يزداد عكس عقارب الساعة)', () => {
  assert.ok(Math.abs(headingFromEuler(0, 0, 0)) < 1e-9);
  assert.ok(Math.abs(headingFromEuler(90, 0, 0) - 270) < 1e-9);
  assert.ok(Math.abs(headingFromEuler(270, 0, 0) - 90) < 1e-9);
  assert.ok(Math.abs(headingFromEuler(180, 0, 0) - 180) < 1e-9);
});

test('headingFromEuler: الإمالة (beta) لا تغيّر الاتجاه ما دام الجهاز غير رأسي', () => {
  for (const beta of [0, 20, 45, 60]) {
    assert.ok(Math.abs(headingFromEuler(300, beta, 0) - 60) < 1e-9, `beta ${beta}`);
  }
});

test('headingFromEuler: جهاز رأسي (beta≈90) يستخدم اتجاه ظهر الجهاز', () => {
  // عند alpha=0 وbeta=90 يكون ظهر الجهاز (‑z) متجهًا إلى الشمال
  assert.ok(Math.abs(headingFromEuler(0, 90, 0)) < 1e-6);
  assert.ok(Math.abs(headingFromEuler(90, 90, 0) - 270) < 1e-6);
});

test('headingFromEuler: تعويض دوران الشاشة', () => {
  // الهاتف مُدار 90° عكس عقارب الساعة (angle=90): رأس الجهاز نحو الغرب (alpha=90 → 270) لكن أعلى الشاشة (الحافة اليمنى) نحو الشمال
  assert.ok(Math.abs(headingFromEuler(90, 0, 0, 90)) < 1e-9);
  assert.ok(Math.abs(headingFromEuler(0, 0, 0, 90) - 90) < 1e-9);
});

test('HeadingSmoother لا يقفز عند حدود 0/360', () => {
  const s = new HeadingSmoother(0.5);
  s.push(359); const v = s.push(1);
  assert.ok(v < 1 || v > 359, `got ${v}`);
});

test('تحويل الانحراف المغناطيسي', () => {
  assert.equal(magneticToTrue(350, 15), 5);
  assert.equal(trueToMagnetic(5, 15), 350);
  assert.equal(magneticToTrue(10, -12.5), 357.5);
  assert.equal(accuracyLabel(3).level, 'high'); assert.equal(accuracyLabel(null).level, 'unknown'); assert.equal(accuracyLabel(40).level, 'bad');
});
