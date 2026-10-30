import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outputDir = process.argv[3] || '/private/tmp/br-card-loaders';
// A deliberately held media queue can also queue WebKit's font requests.
// Capture that real loading state instead of waiting for the fonts to finish.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(outputDir, { recursive: true });

for (const [name, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true });
    let release;
    const pendingMedia = new Promise((resolve) => { release = resolve; });
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (['image', 'media'].includes(request.resourceType()) ||
        /\.(mp4|webm|png|jpe?g|webp|gif)(\?|$)/i.test(request.url()) ||
        request.url().includes('player.vimeo.com/video/')) {
        await pendingMedia;
      }
      await route.continue().catch(() => {});
    });
    // WebKit can defer the main document's lifecycle event while a held
    // cross-origin iframe loads. Inspect the rendered skeletons as soon as
    // the site's own scripts are ready, before that lifecycle delay.
    await page.goto(baseUrl, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-media-state="loading"]'));
    await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(3000)]);

    const readCards = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-br-mobile-order]')).map((card) => {
      const rect = card.getBoundingClientRect();
      return { id: card.dataset.brId, width: rect.width, height: rect.height };
    }));
    const before = await readCards();
    for (const card of ['Brett Player', 'Cloud People', 'Anchor Player', 'New Project']) {
      assert.equal(await page.locator(`[data-framer-name="${card}"]`).getAttribute('data-br-media-state'), 'loading', `${name}: ${card} must have a skeleton while media is held`);
    }
    assert.equal(await page.locator('[data-br-name="Intro"] .br-card-ghost').count(), 0, 'Text must be visible immediately');
    assert.equal(await page.locator('.br-ascii-panel').first().evaluate((ghost) => getComputedStyle(ghost).pointerEvents), 'none');
    await page.screenshot({ path: join(outputDir, `${name}-loading.png`) });

    release();
    for (const card of ['Brett Player', 'Cloud People', 'Anchor Player', 'New Project']) {
      await page.waitForFunction((selector) => document.querySelector(selector).dataset.brMediaState === 'ready',
        `[data-framer-name="${card}"]`, { timeout: 30000 });
    }
    await page.waitForTimeout(300);
    const after = await readCards();
    assert.equal(before.length, after.length);
    before.forEach((card, index) => {
      assert.equal(card.id, after[index].id, 'Loading must not reorder cards');
      assert.ok(Math.abs(card.height - after[index].height) < 1, `${card.id}: loader must not change card height`);
      assert.ok(Math.abs(card.width - after[index].width) < 1, `${card.id}: loader must not change card width`);
    });
    await page.screenshot({ path: join(outputDir, `${name}-loaded.png`) });

    const reduced = await browser.newPage({ viewport: { width: 420, height: 912 }, reducedMotion: 'reduce' });
    await reduced.route('**/assets/**', async (route) => {
      if (['image', 'media'].includes(route.request().resourceType()) ||
        /\.(mp4|webm|png|jpe?g|webp|gif)(\?|$)/i.test(route.request().url())) return route.abort();
      await route.continue();
    });
    await reduced.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const cloud = reduced.locator('[data-framer-name="Cloud People"]');
    await reduced.waitForFunction(() => document.querySelector('[data-framer-name="Cloud People"]').dataset.brMediaState === 'error');
    assert.equal(await cloud.getAttribute('aria-busy'), 'false', 'Failed media must stop loading');
    const errorPanel = reduced.locator('.br-ascii-panel[data-br-ascii-for="Cloud People"]');
    assert.equal(await errorPanel.locator('canvas').count(), 0, 'Reduced motion/error must not animate');
    assert.equal(await errorPanel.locator('.br-ascii-error').isVisible(), true, 'Failed previews must have a clean fallback');
    console.log(`${name}: loading placeholders, loaded media reveal, stable layout, reduced motion and failure fallback passed`);
  } finally {
    await browser.close();
  }
}
