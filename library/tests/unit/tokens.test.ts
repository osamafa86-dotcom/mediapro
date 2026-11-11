import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The design tokens are the one place colour lives (README rule). These tests read src/styles/tokens.css
 * as the browser would — light is :root, dark overrides it — and hold it to the brand (Figma
 * 8emMB8oGRIgHxxnnun408G): the names the components use exist, the action colour is the bright
 * turquoise with dark text on it, and every text/control pair clears WCAG in both themes.
 */
const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level rules only. At-rule blocks are skipped: the themes are declared at the top level. */
function topRules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  let depth = 0, start = 0, open = -1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') { if (depth === 0) open = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const selector = css.slice(start, open).trim();
        if (!selector.startsWith('@')) out.push({ selector, body: css.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  return out;
}
const decls = (body: string) => [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()] as const);

const rules = topRules(stripComments(read('styles/tokens.css')));
const selectors = (r: { selector: string }) => r.selector.split(',').map((s) => s.trim());
const light = new Map<string, string>();
for (const r of rules) if (selectors(r).some((s) => s === ':root' || s === '[data-theme="light"]')) for (const [k, v] of decls(r.body)) light.set(k, v);
const darkOwn = new Map<string, string>();
for (const r of rules) if (selectors(r).includes('[data-theme="dark"]')) for (const [k, v] of decls(r.body)) darkOwn.set(k, v);
const dark = new Map([...light, ...darkOwn]);

