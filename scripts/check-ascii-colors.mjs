import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-ascii-colors';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(output, { recursive: true });
const fixture = await readFile(new URL('../export/assets/img_9_boomerang.mp4', import.meta.url));
const results = [];
const cases = process.env.BR_ASCII_COLOR_PAGES?.split(',') || ['index.html', 'fb.html', 'levels.html', 'doc-ai.html', 'anchormaps.html', 'navdy.html'];
const widths = process.env.BR_ASCII_COLOR_WIDTHS?.split(',').map(Number) || [420, 1280];

// Decode screenshot bytes in the browser, avoiding an extra PNG dependency.
async function screenshotPixels(page, bytes, points) {
  return page.evaluate(async ({ png, points }) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    return points.map(([x, y]) => [...context.getImageData(Math.max(0, Math.min(image.width - 1, Math.floor(x))), Math.max(0, Math.min(image.height - 1, Math.floor(y))), 1, 1).data]);
  }, { png: bytes.toString('base64'), points });
}

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of widths) for (const file of cases) {
      const label = `${engine}-${width}-${file.replace('.html', '')}`;
      console.log(`Checking color and clipping: ${label}`);
      const context = await browser.newContext({
        viewport: { width, height: 912 }, isMobile: width < 834, hasTouch: width < 834,
        recordVideo: ['index.html', 'fb.html'].includes(file) ? { dir: output, size: { width, height: 912 } } : undefined,
      });
      const page = await context.newPage();
      const scriptErrors = [];
      page.on('pageerror', (error) => scriptErrors.push(error.message));
      await page.addInitScript(() => {
        // Hold only homepage readiness notification, like a slow poster
        // arriving, while we inspect the waiting field. No production delay
        // or animation settings are changed by this test-only gate.
        let releaseReadiness;
        const readiness = new Promise((resolve) => { releaseReadiness = resolve; });
        window.__releaseAsciiReadiness = releaseReadiness;
        let api;
        Object.defineProperty(window, 'BRAscii', {
          configurable: true,
          get() { return api; },
          set(value) {
            api = value;
            if (!/\/(index\.html)?$/.test(location.pathname)) return;
            const create = value.create;
            value.create = function (...args) {
              const handle = create.apply(this, args), finish = handle.finish;
              if (args[0].getAttribute('data-framer-name') !== 'Brett Player') return handle;
              handle.finish = async function (success) { if (success) await readiness; return finish(success); };
              return handle;
            };
          },
        });
        window.__asciiSamplingErrors = [];
        const original = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function (...args) {
          try { return original.apply(this, args); }
          catch (error) { window.__asciiSamplingErrors.push(error.name + ': ' + error.message); throw error; }
        };
      });
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      await page.route('**/*', async (route) => {
        const request = route.request();
        if (request.resourceType() === 'document' && request.frame().parentFrame()) {
          await gate;
          return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#eee"><button>Play</button></body>' }).catch(() => {});
        }
        if (/\.(mp4|webm)(\?|$)/.test(request.url())) {
          await gate;
          // Anchor's opening globe is genuinely black and white. Keep the
          // real local video instead of giving it the blue color fixture.
          if (file === 'anchormaps.html') return route.continue().catch(() => {});
          return route.fulfill({ contentType: 'video/mp4', body: fixture }).catch(() => {});
        }
        return route.continue().catch(() => {});
      });
      await page.goto(`${base}/${file}`, { waitUntil: 'commit' });
      await page.waitForFunction((home) => window.BRAscii && (!home || window.__brTheme) &&
        [...document.querySelectorAll('#main video,#main iframe')].some((el) => el.getBoundingClientRect().width > 0), file === 'index.html');
      const mediaUrl = await page.evaluate((home) => {
        const el = home ? document.querySelector('[data-framer-name="Brett Player"] iframe') :
          [...document.querySelectorAll('#main video,#main iframe')].find((el) => el.getBoundingClientRect().width > 0 && !el.src.includes('framer.com/edit'));
        const rect = el.getBoundingClientRect(); scrollTo(0, scrollY + rect.top - 130);
        return (el.getAttribute('src') || '').split('?')[0];
      }, file === 'index.html');
      await page.waitForFunction((url) => {
        const panel = [...document.querySelectorAll('.br-ascii-panel')].find((el) => el.dataset.brAsciiMedia === url && el.querySelector('.br-ascii-color-field'));
        if (panel) { panel.setAttribute('data-color-test', 'primary'); return true; }
      }, mediaUrl);
      // Do not let a font swap move the page between measuring its corners
      // and capturing their pixels. This never delays the production loader.
      await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(3000)]);
      await page.waitForTimeout(250);
      const panel = page.locator('[data-color-test="primary"]');
      const waiting = await panel.evaluate((panel) => {
        const canvas = panel.querySelector('.br-ascii-color-field');
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let colored = 0, opaque = 0; const colors = new Set(), tones = new Set();
        for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 40) {
          opaque++; tones.add(data[i] >> 5);
          if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 18) {
            colored++; colors.add([data[i] >> 5, data[i + 1] >> 5, data[i + 2] >> 5].join(','));
          }
        }
        const rect = panel.getBoundingClientRect();
        return { colored, opaque, tones: tones.size, colors: colors.size, radius: getComputedStyle(panel).borderRadius, clip: getComputedStyle(panel).clipPath,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, pointerEvents: getComputedStyle(panel).pointerEvents };
      });
      const monochrome = file === 'anchormaps.html';
      assert.ok(waiting.opaque > 100 && waiting.tones >= 4, `${label}: waiting field must contain sampled image detail`);
      if (monochrome) assert.equal(waiting.colored, 0, 'A black-and-white source must not be given artificial colors');
      else assert.ok(waiting.colored > 30 && waiting.colors >= 4, `${label}: waiting field must contain real source colors: ${JSON.stringify(waiting)}`);
      assert.equal(waiting.pointerEvents, 'none');
      if (file === 'index.html') assert.equal(waiting.radius, '10px');
      if (file === 'fb.html') assert.equal(waiting.radius, '20px', 'Copy the rounded card, not its square video wrapper');
      await page.screenshot({ path: join(output, `${label}-colored-waiting.png`) });

      // Temporarily fill this actual panel with a test color, so corner checks
      // cannot pass accidentally because the source happened to be white.
      const radius = parseFloat(waiting.radius);
      if (radius >= 4 && waiting.rect.height < 760) {
        await panel.evaluate((el) => {
          el.dataset.savedBackground = el.style.backgroundColor;
          el.style.backgroundColor = 'rgb(203,21,151)';
          [...el.children].forEach((child) => { child.dataset.savedVisibility = child.style.visibility; child.style.visibility = 'hidden'; });
        });
        // Fonts can finish during the preceding full-page screenshot. Measure
        // the panel again, rather than testing stale pre-font coordinates.
        const r = await panel.evaluate(async (el) => {
          window.BRAscii.refresh();
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
        const clip = { x: Math.floor(r.x) - 3, y: Math.floor(r.y) - 3,
          width: Math.ceil(r.x + r.width) - Math.floor(r.x) + 6,
          height: Math.ceil(r.y + r.height) - Math.floor(r.y) + 6 };
        const bytes = await page.screenshot({ clip, path: join(output, `${label}-corner-control.png`) });
        const x = r.x - clip.x, y = r.y - clip.y, right = x + r.width, bottom = y + r.height;
        const corners = [[x + 1, y + 1], [right - 1, y + 1], [x + 1, bottom - 1], [right - 1, bottom - 1]];
        const exterior = [[x - 2, y - 2], [right + 2, y - 2], [x - 2, bottom + 2], [right + 2, bottom + 2]];
        const pixels = await screenshotPixels(page, bytes, [...corners, ...exterior, [x + radius + 3, y + 1]]);
        for (let i = 0; i < 4; i++) assert.ok(pixels[i].slice(0, 3).every((value, channel) => Math.abs(value - pixels[i + 4][channel]) <= 3), `${label}: corner ${i} must be clipped: ${JSON.stringify(pixels)}`);
        assert.ok(Math.abs(pixels[8][0] - 203) < 4 && Math.abs(pixels[8][1] - 21) < 4, `${label}: control pixel must be inside the panel`);
        await panel.evaluate((el) => {
          el.style.backgroundColor = el.dataset.savedBackground; delete el.dataset.savedBackground;
          [...el.children].forEach((child) => { child.style.visibility = child.dataset.savedVisibility; delete child.dataset.savedVisibility; });
        });
      }

      // Inspect only the upstream library's animated canvas, not our waiting
      // field or the full-color proxy beneath it. Save its strongest frame.
      await page.evaluate((monochrome) => {
        window.__decodeColors = { colored: 0, colors: 0, opaque: 0, frame: null, samples: 0 };
        const start = performance.now();
        function tick() {
          const panel = document.querySelector('[data-color-test="primary"][data-br-ascii-state="revealing"]');
          for (const canvas of panel ? panel.querySelectorAll('.ar-overlay canvas') : []) {
            const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            let colored = 0, opaque = 0; const colors = new Set();
            for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 60) {
              opaque++;
              if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 18) {
                colored++; colors.add([data[i] >> 5, data[i + 1] >> 5, data[i + 2] >> 5].join(','));
              }
            }
            window.__decodeColors.samples++;
            if ((monochrome ? opaque : colored) > (monochrome ? window.__decodeColors.opaque : window.__decodeColors.colored)) {
              window.__decodeColors = { colored, colors: colors.size, opaque, frame: canvas.toDataURL('image/png'), samples: window.__decodeColors.samples };
            }
          }
          if (performance.now() - start < 5000) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, monochrome);
      await page.evaluate(() => window.__releaseAsciiReadiness());
      release();
      await page.waitForFunction((mono) => mono ? window.__decodeColors.opaque > 200 : window.__decodeColors.colored > 30 && window.__decodeColors.colors >= 4, monochrome, { timeout: 10000 })
        .catch(async (error) => { throw Error(label + ': decode audit ' + JSON.stringify(await page.evaluate(() => ({ ...window.__decodeColors, frame: !!window.__decodeColors.frame,
          panels: [...document.querySelectorAll('.br-ascii-panel')].map((el) => ({ name: el.dataset.brAsciiFor, state: el.dataset.brAsciiState })) }))) + '\n' + error.message); });
      await page.screenshot({ path: join(output, `${label}-decode.png`) });
      await page.waitForTimeout(1000);
      const decoded = await page.evaluate(() => window.__decodeColors);
      await writeFile(join(output, `${label}-glyph-pixels.png`), Buffer.from(decoded.frame.split(',')[1], 'base64'));
      assert.deepEqual(await page.evaluate(() => window.__asciiSamplingErrors), [], `${label}: no cross-origin sampling errors`);
      assert.deepEqual(scriptErrors, [], `${label}: no script errors`);
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 650) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
      });
      await page.waitForFunction(() => !document.querySelector('[data-br-deferred],[data-br-media="loading"],[data-br-media-self="loading"],.br-ascii-panel'), null, { timeout: 20000 });
      results.push({ label, monochrome, waiting: { colored: waiting.colored, colors: waiting.colors }, decode: { colored: decoded.colored, colors: decoded.colors, opaque: decoded.opaque }, radius: waiting.radius, pixelCorners: radius >= 4 });
      console.log(`${label}: ${decoded.colored} colored decode pixels, ${decoded.colors} color buckets, ${waiting.radius} corners verified`);
      await context.close();
    }
  } finally { await browser.close(); }
}
await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
