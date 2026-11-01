import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-medicare';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(output, { recursive: true });
const results = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of [320, 420, 900, 1440, 2560]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 834, hasTouch: width < 834 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => { if (page.url().includes('/medicare.html')) errors.push(error.message); });
      // Leave the actual local Medicare prototype intact; isolate unrelated remote media.
      await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame() && !route.request().url().includes('/prototypes/medicare/')
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }) : route.continue().catch(() => {}));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__brTheme);
      const card = page.locator('[data-framer-name="Medicare"]');
      assert.equal(await card.count(), 1, 'Homepage must include the new Medicare card');
      await card.scrollIntoViewIfNeeded();
      await card.locator('.br-medicare-preload').evaluate((img) => img.decode());
      assert.equal(await card.getAttribute('data-br-id'), '27');
      assert.equal(await page.locator('[data-br-id]').evaluateAll((cards) => cards.filter((c) => c.offsetWidth && c.offsetHeight).length), 27);
      if (width < 834) assert.deepEqual(await page.locator('[data-br-mobile-order]').evaluateAll((cards) => cards.slice(0, 10).map((c) => c.dataset.brId)), ['1','3','20','2','18','9','14','25','19','27']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const art = card.locator('.br-medicare-collage');
      // WebKit can retain the previous page's pointer position. Hover now
      // intentionally pauses this loop, so explicitly test the default face.
      await page.mouse.move(0, 0);
      await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(3000)]);
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.getElementById('medicare').dataset.motion === 'playing');
      const before = await art.evaluate((el) => getComputedStyle(el).transform);
      await page.waitForTimeout(700);
      assert.notEqual(await art.evaluate((el) => getComputedStyle(el).transform), before, 'Hero loop must move');
      assert.equal(await card.locator('button,.br-medicare-caption').count(), 0);
      await page.screenshot({ path: join(output, `${engine}-${width}-card.png`) });
      const link = card.getByRole('link', { name: 'Explore the Medicare project' });
      assert.equal(await link.getAttribute('href'), 'medicare.html');
      // Keep 420px as a full-motion flow in both engines; also exercise the
      // complete reduced-motion experience at the other viewport sizes.
      if (width !== 420) await page.emulateMedia({ reducedMotion: 'reduce' });
      await link.focus(); await link.press('Enter');
      await page.waitForURL(`${base}/medicare.html`);
      const copy = await page.locator('main').innerText();
      for (const text of ['National Design Studio', '30-plus steps', 'five questions']) assert.ok(copy.includes(text), text);
      const embed = page.locator('#medicare-prototype');
      assert.equal(await embed.getAttribute('sandbox'), 'allow-scripts allow-modals');
      assert.ok((await embed.getAttribute('title')).includes('Medicare'));
      // WebKit does not load an offscreen lazy iframe until it approaches view.
      await embed.scrollIntoViewIfNeeded();
      const demo = page.frameLocator('#medicare-prototype');
      await demo.locator('#active-node .opt').first().waitFor();
      assert.ok((await demo.locator('.gov-banner').innerText()).includes('Portfolio prototype'));
      assert.equal(await demo.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await demo.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Prototype must fit the mobile iframe');
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: join(output, `${engine}-${width}-page.png`), fullPage: true });
      await demo.locator('[data-node="timing"][data-pick="turning"]').click();
      await demo.locator('[data-node="birthmonth"][data-pick]').first().click();
      await demo.locator('[data-node="ss"][data-pick="no"]').click();
      await demo.locator('[data-node="working"][data-pick="none"]').click();
      await demo.locator('[data-node="coverage"][data-pick="original"]').click();
      await demo.getByLabel('Search for a drug', { exact: true }).fill('Met');
      await demo.locator('#typeahead button').filter({ hasText: 'Metformin' }).click();
      assert.ok((await demo.locator('.ds-chips').innerText()).includes('Metformin'));
      await demo.locator('[data-node="drugs"][data-pick="__go"]').click();
      await demo.locator('.plan.lit').first().click();
      await demo.locator('[data-node="savings"][data-pick="later"]').click();
      await demo.locator('.route-head h2').waitFor();
      assert.ok((await demo.locator('.route-head h2').innerText()).includes('steps'));
      await page.screenshot({ path: join(output, `${engine}-${width}-route.png`) });
      await demo.locator('#restart').click();
      await demo.locator('[data-node="timing"][data-pick="already"]').click();
      await demo.locator('[data-node="ss"][data-pick="yes"]').click();
      await demo.locator('[data-node="working"][data-pick="large"]').click();
      await demo.locator('[data-node="partb"][data-pick="delay"]').click();
      await demo.locator('[data-edit="working"]').click();
      await demo.locator('[data-node="working"][data-pick="none"]').waitFor();
      await page.getByRole('button', { name: 'Restart prototype', exact: true }).click();
      await demo.locator('[data-node="timing"][data-pick="turning"]').waitFor();
      await demo.locator('#header-chat').click();
      await demo.locator('.panel input').waitFor();
      assert.deepEqual(errors, []);
      assert.equal(context.pages().length, 1);
      results.push(`${engine} ${width}px: 27 cards, animated hero, clean card, keyboard navigation, safe embed, full route, medication search, edit, alternate branch, reset and help passed`);
      console.log(results.at(-1));
      await context.close();
    }
    const reduced = await browser.newPage({ viewport: { width: 420, height: 1000 }, reducedMotion: 'reduce' });
    await reduced.goto(base, { waitUntil: 'domcontentloaded' });
    const art = reduced.locator('.br-medicare-collage');
    await art.scrollIntoViewIfNeeded();
    assert.equal(await art.evaluate((el) => getComputedStyle(el).animationName), 'none');
    await reduced.close();
    const noJs = await browser.newPage({ viewport: { width: 420, height: 1000 }, javaScriptEnabled: false });
    await noJs.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await noJs.getByRole('link', { name: 'Explore the Medicare project' }).count(), 1);
    await noJs.goto(`${base}/medicare.html`);
    assert.ok((await noJs.locator('main').innerText()).includes('National Design Studio'));
    assert.ok(await noJs.locator('iframe').isVisible());
    await noJs.close();
  } finally { await browser.close(); }
}
await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
