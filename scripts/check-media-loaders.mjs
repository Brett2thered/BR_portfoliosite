import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

// Usage: node scripts/check-media-loaders.mjs [baseUrl] [outputDir]
// Serve export/ first, e.g. `python3 -m http.server 4173 --directory export`.
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outputDir = process.argv[3] || '/private/tmp/br-media-loaders';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(outputDir, { recursive: true });

const pages = ['doc-ai.html', 'levels.html', 'fb.html', 'anchormaps.html', 'navdy.html'];
const stubFrame = '<!doctype html><title>stub</title><body style="margin:0;background:#222"></body>';
const isMedia = (request) => ['image', 'media'].includes(request.resourceType()) ||
  /\.(mp4|webm|png|jpe?g|webp|gif)(\?|$)/i.test(request.url());
const isEmbed = (request) => request.resourceType() === 'document' && request.frame().parentFrame();

const snapshot = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-br-media],[data-br-media-self]')).map((el) => {
  const rect = el.getBoundingClientRect();
  return { state: el.getAttribute('data-br-media') || el.getAttribute('data-br-media-self'), width: rect.width, height: rect.height, children: el.children.length };
}));

for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    for (const mobile of [false, true]) {
      const label = `${engineName}-${mobile ? 'mobile' : 'desktop'}`;
      for (const file of pages) {
        const context = await browser.newContext(mobile
          ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
          : { viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        await page.route('**/*', async (route) => {
          const request = route.request();
          if (isEmbed(request)) { await held; return route.fulfill({ contentType: 'text/html', body: stubFrame }).catch(() => {}); }
          if (isMedia(request)) await held;
          return route.continue().catch(() => {});
        });

        await page.goto(`${baseUrl}/${file}`, { waitUntil: 'commit' });
        await page.waitForFunction(() => window.__brMediaLoaders && document.querySelector('[data-br-media="loading"]'), null, { timeout: 15000 });
        await page.waitForTimeout(600);

        const loading = await snapshot(page);
        assert.ok(loading.length > 0, `${label} ${file}: placeholders must show while media is held`);
        assert.ok(loading.every((item) => item.state === 'loading'), `${label} ${file}: every placeholder is in the loading state`);
        assert.ok(loading.every((item) => item.children === 1), `${label} ${file}: no nodes may be inserted next to the media (React hydration)`);
        const mediaCount = await page.evaluate(() => document.querySelectorAll('iframe:not([src*="framer.com/edit"]), video, img[src]:not([src$=".svg"])').length);
        assert.ok(loading.length >= 1 && loading.length <= mediaCount, `${label} ${file}: one placeholder per media wrapper`);
        await page.screenshot({ path: join(outputDir, `${label}-${file.replace('.html', '')}-loading.png`) });

        release();
        // Offscreen embeds are deferred until they are near the viewport, so scroll through the page.
        await page.evaluate(async () => {
          for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        });
        await page.waitForFunction(() => !document.querySelector('[data-br-media="loading"],[data-br-media-self]'), null, { timeout: 45000 });
        await page.waitForFunction(() => !document.querySelector('[data-br-media],[data-br-media-kind],[aria-busy]'), null, { timeout: 15000 });
        const leftovers = await page.evaluate(() => ({
          attrs: document.querySelectorAll('[data-br-media],[data-br-media-kind],[aria-busy]').length,
        }));
        assert.equal(leftovers.attrs, 0, `${label} ${file}: placeholder state must be fully cleaned up after loading`);
        await page.screenshot({ path: join(outputDir, `${label}-${file.replace('.html', '')}-loaded.png`) });
        console.log(`${label} ${file}: ${loading.length} placeholder(s) shown, stable, cleaned up`);
        await context.close();
      }
    }

    // Failure and reduced-motion behaviour.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const failing = await context.newPage();
    await failing.route('**/*', (route) => {
      const request = route.request();
      if (/\.(mp4|webm|png|jpe?g|webp|gif)(\?|$)/i.test(request.url()) && !/favicon/.test(request.url())) return route.abort();
      return route.continue().catch(() => {});
    });
    await failing.goto(`${baseUrl}/anchormaps.html`, { waitUntil: 'domcontentloaded' });
    await failing.waitForSelector('[data-br-media="error"]', { timeout: 20000 });
    const errorLook = await failing.evaluate(() => ({
      label: document.querySelector('.br-ascii-error')?.textContent,
      busy: document.querySelector('[data-br-media="error"]')?.getAttribute('aria-busy'),
      canvases: document.querySelectorAll('.br-ascii-panel canvas').length,
    }));
    assert.equal(errorLook.label, 'Preview unavailable');
    assert.equal(errorLook.busy, 'false');
    assert.equal(errorLook.canvases, 0, 'reduced motion/error must not animate');
    console.log(`${engineName}: failed media shows a clean fallback and reduced motion stops the shimmer`);

    // A wrapper that holds other content must never be covered.
    const mixed = await context.newPage();
    let releaseMixed;
    const heldMixed = new Promise((resolve) => { releaseMixed = resolve; });
    await mixed.route('**/slow.png', async (route) => { await heldMixed; return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }); });
    await mixed.goto(`${baseUrl}/about.html`, { waitUntil: 'domcontentloaded' });
    await mixed.evaluate(() => {
      const box = document.createElement('div');
      box.innerHTML = '<img src="/slow.png" width="100" height="100"><p id="sibling">Caption</p>';
      document.body.appendChild(box);
    });
    await mixed.waitForSelector('img[data-br-media-self="loading"]');
    assert.equal(await mixed.locator('[data-br-media]').count(), 0, 'shared wrapper must not get a wrapper-wide placeholder');
    releaseMixed();
    await mixed.waitForFunction(() => !document.querySelector('[data-br-media-self]'));
    console.log(`${engineName}: shared wrappers fall back to the media element's own shimmer`);
    await context.close();
  } finally {
    await browser.close();
  }
}
