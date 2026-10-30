import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outputDir = process.argv[3] || '/private/tmp/br-ascii-review';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(outputDir, { recursive: true });
const video = await readFile(new URL('../export/assets/img_9_boomerang.mp4', import.meta.url));
const cases = ['index.html', 'fb.html', 'levels.html', 'doc-ai.html', 'anchormaps.html', 'navdy.html'];
const summary = [];
const isVideo = (url) => /\.(mp4|webm)(\?|$)/i.test(url);
const isImage = (url) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
const frameHtml = '<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0;background:#eee;font:16px sans-serif;display:grid;place-content:center;height:100vh"><button>Play preview</button></body>';

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of [420, 1280]) {
      for (const file of cases) {
        const label = `${engine}-${width}-${file.replace('.html', '')}`;
        console.log(`Checking ${label}`);
        const context = await browser.newContext({
          viewport: { width, height: 912 }, isMobile: width < 834, hasTouch: width < 834,
          recordVideo: file === 'index.html' && width === 420 ? { dir: outputDir, size: { width, height: 912 } } : undefined,
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        await page.route('**/*', async (route) => {
          const request = route.request();
          if (request.resourceType() === 'document' && request.frame().parentFrame()) {
            await gate;
            return route.fulfill({ contentType: 'text/html', body: frameHtml }).catch(() => {});
          }
          if (isImage(request.url()) || isVideo(request.url()) || ['image', 'media'].includes(request.resourceType())) await gate;
          if (isVideo(request.url())) return route.fulfill({ contentType: 'video/mp4', body: video }).catch(() => {});
          return route.continue().catch(() => {});
        });
        await page.goto(`${baseUrl}/${file}`, { waitUntil: 'commit' });
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#main iframe,#main video,#main img')).some((el) => {
          const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;
        }));
        await page.evaluate(() => {
          const media = Array.from(document.querySelectorAll('#main iframe,#main video,#main img'))
            .find((el) => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; });
          const rect = media.getBoundingClientRect();
          if (rect.top > innerHeight - 100 || rect.bottom < 0) scrollTo(0, rect.top + scrollY - 150);
        });
        await page.waitForFunction(() => window.BRAscii && document.querySelector('.br-ascii-panel:not([hidden]) .ars-base'));
        await page.waitForTimeout(300);
        const loading = await page.evaluate(() => {
          const panel = document.querySelector('.br-ascii-panel:not([hidden])');
          const rect = panel.getBoundingClientRect();
          const media = [...document.querySelectorAll('#main iframe,#main video,#main img')];
          return {
            glyphs: panel.querySelector('.ars-base').textContent.trim().length,
            width: rect.width, height: rect.height,
            pointerEvents: getComputedStyle(panel).pointerEvents,
            insideFramer: !!panel.closest('#main'),
            mediaCount: media.length,
            shape: media.map((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; }),
            children: [...document.querySelectorAll('#main [data-br-media]')].map((el) => el.children.length),
            old: document.querySelectorAll('.br-card-ghost,[data-br-media-style]').length,
          };
        });
        assert.ok(loading.glyphs > 100 && loading.width > 0 && loading.height > 0, `${label}: visible ASCII skeleton`);
        assert.equal(loading.pointerEvents, 'none');
        assert.equal(loading.insideFramer, false, `${label}: overlay outside hydrated markup`);
        assert.equal(loading.old, 0, `${label}: old gray skeletons removed`);
        assert.ok(loading.children.every((count) => count === 1), `${label}: Framer wrappers stay unchanged`);
        await page.screenshot({ path: join(outputDir, `${label}-loading.png`) });
        const revealed = page.waitForFunction(() => !!document.querySelector('.br-ascii-panel[data-br-ascii-state="revealing"] .ar-overlay canvas'), null, { timeout: 15000 });
        release();
        await revealed;
        await page.screenshot({ path: join(outputDir, `${label}-decode.png`) });
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 550) {
            scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        });
        await page.waitForFunction(() => !document.querySelector('[data-br-deferred],[data-br-media="loading"],[data-br-media-self="loading"]'), null, { timeout: 20000 });
        await page.waitForFunction(() => !document.querySelector('.br-ascii-panel'), null, { timeout: 10000 })
          .catch(async (error) => { throw Error(label + ': remaining overlays ' + JSON.stringify(await page.locator('.br-ascii-panel').evaluateAll((panels) => panels.map((panel) => ({ for: panel.dataset.brAsciiFor, state: panel.dataset.brAsciiState })))) + '\n' + error.message); });
        const after = await page.evaluate(() => ({
          mediaCount: document.querySelectorAll('#main iframe,#main video,#main img').length,
          portalsInFramer: document.querySelectorAll('#main [data-br-ascii-portal]').length,
        }));
        assert.equal(after.mediaCount, loading.mediaCount, `${label}: media nodes not duplicated`);
        assert.equal(after.portalsInFramer, 0);
        assert.deepEqual(errors, [], `${label}: no script errors`);
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(100);
        await page.screenshot({ path: join(outputDir, `${label}-loaded.png`) });
        summary.push(`${label}: ASCII loading → canvas decode → clean media; original markup preserved`);
        console.log(summary.at(-1));
        await context.close();
      }
    }

    // Reduced-motion, media errors, missing engine, and cached media.
    for (const mode of ['reduced', 'error', 'engine-missing']) {
      const context = await browser.newContext({ viewport: { width: 420, height: 912 }, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (mode === 'engine-missing' && url.includes('/vendor/ascii-reveal/core.js')) return route.abort();
        if (isVideo(url) || isImage(url)) {
          if (mode === 'error') return route.abort();
          await gate;
          if (isVideo(url)) return route.fulfill({ contentType: 'video/mp4', body: video });
        }
        return route.continue().catch(() => {});
      });
      await page.goto(`${baseUrl}/anchormaps.html`, { waitUntil: 'commit' });
      await page.waitForFunction(() => window.BRAscii && document.querySelector('.br-ascii-panel'));
      if (mode === 'error') {
        await page.waitForSelector('.br-ascii-panel[data-br-ascii-state="error"]');
        assert.ok(await page.locator('.br-ascii-error').count());
      } else {
        if (mode === 'reduced') assert.equal(await page.locator('.br-ascii-panel canvas').count(), 0);
        release();
        await page.evaluate(async () => { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 300)); });
        await page.waitForFunction(() => !document.querySelector('.br-ascii-panel'), null, { timeout: 15000 });
      }
      console.log(`${engine}: ${mode} fallback passed`);
      release();
      await context.close();
    }
    const cached = await browser.newPage({ viewport: { width: 420, height: 912 } });
    await cached.goto(`${baseUrl}/about.html`, { waitUntil: 'domcontentloaded' });
    await cached.evaluate(async () => {
      const image = new Image();
      image.setAttribute('data-br-no-skeleton', '');
      image.src = '/assets/brett-video-poster.jpg';
      await image.decode();
      document.body.appendChild(image);
      const handle = window.BRAscii.create(image, { source: image });
      await handle.finish(true);
      if (document.querySelector('.br-ascii-panel')) throw Error('Cached media must not be delayed by an effect');
      image.remove();
    });
    console.log(`${engine}: cached media shown immediately`);
  } finally {
    await browser.close();
  }
}
await writeFile(join(outputDir, 'results.json'), JSON.stringify(summary, null, 2));
