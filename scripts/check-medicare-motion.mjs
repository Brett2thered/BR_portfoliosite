import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-medicare-motion';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(output, { recursive:true });
const results = [];
for (const [engine, type] of Object.entries({chromium, webkit})) {
  const browser = await type.launch();
  try {
    for (const width of [420, 1440]) {
      const page = await browser.newPage({ viewport:{width, height:1000} });
      await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame()
        ? route.fulfill({ contentType:'text/html', body:'<!doctype html>' }) : route.continue().catch(() => {}));
      await page.goto(base, { waitUntil:'domcontentloaded' });
      const card = page.locator('[data-framer-name="Medicare"]');
      await card.scrollIntoViewIfNeeded();
      await card.locator('.br-medicare-preload').evaluate((image) => image.decode());
      await page.waitForFunction(() => document.querySelector('[data-framer-name="Medicare"]').dataset.motion === 'playing');
      assert.equal(await card.evaluate((el) => getComputedStyle(el).borderRadius), width < 834 ? '10px' : '20px');
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => document.querySelector('[data-framer-name="Medicare"]').dataset.motion === 'paused');
      const stopped = await card.evaluate(async (el) => {
        const animation = el.querySelector('.br-medicare-collage').getAnimations()[0];
        await animation.ready; return animation.currentTime;
      });
      await page.waitForTimeout(200);
      assert.equal(await card.evaluate((el) => el.querySelector('.br-medicare-collage').getAnimations()[0].currentTime), stopped);
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-framer-name="Medicare"]').dataset.motion === 'playing');
      const states = [];
      for (const time of [0, 4500, 9000]) {
        states.push(await card.evaluate(async (el, time) => {
          const layers = [...el.querySelectorAll('.br-medicare-collage,.br-medicare-people,.br-medicare-id')];
          const animations = layers.flatMap((layer) => layer.getAnimations());
          animations.forEach((animation) => { animation.pause(); animation.currentTime = time; });
          await Promise.all(animations.map((animation) => animation.ready));
          return layers.map((layer) => ({ transform:getComputedStyle(layer).transform, duration:layer.getAnimations()[0].effect.getTiming().duration,
            iterations:layer.getAnimations()[0].effect.getTiming().iterations === Infinity }));
        }, time));
        await card.screenshot({ path:join(output, `${engine}-${width}-phase-${time}.png`) });
      }
      assert.deepEqual(states[0], states[2], 'End of loop must exactly meet its start');
      assert.notDeepEqual(states[0], states[1], 'Layers must move through the middle of the loop');
      assert.ok(states[0].every((state) => state.duration === 9000 && state.iterations));
      results.push(`${engine} ${width}px: rounded card, offscreen suspension, resume, 3 moving layers and exact seamless 9-second loop passed`);
      console.log(results.at(-1));
      await page.close();
    }
  } finally { await browser.close(); }
}
await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
