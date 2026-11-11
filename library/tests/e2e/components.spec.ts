import { test, expect, type Page, type Request } from '@playwright/test';

// The identity, held to the rendered page (Figma 8emMB8oGRIgHxxnnun408G): every component in AR + TR × light +
// dark; dir is right; the faces that are computed and really drawn are Zain, Outfit and Geist Mono; and not a
// single request leaves for an external font host.
test('components page: direction, fonts, no external requests', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r: Request) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(baseURL!).origin && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) external.push(r.url());
  });
  await page.goto('/dev/components');
  await page.evaluate(() => document.fonts.ready);

  for (const [loc, dir, family] of [['ar', 'rtl', 'Zain'], ['tr', 'ltr', 'Outfit']] as const) {
    for (const theme of ['light', 'dark']) {
      const panel = page.getByTestId(`panel-${loc}-${theme}`);
      await expect(panel).toHaveAttribute('dir', dir);
      await expect(panel).toHaveAttribute('lang', loc);
      const computed = await panel.locator('h2').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(computed.split(',')[0]?.replace(/"/g, '').trim()).toBe(family);
    }
  }
  // the face is really loaded (not just named): document.fonts reports it for the glyphs we use
  const loaded = await page.evaluate(() => {
    const n = (family: string) => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === family && f.status === 'loaded').length;
    return {
      ar: document.fonts.check('16px "Zain"', 'مكتبة 2026'),
      tr: document.fonts.check('16px "Outfit"', 'ĞğŞşİı'),
      mono: document.fonts.check('13px "Geist Mono"', 'IMG_1024.jpg'),
      zain: n('Zain'), outfit: n('Outfit'), geist: n('Geist Mono'),
    };
  });
  expect(loaded.ar && loaded.tr && loaded.mono).toBe(true);
  expect(loaded.zain).toBeGreaterThan(0);
  expect(loaded.outfit).toBeGreaterThan(0);
  expect(loaded.geist).toBeGreaterThan(0);

  expect(external, 'no request may leave the origin').toEqual([]);
});

/**
 * The faces the browser really used to draw the text under `selector`, with how many glyphs each drew (Chromium's
 * own answer). Chromium reports a node together with two levels under it, so every element is asked in turn; a
 * glyph is therefore counted more than once, which is fine for "none is a stray" and for comparing two faces.
 */
async function drawnFonts(page: Page, selector: string): Promise<{ family: string; custom: boolean; glyphs: number }[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId: scope } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: scope, selector: '*:not(svg):not(svg *)' });
  const out: { family: string; custom: boolean; glyphs: number }[] = [];
  for (const nodeId of [scope, ...nodeIds]) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    for (const f of fonts) out.push({ family: f.familyName, custom: f.isCustomFont, glyphs: f.glyphCount });
  }
  await cdp.detach();
  return out;
}

test('no glyph is drawn by a system font: Turkish letters come from Outfit, Arabic and digits from Zain', async ({ page }) => {
  await page.goto('/dev/components');
  await page.evaluate(() => document.fonts.ready);
  // the shortcut hint draws ⌘, which belongs to the platform; everything else is ours to draw
  await page.addStyleTag({ content: 'kbd { display: none !important; }' });
  for (const [panel, lead, other] of [['panel-ar-light', 'Zain', 'Outfit'], ['panel-tr-light', 'Outfit', 'Zain']] as const) {
    const fonts = await drawnFonts(page, `[data-testid="${panel}"]`);
    const strays = fonts.filter((f) => !f.custom || !/^(Zain|Outfit|Geist Mono)\b/.test(f.family));
    expect(strays, `${panel}: every glyph must come from a bundled face`).toEqual([]);
    const glyphs = (family: string) => fonts.filter((f) => f.family.startsWith(family)).reduce((n, f) => n + f.glyphs, 0);
    expect(glyphs(lead), `${panel} is set mostly in ${lead}`).toBeGreaterThan(200);
    expect(glyphs(lead)).toBeGreaterThan(glyphs(other));
  }
  // the specimen carries Ğ ğ Ş ş İ ı — the letters Zain lacks — and nothing but Outfit may draw them;
  // it is set bold, so the cut that draws it is the bold one, not a synthesised regular
  const specimen = page.getByTestId('panel-tr-light').getByTestId('type-specimen');
  await expect(specimen).toContainText(/Ğ.*ğ.*Ş.*ş.*İ.*ı/);
  const cuts = async (panel: string) => [...new Set((await drawnFonts(page, `[data-testid="${panel}"] [data-testid="type-specimen"]`)).map((f) => f.family))].sort();
  expect(await cuts('panel-tr-light')).toEqual(['Outfit ExtraBold']);
  // the same line inside the Arabic panel: Arabic and digits in Zain, the Latin words in Outfit, at the same weight
  expect(await cuts('panel-ar-light')).toEqual(['Outfit ExtraBold', 'Zain ExtraBold']);
});

