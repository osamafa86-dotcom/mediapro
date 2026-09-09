// توليد خريطة العالم (اليابسة) كمسار SVG بإسقاط متساوي المستطيلات إلى js/data/world-land.js
// المصدر: Natural Earth 1:110m (ملك عام) عبر حزمة world-atlas (ISC) — TopoJSON يُفكّ هنا دون تبعيات.
// الاستخدام: node tools/build-world-map.mjs [path-to-land-110m.json]  (يُحمَّل من jsDelivr إن لم يُعطَ)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = process.argv[2] || path.join(root, '.cache/land-110m.json');
let topo;
if (fs.existsSync(src)) topo = JSON.parse(fs.readFileSync(src, 'utf8'));
else { const r = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json'); if (!r.ok) throw new Error('download failed ' + r.status); topo = await r.json(); fs.mkdirSync(path.dirname(src), { recursive: true }); fs.writeFileSync(src, JSON.stringify(topo)); }

// فكّ ترميز الأقواس (delta + transform)
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });
const ring = (arcIdxs) => { const pts = []; for (const i of arcIdxs) { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; for (let k = 0; k < a.length; k++) { if (pts.length && k === 0) continue; pts.push(a[k]); } } return pts; };
const geoms = topo.objects.land.geometries;
const polys = []; for (const g of geoms) { if (g.type === 'Polygon') polys.push(g.arcs); else if (g.type === 'MultiPolygon') polys.push(...g.arcs); }
// إسقاط: x = lon + 180 (0..360), y = 90 - lat (0..180)
const fmt = (v) => (Math.round(v * 10) / 10).toString();
let d = ''; let points = 0;
for (const poly of polys) {
  for (const r of poly) {
    const pts = ring(r); let last = null; let seg = '';
    for (const [lon, lat] of pts) {
      const x = lon + 180, y = 90 - lat;
      if (last && Math.abs(x - last[0]) < 0.15 && Math.abs(y - last[1]) < 0.15) continue; // تبسيط طفيف
      seg += (seg ? 'L' : 'M') + fmt(x) + ' ' + fmt(y); last = [x, y]; points++;
    }
    if (seg) d += seg + 'Z';
  }
}
const out = `/**
 * خريطة العالم (اليابسة) كمسار SVG بإسقاط متساوي المستطيلات: x = خط الطول + 180، y = 90 − خط العرض (viewBox 0 0 360 180).
 * مولّدة بـ tools/build-world-map.mjs من Natural Earth 1:110m (ملك عام) عبر world-atlas.
 */
export const WORLD_LAND_PATH = ${JSON.stringify(d)};
`;
fs.writeFileSync(path.join(root, 'js/data/world-land.js'), out);
console.log('wrote js/data/world-land.js', (out.length / 1024).toFixed(0) + ' KB', 'polygons', polys.length, 'points', points);
