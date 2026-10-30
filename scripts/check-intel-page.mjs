import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-intel-page';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(output, { recursive: true });
const assets = JSON.parse(await readFile(new URL('../export/assets/intel/media.json', import.meta.url), 'utf8'));
const summary = [];
assert.equal(assets.length, 4);
assert.ok(assets.reduce((sum, asset) => sum + asset.videoBytes, 0) < 3 * 1048576, 'Do not ship the huge source GIFs');
for (const asset of assets) assert.equal((await stat(new URL('../export/assets/intel/' + asset.video, import.meta.url))).size, asset.videoBytes);
assert.ok((await readFile(new URL('../export/sitemap.xml', import.meta.url), 'utf8')).includes('<loc>https://www.brett.red/intel</loc>'));
assert.ok(JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).rewrites.some((route) => route.source === '/intel' && route.destination === '/intel.html'));

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of [320, 420, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 700, hasTouch: width < 700,
        recordVideo: width === 420 ? { dir: output, size: { width, height: 1000 } } : undefined });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => { if (page.url().includes('/intel.html')) errors.push(error.message); });
      await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame()
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }) : route.continue().catch(() => {}));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id="6"]'));
      const card = page.locator('a[data-framer-name="Intel"]');
      assert.equal(await card.getAttribute('href'), 'intel.html');
      assert.notEqual(await card.getAttribute('target'), '_blank');
      assert.equal(await card.evaluate((el) => getComputedStyle(el).textDecorationLine), 'none');
      assert.equal(await page.locator('[data-br-id]').evaluateAll((items) => items.filter((el) => el.offsetWidth && el.offsetHeight).length), 26);
      assert.equal(await page.locator('a[data-framer-name="Anthem"]').getAttribute('href'), 'anthem.html');
      await card.scrollIntoViewIfNeeded();
      if (width === 768) { await card.focus(); await card.press('Enter'); }
      else await card.click({ position: { x: 30, y: 30 } });
      await page.waitForURL(`${base}/intel.html`, { waitUntil: 'commit' });
      await page.waitForSelector('h1');
      assert.equal(await page.locator('h1').innerText(), 'Intel');
      assert.ok((await page.locator('main').innerText()).includes('The campaign was a success.'));
      assert.equal(await page.locator('[data-project-loop]').count(), 4);
      assert.ok((await page.content()).includes('G-E9WKM6FF0H'));
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.brett.red/intel');
      await page.waitForSelector('#animation-toggle:not([hidden])');
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
        columns: getComputedStyle(document.querySelector('.animation-gallery')).gridTemplateColumns.split(' ').length,
        frames: [...document.querySelectorAll('.animation-frame')].map((el) => ({ radius: getComputedStyle(el).borderRadius, ratio: el.clientWidth / el.clientHeight })) }));
      assert.ok(layout.overflow <= 1);
      assert.equal(layout.columns, width <= 700 ? 1 : 2);
      assert.ok(layout.frames.every((frame) => frame.radius === (width <= 700 ? '10px' : '20px') && Math.abs(frame.ratio - 1) < .01));
      for (const [index, video] of (await page.locator('[data-project-loop]').all()).entries()) {
        await video.scrollIntoViewIfNeeded();
        await page.waitForFunction((id) => { const v = document.getElementById(id); return v.readyState >= 2 && !v.paused && v.currentTime > .05; }, await video.getAttribute('id'));
        const before = await video.evaluate((v) => v.currentTime);
        await page.waitForTimeout(250);
        const playback = await video.evaluate((v) => ({ time: v.currentTime, duration: v.duration, paused: v.paused,
          muted: v.muted, loop: v.loop, controls: v.controls, inline: v.playsInline, width: v.videoWidth, error: v.error?.message || null }));
        assert.ok(!playback.paused && (playback.time > before || before > playback.duration - .5));
        assert.ok(playback.muted && playback.loop && playback.controls && playback.inline);
        assert.ok(Math.abs(playback.duration - assets[index].duration) < .06, 'Preserve the supplied loop timing');
        assert.equal(playback.width, 800);
        assert.equal(playback.error, null);
      }
      await page.evaluate(() => document.getElementById('animation-05').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#animation-01').evaluate((v) => v.paused), true, 'Offscreen loops must stop');
      await page.getByRole('button', { name: 'Pause all animations', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-project-loop]')].every((v) => v.paused));
      const play = page.getByRole('button', { name: 'Play animations', exact: true });
      await play.focus(); await play.press('Enter');
      await page.locator('#animation-01').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.getElementById('animation-01').paused);
      await page.locator('.campaign-proof').scrollIntoViewIfNeeded();
      await page.locator('.campaign-proof img').evaluate((img) => img.decode());
      assert.ok(await page.locator('.campaign-proof img').evaluate((img) => img.naturalWidth > 0));
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: join(output, `${engine}-${width}-page.png`), fullPage: true });
      assert.deepEqual(errors, []);
      assert.equal(context.pages().length, 1);
      summary.push(`${engine} ${width}px: native Intel navigation, four actual looping animations, exact durations, viewport pause, keyboard controls, evidence image, layout and corners passed`);
      console.log(summary.at(-1));
      await context.close();
    }

    const reduced = await browser.newPage({ viewport: { width: 420, height: 1000 }, reducedMotion: 'reduce' });
    await reduced.goto(`${base}/intel.html`, { waitUntil: 'domcontentloaded' });
    for (const video of await reduced.locator('[data-project-loop]').all()) { await video.scrollIntoViewIfNeeded(); await reduced.waitForTimeout(150); }
    assert.ok(await reduced.locator('[data-project-loop]').evaluateAll((videos) => videos.every((v) => v.paused && v.currentTime === 0)));
    await reduced.getByRole('button', { name: 'Play animations', exact: true }).click();
    await reduced.locator('#animation-01').scrollIntoViewIfNeeded();
    await reduced.waitForFunction(() => document.getElementById('animation-01').currentTime > .1);
    console.log(`${engine}: reduced motion stays still until explicit opt-in`);
    await reduced.close();

    const noJs = await browser.newPage({ viewport: { width: 420, height: 1000 }, javaScriptEnabled: false });
    await noJs.goto(`${base}/intel.html`, { waitUntil: 'domcontentloaded' });
    assert.equal(await noJs.locator('video[poster][controls]').count(), 4);
    assert.equal(await noJs.locator('#animation-toggle').isVisible(), false);
    assert.ok((await noJs.locator('main').innerText()).includes('From illustration to code'));
    console.log(`${engine}: native players, still posters and copy work without JavaScript`);
    await noJs.close();
  } finally { await browser.close(); }
}
await writeFile(join(output, 'results.json'), JSON.stringify(summary, null, 2));
