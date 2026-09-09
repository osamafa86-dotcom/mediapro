/**
 * سمات صفحة المصحف: ورق فاتح بدرجات (كريمي، أبيض، سكري، بني فاتح، أخضر/أزرق/بنفسجي هادئ، رمادي)، تدرّجات هادئة، وسمات داكنة
 * (داكن، أسود، أزرق ليلي، تدرّج الغسق). كل سمة تحدد لون الورق والحبر وألوان الإطار والعلامات وتظليل الآية، وتُطبَّق كمتغيرات CSS
 * على جذر القارئ. التباين بين الحبر والورق ≥ 7:1 في كل السمات (يتحقق منه اختبار).
 */
export const MUSHAF_THEMES = [
  { id: 'cream', name: 'كريمي', group: 'light', paper: '#f6f1e2', paper2: '#efe7d1', ink: '#1d1a14' },
  { id: 'white', name: 'أبيض', group: 'light', paper: '#fbfaf6', paper2: '#f1efe8', ink: '#191919' },
  { id: 'sugar', name: 'سكري', group: 'light', paper: '#f3e6c9', paper2: '#eadbb9', ink: '#2a2012' },
  { id: 'sepia', name: 'بني فاتح', group: 'light', paper: '#ecdfc7', paper2: '#e1d2b4', ink: '#33281a' },
  { id: 'mint', name: 'أخضر هادئ', group: 'light', paper: '#e8f1e4', paper2: '#dbe8d5', ink: '#152219' },
  { id: 'sky', name: 'أزرق هادئ', group: 'light', paper: '#e7eef5', paper2: '#d9e3ee', ink: '#141e2a' },
  { id: 'lavender', name: 'بنفسجي هادئ', group: 'light', paper: '#efeaf4', paper2: '#e2dbea', ink: '#201a2a' },
  { id: 'gray', name: 'رمادي', group: 'light', paper: '#eaeae7', paper2: '#dededa', ink: '#1a1a1a' },
  { id: 'dawn', name: 'تدرّج الفجر', group: 'gradient', paper: '#f9f1de', paper2: '#efe1c6', ink: '#241d12', gradient: 'linear-gradient(165deg, #fdf8ea 0%, #f5e9d1 55%, #eddcbd 100%)' },
  { id: 'sage', name: 'تدرّج زيتوني', group: 'gradient', paper: '#edf2e7', paper2: '#dfe7d6', ink: '#172017', gradient: 'linear-gradient(165deg, #f4f8ef 0%, #e7eddd 60%, #d9e2cd 100%)' },
  { id: 'pearl', name: 'تدرّج لؤلؤي', group: 'gradient', paper: '#f3f1ee', paper2: '#e8e4de', ink: '#1b1916', gradient: 'linear-gradient(165deg, #fbf9f6 0%, #eee9e2 60%, #e2dcd3 100%)' },
  { id: 'honey', name: 'تدرّج عسلي', group: 'gradient', paper: '#f5e9cf', paper2: '#eadab6', ink: '#2b2010', gradient: 'linear-gradient(165deg, #f9f0da 0%, #efe0bf 55%, #e6d3a8 100%)' },
  { id: 'dark', name: 'داكن', group: 'dark', paper: '#171916', paper2: '#21241f', ink: '#ece5d2' },
  { id: 'black', name: 'أسود', group: 'dark', paper: '#000000', paper2: '#121212', ink: '#e6dfcc' },
  { id: 'midnight', name: 'أزرق ليلي', group: 'dark', paper: '#0f1720', paper2: '#17222e', ink: '#e2e8ee' },
  { id: 'dusk', name: 'تدرّج الغسق', group: 'dark', paper: '#1a1e2a', paper2: '#222738', ink: '#e6e4de', gradient: 'linear-gradient(165deg, #242a3c 0%, #181c27 60%, #0f1119 100%)' },
];
export const THEME_GROUPS = [['light', 'فاتح'], ['gradient', 'تدرّجات هادئة'], ['dark', 'داكن']];
export function themeById(id) { return MUSHAF_THEMES.find((t) => t.id === id) || MUSHAF_THEMES[0]; }
export function isDarkTheme(id) { return themeById(id).group === 'dark'; }
/** السمة الفعلية من إعدادات المصحف، مع ترقية الإعدادات القديمة (night/paper) */
export function migrateTheme(qs = {}) {
  if (qs.theme && MUSHAF_THEMES.some((t) => t.id === qs.theme)) return qs.theme;
  if (qs.night) return 'dark';
  return qs.paper === 'white' ? 'white' : 'cream';
}
const LIGHT_ACCENTS = { '--gold-1': '#a98a3a', '--gold-2': '#cfb46f', '--gold-3': '#e9dcb2', '--frame': '#2f5a3a', '--marker': '#8f7430', '--rub': '#b8336a', '--mp-hl': 'rgba(15, 118, 110, .16)', '--mp-sel': 'rgba(183, 121, 31, .22)', '--mp-hide': 'rgba(60, 50, 20, .07)', '--mp-hide-line': 'rgba(60, 50, 20, .25)' };
const DARK_ACCENTS = { '--gold-1': '#b8993f', '--gold-2': '#8d7434', '--gold-3': '#4a3f22', '--frame': '#5a8a64', '--marker': '#c9a851', '--rub': '#e06b95', '--mp-hl': 'rgba(45, 212, 191, .22)', '--mp-sel': 'rgba(226, 176, 74, .3)', '--mp-hide': 'rgba(236, 229, 210, .08)', '--mp-hide-line': 'rgba(236, 229, 210, .3)' };
/** متغيرات CSS التي تُطبَّق على جذر القارئ */
export function themeVars(theme) {
  const t = typeof theme === 'string' ? themeById(theme) : theme;
  return { '--paper': t.paper, '--paper-2': t.paper2, '--ink': t.ink, '--paper-bg': t.gradient || t.paper, '--reader-bg': t.gradient || t.paper2, ...(t.group === 'dark' ? DARK_ACCENTS : LIGHT_ACCENTS) };
}
/** نسبة التباين (WCAG) بين لونين hex */
export function contrastRatio(a, b) {
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