function resolve(theme: Map<string, string>, name: string, seen: string[] = []): string {
  const v = theme.get(name);
  if (v === undefined) throw new Error(`${name} is not defined (via ${seen.join(' → ') || 'direct'})`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(theme, ref[1]!, [...seen, name]) : v;
}
const hex = (theme: Map<string, string>, name: string) => resolve(theme, name).toLowerCase();

function luminance(h: string): number {
  const m = /^#([0-9a-f]{6})$/.exec(h);
  if (!m) throw new Error(`not a solid hex colour: ${h}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(theme: Map<string, string>, fg: string, bg: string): number {
  const [a, b] = [luminance(hex(theme, fg)), luminance(hex(theme, bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

describe('design tokens', () => {
  it('every custom property a component uses is defined — a fallback is not a definition', () => {
    const files = walk(SRC).filter((f) => /\.(css|tsx?)$/.test(f));
    const defined = new Set<string>([
      '--trigger-width', // set at runtime by React Aria on a popover
    ]);
    for (const f of files) {
      const text = stripComments(readFileSync(f, 'utf8'));
      // declarations in CSS, and custom properties set from a style object in TSX
      for (const m of text.matchAll(f.endsWith('.css') ? /(?:^|[;{\s])(--[\w-]+)\s*:/g : /['"](--[\w-]+)['"]\s*\]?\s*:/g)) defined.add(m[1]!);
    }
    const missing = new Set<string>();
    for (const f of files) {
      const text = stripComments(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) if (!defined.has(m[1]!)) missing.add(`${m[1]} in ${f.slice(SRC.length + 1)}`);
    }
    expect([...missing].sort()).toEqual([]);
  });

  it('the action colour is the bright turquoise with dark text on it, in both themes', () => {
    for (const theme of [light, dark]) {
      expect(hex(theme, '--color-bg-accent')).toBe('#30cec5');
      expect(hex(theme, '--color-text-on-accent')).toBe('#0e0e0e');
      expect(hex(theme, '--color-icon-on-accent')).toBe('#0e0e0e');
    }
    expect(hex(light, '--color-bg-accent-hover')).toBe('#14b4ac');
    expect(hex(dark, '--color-bg-accent-hover')).toBe('#68ded6');
  });

  it('the neutrals carry no tint: the UI steps aside for the media', () => {
    expect(hex(light, '--color-bg-app')).toBe('#f4f4f3');
    expect(hex(light, '--color-bg-surface')).toBe('#ffffff');
    expect(hex(dark, '--color-bg-app')).toBe('#0e0e0e');
    expect(hex(dark, '--color-bg-surface')).toBe('#1a1a19');
  });

  it('the deep field (sidebar), control border, focus ring and meter have tokens in both themes', () => {
    expect(hex(light, '--color-bg-field')).toBe('#0a5f5b');
    expect(hex(dark, '--color-bg-field')).toBe('#052b29');
    for (const name of ['--color-bg-field-active', '--color-text-on-field', '--color-text-on-field-muted', '--color-icon-on-field', '--color-border-on-field', '--color-border-control', '--color-border-focus', '--color-meter-fill', '--color-status-danger', '--color-status-warning']) {
      for (const theme of [light, dark]) expect(hex(theme, name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('semantic colours point at primitives; only overlays carry their own alpha colour', () => {
    for (const [name, value] of [...light, ...darkOwn]) {
      if (!name.startsWith('--color-')) continue;
      const ok = /^var\(--[a-z]+-\d+\)$/.test(value) || (/^--color-(overlay-|[a-z]+-on-media)/.test(name) && /^rgb\(/.test(value));
      expect(ok, `${name}: ${value}`).toBe(true);
    }
  });

  it('the dark theme sets every themed colour itself — none is left to inherit the light value by accident', () => {
    const themeIndependent = /^--color-(overlay-|[a-z]+-on-media)/; // over media: the media does not change with the theme
    const inherited = [...light.keys()].filter((k) => k.startsWith('--color-') && !themeIndependent.test(k) && !darkOwn.has(k));
    expect(inherited).toEqual([]);
  });

  it('text and controls clear WCAG contrast in both themes', () => {
    const pairs: [fg: string, bg: string, min: number][] = [
      ['--color-text-primary', '--color-bg-app', 4.5],
      ['--color-text-primary', '--color-bg-surface', 4.5],
      ['--color-text-secondary', '--color-bg-surface', 4.5],
      ['--color-text-secondary', '--color-bg-subtle', 4.5],
      ['--color-text-secondary', '--color-bg-component', 4.5],
      ['--color-text-tertiary', '--color-bg-surface', 4.5],
      ['--color-text-tertiary', '--color-bg-app', 4.5],
      ['--color-text-tertiary', '--color-bg-component', 3], // disabled controls
      ['--color-text-on-accent', '--color-bg-accent', 4.5],
      ['--color-text-on-accent', '--color-bg-accent-hover', 4.5],
      ['--color-text-accent', '--color-bg-surface', 4.5],
      ['--color-text-accent', '--color-bg-app', 4.5],
      ['--color-text-accent', '--color-bg-accent-subtle', 4.5],
      ['--color-text-danger', '--color-bg-surface', 4.5],
      ['--color-text-danger', '--color-bg-danger-subtle', 4.5],
      ['--color-text-warning', '--color-bg-warning-subtle', 4.5],
      ['--color-text-success', '--color-bg-success-subtle', 4.5],
      ['--color-text-on-field', '--color-bg-field', 4.5],
      ['--color-text-on-field-muted', '--color-bg-field', 4.5],
      ['--color-text-on-field', '--color-bg-field-active', 4.5],
      ['--color-text-inverse', '--color-bg-inverse', 4.5],
      // non-text: borders of controls, focus, meters, status marks (1.4.11)
      ['--color-border-control', '--color-bg-surface', 3],
      ['--color-border-control', '--color-bg-app', 3],
      ['--color-border-focus', '--color-bg-surface', 3],
      ['--color-border-focus', '--color-bg-app', 3],
      ['--color-border-focus-on-field', '--color-bg-field', 3],
      ['--color-border-focus-on-field', '--color-bg-field-active', 3],
      ['--color-meter-fill', '--color-bg-surface', 3],
      ['--color-meter-fill', '--color-bg-component', 3],
      ['--color-status-danger', '--color-bg-surface', 3],
      ['--color-status-warning', '--color-bg-surface', 3],
      ['--color-icon-secondary', '--color-bg-surface', 3],
      ['--color-icon-on-field', '--color-bg-field', 3],
      ['--color-bg-accent', '--color-bg-field', 3], // the count pill and the active mark on the sidebar
    ];
    const below: string[] = [];
    for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
      for (const [fg, bg, min] of pairs) {
        const c = contrast(theme, fg, bg);
        if (c < min) below.push(`${name}: ${fg} on ${bg} = ${c.toFixed(2)} (< ${min})`);
      }
    }
    expect(below).toEqual([]);
  });

  it('asks only for the three weights that have a face — 500 and 600 would silently fall to 400 and 700', () => {
    const wrong: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(css|tsx)$/.test(x) && !x.endsWith('styles/fonts.css'))) {
      const text = stripComments(readFileSync(f, 'utf8'));
      const found = f.endsWith('.css')
        ? [...text.matchAll(/font-weight\s*:\s*([^;}]+)/g), ...text.matchAll(/font\s*:\s*(\d{3})\s/g)]
        : [...text.matchAll(/fontWeight\s*:\s*['"]?(\w+)/g)];
      for (const m of found) if (!/^(400|700|800|inherit|normal|bold)$/.test(m[1]!.trim())) wrong.push(`${m[1]!.trim()} in ${f.slice(SRC.length + 1)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('sets type only in the sizes of the scale', () => {
    const scale = new Set([13, 14, 15, 16, 17, 18, 22, 28, 34, 36, 48, 60, 64]);
    const wrong: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(css|tsx)$/.test(x))) {
      const text = stripComments(readFileSync(f, 'utf8'));
      const found = f.endsWith('.css')
        ? [...text.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g), ...text.matchAll(/font\s*:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)]
        : [...text.matchAll(/fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)/g)];
      for (const m of found) if (!scale.has(Number(m[1]))) wrong.push(`${m[1]}px in ${f.slice(SRC.length + 1)}`);
    }
    expect([...new Set(wrong)].sort()).toEqual([]);
  });

  it('keeps brand and status colour out of the components: only black and white may be written literally', () => {
    // black and white (with any alpha) are what sits over media; everything else has a token
    const neutralRgb = /^rgba?\(\s*(0[\s,]+0[\s,]+0|255[\s,]+255[\s,]+255)\b/;
    const wrong: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(css|tsx)$/.test(x))) {
      const rel = f.slice(SRC.length + 1);
      if (rel === 'styles/tokens.css' || rel.startsWith('app/(dev)/')) continue; // the dev gallery fakes a photo with a gradient
      const text = stripComments(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) if (!/^#(fff|ffffff|000|000000)$/i.test(m[0]) && (f.endsWith('.css') || /['"`]#/.test(text.slice(m.index - 1, m.index + 1)))) wrong.push(`${m[0]} in ${rel}`);
      for (const m of text.matchAll(/rgba?\([^)]*\)/g)) if (!neutralRgb.test(m[0])) wrong.push(`${m[0]} in ${rel}`);
    }
    expect([...new Set(wrong)].sort()).toEqual([]);
  });

  it('components speak in semantic tokens: a primitive is named only inside tokens.css', () => {
    const direct: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(css|tsx?)$/.test(x) && !x.endsWith('styles/tokens.css'))) {
      for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/var\(\s*(--(?:neutral|turquoise|red|amber)-\d+)/g)) direct.push(`${m[1]} in ${f.slice(SRC.length + 1)}`);
    }
    expect(direct).toEqual([]);
  });

  it('the copy of the tokens beside DESIGN.md is the same file', () => {
    expect(readFileSync(join(SRC, '../docs/design/tokens.css'), 'utf8')).toBe(read('styles/tokens.css'));
  });

  it('spacing keeps its pixel names (Figma calls the same steps by index; the names must not be ported)', () => {
    for (const px of [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]) expect(light.get(`--space-${px}`)).toBe(`${px}px`);
  });

  it('radii follow the brand: control 6, card 10, panel 14, dialog 20', () => {
    expect([light.get('--radius-control'), light.get('--radius-card'), light.get('--radius-panel'), light.get('--radius-dialog')]).toEqual(['6px', '10px', '14px', '20px']);
  });
});
