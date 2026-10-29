import { test, expect, type Request } from '@playwright/test';

// M0 acceptance (PROMPT §5): every component in AR + TR × light + dark; dir is right; the font
// that is actually computed is Plex; and not a single request leaves for an external font host.
test('components page: direction, fonts, no external requests', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r: Request) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(baseURL!).origin && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) external.push(r.url());
  });
  await page.goto('/dev/components');
  await page.evaluate(() => document.fonts.ready);

  for (const [loc, dir, family] of [['ar', 'rtl', 'IBM Plex Sans Arabic'], ['tr', 'ltr', 'IBM Plex Sans']] as const) {
    for (const theme of ['light', 'dark']) {
      const panel = page.getByTestId(`panel-${loc}-${theme}`);
      await expect(panel).toHaveAttribute('dir', dir);
      await expect(panel).toHaveAttribute('lang', loc);
      const computed = await panel.locator('h2').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(computed.split(',')[0]?.replace(/"/g, '').trim()).toBe(family);
    }
  }
  // the face is really loaded (not just named): document.fonts reports it for the glyphs we use
  const loaded = await page.evaluate(() => ({
    ar: document.fonts.check('16px "IBM Plex Sans Arabic"', 'مكتبة'),
    tr: document.fonts.check('16px "IBM Plex Sans"', 'Ğİş'),
    arStatus: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'IBM Plex Sans Arabic' && f.status === 'loaded').length,
    trStatus: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'IBM Plex Sans' && f.status === 'loaded').length,
  }));
  expect(loaded.ar && loaded.tr).toBe(true);
  expect(loaded.arStatus).toBeGreaterThan(0);
  expect(loaded.trStatus).toBeGreaterThan(0);

  expect(external, 'no request may leave the origin').toEqual([]);
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
