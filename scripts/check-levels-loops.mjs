import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, isMobile: width === 390 });
      await page.route('https://www.loom.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
      await page.goto(new URL('/levels.html', base).href, { waitUntil: 'domcontentloaded' });
      const demos = await page.locator('img[src$=".gif"], video').all();
      assert.equal(demos.length, 4);

      for (const demo of demos) {
        // Scroll vertically as a visitor would. Locator screenshots can pan a clipped ancestor.
        const fits = await demo.evaluate(el => {
          const rect = el.getBoundingClientRect();
          window.scrollBy(0, rect.top - (innerHeight - rect.height) / 2);
          return rect.left >= 0 && rect.right <= innerWidth && rect.height > 0;
        });
        assert.ok(fits, 'The whole demo must be reachable by scrolling down');
        await demo.evaluate(el => el.tagName === 'IMG' ? el.decode() : undefined);
        const handle = await demo.elementHandle();
        await page.waitForFunction(el => {
          if (el.closest('[data-br-media], [data-br-media-self]')) return false;
          return el.tagName === 'IMG' || (!el.paused && el.currentTime > 0);
        }, handle);
        const visible = await demo.evaluate(el => {
          for (let node = el; node; node = node.parentElement) {
            if (getComputedStyle(node).opacity === '0') return false;
          }
          return getComputedStyle(el).visibility === 'visible';
        });
        assert.ok(visible, 'Loaded demos must be visible through their enclosing sections');

        const first = await demo.screenshot();
        // The original GIFs intentionally hold individual frames for up to four seconds.
        let changed = false;
        for (let sample = 0; sample < 12 && !changed; sample++) {
          await page.waitForTimeout(500);
          changed = !first.equals(await demo.screenshot());
        }
        assert.ok(changed, 'The visible demo must advance to another frame');
      }
      console.log(`${engine.name()} ${width}px: all four Levels demos fit and animate`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