test('the action colour, the deep field and the mark are the brand\'s, in both themes', async ({ page }) => {
  await page.goto('/dev/components');
  const css = (testid: string, name: RegExp | string, prop: string) =>
    page.getByTestId(testid).getByRole('button', { name }).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  for (const theme of ['light', 'dark']) {
    const id = `panel-ar-${theme}`;
    expect(await css(id, 'إنشاء رابط', 'background-color'), `${theme} primary`).toBe('rgb(48, 206, 197)');
    expect(await css(id, 'إنشاء رابط', 'color'), `${theme} primary text`).toBe('rgb(14, 14, 14)');
    expect(await css(id, 'إنشاء رابط', 'font-weight')).toBe('700');
    // disabled says so with colour, not opacity
    expect(await css(id, 'حفظ', 'opacity')).toBe('1');
    expect(await css(id, 'حفظ', 'background-color')).not.toBe('rgb(48, 206, 197)');
    // the selected tab sits on the deep field
    const tab = page.getByTestId(id).getByRole('radio', { checked: true }).first();
    expect(await tab.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(theme === 'light' ? 'rgb(10, 95, 91)' : 'rgb(5, 43, 41)');
    // the mark: an upright 9:16 frame holding four rungs
    const mark = page.getByTestId(id).locator('svg[data-brand-glyph]').first();
    const box = (await mark.boundingBox())!;
    expect(box.height / box.width).toBeCloseTo(48 / 27, 1);
    await expect(mark.locator('rect')).toHaveCount(5);
  }
});

test('html dir/lang come from the server', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'locale', value: 'tr', url: baseURL! }]);
  const res = await page.request.get('/dev/components', { headers: { cookie: 'locale=tr' } });
  const html = await res.text();
  expect(html).toMatch(/<html[^>]*lang="tr"[^>]*dir="ltr"/);
  const res2 = await page.request.get('/dev/components', { headers: { cookie: 'locale=ar' } });
  expect(await res2.text()).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
});

test('PIN cells never mirror and accept Arabic-Indic digits', async ({ page }) => {
  await page.goto('/dev/components');
  const group = page.getByTestId('panel-ar-light').getByRole('group').first();
  await expect(group).toHaveAttribute('dir', 'ltr');
  const cells = group.locator('input');
  await cells.nth(0).click();
  await page.keyboard.insertText('٤٨٢٧');
  await expect(cells.nth(0)).toHaveValue('4');
  await expect(cells.nth(3)).toHaveValue('7');
  const xs = await cells.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect([...xs].sort((a, b) => a - b)).toEqual(xs); // first digit is leftmost even in RTL
});

test('search field: icon and shortcut hint sit on opposite sides in both directions', async ({ page }) => {
  await page.goto('/dev/components');
  for (const panel of ['panel-ar-light', 'panel-tr-light']) {
    const field = page.getByTestId(panel).locator('kbd').first();
    const icon = page.getByTestId(panel).locator('svg.lucide-search').first();
    const k = (await field.boundingBox())!; const i = (await icon.boundingBox())!;
    const overlap = !(k.x + k.width <= i.x || i.x + i.width <= k.x);
    expect(overlap, `${panel}: ⌘K must not sit on the search icon`).toBe(false);
  }
});
