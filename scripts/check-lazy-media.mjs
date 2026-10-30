import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

// Usage: node scripts/check-lazy-media.mjs [baseUrl]
// Serve export/ first, e.g. `python3 -m http.server 4173 --directory export`.
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const stubFrame = '<!doctype html><title>stub</title><body style="margin:0;background:#222"></body>';
const isEmbed = (request) => request.resourceType() === 'document' && request.frame().parentFrame();
const isVideo = (request) => /\.(mp4|webm)(\?|$)/i.test(request.url());
// An iframe "holds" its embed unless it is still the parked about:blank page.
// (Requests are a poor measure: the parser starts every navigation before the loader can cancel it.)
const loadedEmbeds = (page) => page.evaluate(() => Array.from(document.querySelectorAll('iframe:not([src*="framer.com/edit"])'))
  .filter((frame) => { try { return frame.contentWindow.location.href !== 'about:blank'; } catch (error) { return true; } }).length);
const stuck = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-br-deferred],[data-br-media="loading"],[data-br-media-self]'))
  .map((el) => `${el.tagName.toLowerCase()} ${(el.getAttribute('src') || el.querySelector('[src]')?.getAttribute('src') || '').slice(-30)} @${Math.round(el.getBoundingClientRect().top + scrollY)} deferred=${el.hasAttribute('data-br-deferred')}`));
const scrollThrough = (page) => page.evaluate(async () => {
  for (let y = 0; y <= document.documentElement.scrollHeight; y += 200) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
});

const cases = [
  { file: 'doc-ai.html', kind: 'embed' },
  { file: 'fb.html', kind: 'video' },
  { file: 'levels.html', kind: 'both' },
];
const report = [];

for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      for (const { file, kind } of cases) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
        const page = await context.newPage();
        const requested = { embed: new Set(), video: new Set() };
        await page.route('**/*', async (route) => {
          const request = route.request();
          if (isEmbed(request)) {
            requested.embed.add(request.url());
            return route.fulfill({ contentType: 'text/html', body: stubFrame });
          }
          if (isVideo(request)) requested.video.add(request.url().split('?')[0]);
          return route.continue().catch(() => {});
        });

        // Arrive from another page so "Back" has somewhere to go.
        await page.goto(`${baseUrl}/about.html`, { waitUntil: 'domcontentloaded' });
        await page.goto(`${baseUrl}/${file}`, { waitUntil: 'load' });
        await page.waitForTimeout(2500);
        const before = { embed: await loadedEmbeds(page), video: await page.evaluate(() => Array.from(document.querySelectorAll('video')).filter((v) => v.readyState >= 2).length) };
        const label = `${engineName}-${viewport.name} ${file}`;

        const parked = await page.evaluate(() => document.querySelectorAll('[data-br-deferred]').length);
        const srcsIntact = await page.evaluate(() => Array.from(document.querySelectorAll('iframe:not([src*="framer.com/edit"])')).every((frame) => /^https:\/\/www\.loom\.com\//.test(frame.getAttribute('src'))));
        assert.ok(srcsIntact, `${label}: iframe src attributes must be left untouched`);
        if (kind !== 'video') assert.ok(before.embed >= 1, `${label}: the first embed must load immediately`);
        if (kind !== 'embed') assert.ok(before.video >= 1, `${label}: the first video must load immediately`);

        const historyBefore = await page.evaluate(() => history.length);
        await scrollThrough(page);
        await page.waitForTimeout(1500);
        await page.waitForFunction(() => !document.querySelector('[data-br-deferred],[data-br-media="loading"],[data-br-media-self]'), null, { timeout: 20000 })
          .catch(async (error) => { throw new Error(`${label}: still loading after scrolling: ${(await stuck(page)).join('; ')}\n${error.message}`); });
        const after = { embed: await loadedEmbeds(page), video: await page.evaluate(() => Array.from(document.querySelectorAll('video')).filter((v) => v.readyState >= 2).length) };
        const embedTotal = await page.evaluate(() => document.querySelectorAll('iframe:not([src*="framer.com/edit"])').length);
        const videoTotal = await page.evaluate(() => document.querySelectorAll('video').length);
        assert.equal(after.embed, embedTotal, `${label}: every embed loads once scrolled to`);
        assert.equal(after.video, videoTotal, `${label}: every video has data once scrolled to`);
        assert.equal(await page.evaluate(() => history.length), historyBefore, `${label}: resuming embeds must not add history entries`);

        await page.goBack({ waitUntil: 'domcontentloaded' });
        assert.ok(page.url().endsWith('/about.html'), `${label}: one Back press must leave the page (got ${page.url()})`);

        report.push(`${label}: at load ${before.embed}/${embedTotal} embeds and ${before.video}/${videoTotal} videos loaded (${parked} parked); all loaded after scrolling`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
console.log(report.join('\n'));
console.log('lazy media: first media eager, rest on demand, src intact, no history entries, Back works');
