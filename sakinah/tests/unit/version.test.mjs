import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION } from '../../js/version.js';

test('رقم الإصدار واحد في package.json وjs/version.js وsw.js وios-release.txt', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.match(fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8'), new RegExp(`const VERSION = 'sakinah-v${pkg.version.replace(/\\./g, '\\\\.')}'`));
  assert.equal(fs.readFileSync(new URL('../../ios-release.txt', import.meta.url), 'utf8').trim(), pkg.version);
});
