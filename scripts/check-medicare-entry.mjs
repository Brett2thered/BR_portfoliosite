import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-medicare-entry';
await mkdir(output, { recursive:true });
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
for (const [engine, type] of Object.entries({chromium, webkit})) {
  const browser = await type.launch();
  try {
    for (const width of [420, 900, 1440]) {
      const page = await browser.newPage({ viewport:{width, height:1000} });
      await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame()
        ? route.fulfill({contentType:'text/html', body:'<!doctype html>'}) : route.continue().catch(() => {}));
      await page.goto(`${base}/?preview=medicare#medicare`, {waitUntil:'domcontentloaded'});
      const card = page.locator('[data-framer-name="Medicare"]');
      assert.equal(await card.getAttribute('id'), 'medicare', 'Medicare must have a stable direct-entry anchor');
      await card.locator('.br-medicare-preload').evaluate((image) => image.decode());
      await page.waitForFunction(() => {
        const card = document.getElementById('medicare');
        const rect = card.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= -1 && rect.top < innerHeight * .5;
      });
      assert.equal(await card.getAttribute('data-motion'), 'playing');
      await page.screenshot({path:join(output, `${engine}-${width}.png`)});
      console.log(`${engine} ${width}px: direct preview opens with the visible, animated Medicare card`);
      await page.close();
    }
  } finally { await browser.close(); }
}
