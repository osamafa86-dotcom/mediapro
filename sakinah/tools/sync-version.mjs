// مزامنة رقم الإصدار من package.json إلى js/version.js وsw.js وios-release.txt (مصدر واحد للحقيقة)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const ver = JSON.parse(fs.readFileSync(root + 'package.json', 'utf8')).version;
fs.writeFileSync(root + 'js/version.js', `// يُولَّد من package.json عبر tools/sync-version.mjs — لا يُحرَّر يدويًا (اختبار الوحدة يتحقق من تطابقه)\nexport const VERSION = '${ver}';\n`);
const sw = fs.readFileSync(root + 'sw.js', 'utf8').replace(/const VERSION = 'sakinah-v[^']+';/, `const VERSION = 'sakinah-v${ver}';`);
fs.writeFileSync(root + 'sw.js', sw);
fs.writeFileSync(root + 'ios-release.txt', ver + '\n');
console.log('version', ver, '→ js/version.js, sw.js, ios-release.txt');
