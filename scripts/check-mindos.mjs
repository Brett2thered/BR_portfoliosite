import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = '/tmp/mindos-review';
await mkdir(output, { recursive: true });
const source = await readFile(new URL('../export/mindos.html', import.meta.url), 'utf8');
assert.ok(source.includes('/embed/yFmuxjGLdQI'), 'Use the YouTube video from the existing card');
assert.ok(!/TedX\.mp4/i.test(source), 'Do not embed the supplied talk file');
assert.ok(!(await readdir(new URL('../export/assets/mindos/', import.meta.url))).some(f => /tedx.*\.mp4/i.test(f)));

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const width of [320, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/mindos', { waitUntil: 'domcontentloaded' });
      await page.locator('#animation-toggle').waitFor({ state: 'visible' });
      assert.equal(await page.locator('h1').textContent(), 'MindOS');
      assert.equal(await page.locator('video').count(), 5);
      assert.equal(await page.locator('iframe').count(), 1);
      assert.equal(await page.locator('iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/yFmuxjGLdQI');
      assert.ok(await page.locator('video').evaluateAll(videos => videos.every(v => v.paused && v.controls && v.muted)));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/${name}-page-${width}.png`, fullPage: true });
    }
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const cover = page.locator('.mindos-cover');
    await cover.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.mindos-cover').getAttribute('data-br-media-state') === 'ready');
    await cover.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.waitForTimeout(800);
    assert.equal(await cover.getAttribute('data-br-id'), '22');
    assert.equal(await cover.getAttribute('href'), '/mindos');
    assert.ok(await cover.locator('video').evaluate(v => v.paused && v.currentTime === 0));
    assert.equal(await cover.locator('.mindos-cover__logo').getAttribute('src'), 'assets/mindos/logo.svg');
    assert.equal(await cover.locator('.mindos-cover__heading').evaluate(el => getComputedStyle(el).opacity), '1');
    await cover.screenshot({ path: `${output}/${name}-cover.png` });
    if (name === 'chromium') {
      // Share image uses the exact finished cover composition, including the logo.
      await page.setViewportSize({ width: 760, height: 1000 });
      await cover.screenshot({ path: new URL('../export/assets/mindos/cover.jpg', import.meta.url).pathname, type: 'jpeg', quality: 92 });
    }
    await cover.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/mindos');
    assert.equal(await page.locator('h1').textContent(), 'MindOS');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await cover.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.mindos-cover video').currentTime > .2);
    assert.ok(await cover.locator('video').evaluate(v => v.loop));
    const seek = async progress => {
      await cover.locator('video').evaluate((video, p) => { video.pause(); video.currentTime = video.duration * p; }, progress);
      await page.waitForFunction(p => {
        const v = document.querySelector('.mindos-cover video');
        return !v.seeking && Math.abs(v.currentTime / v.duration - p) < .01;
      }, progress);
    };
    // Sample the logo phase, artwork phase, return and loop seam independently.
    for (const [phase, opacity] of [[.03, 1], [.4, 0], [.93, 1]]) {
      await seek(phase);
      await page.waitForFunction(expected => Number(getComputedStyle(document.querySelector('.mindos-cover__heading')).opacity) === expected, opacity);
      assert.equal(await cover.locator('.mindos-cover__tedx').evaluate(el => getComputedStyle(el).opacity), '1');
      assert.ok(await cover.locator('.mindos-cover__tedx img').evaluate(img => img.complete && img.naturalWidth > 0));
      if (phase !== .93) await cover.screenshot({ path: `${output}/${name}-cover-${opacity ? 'logo' : 'artwork'}.png` });
    }
    await seek(.98);
    await cover.locator('video').evaluate(v => v.play());
    await page.waitForFunction(() => {
      const v = document.querySelector('.mindos-cover video'); return !v.paused && v.currentTime < 2;
    });
    assert.equal(await cover.locator('.mindos-cover__heading').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('.mindos-cover video').paused);
    await cover.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('.mindos-cover video').paused);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => {
      const v = document.querySelector('.mindos-cover video');
      return v.paused && v.currentTime === 0 && getComputedStyle(document.querySelector('.mindos-cover__heading')).opacity === '1';
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.goto(base + '/mindos', { waitUntil: 'domcontentloaded' });
    await page.locator('#ideas').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#ideas').currentTime > .2);
    await page.locator('#animation-toggle').click();
    assert.ok(await page.locator('video').evaluateAll(videos => videos.every(v => v.paused)));
    assert.deepEqual(errors, []);
    console.log(`${name}: responsive page, correct embed, keyboard navigation, reduced motion, synchronized logo phases, constant TEDx, video looping, offscreen pause/resume and pause controls passed`);
    await context.close();

    const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await plain.goto(base + '/mindos');
    assert.equal(await plain.locator('h1').textContent(), 'MindOS');
    assert.ok(await plain.locator('video').evaluateAll(videos => videos.every(v => v.controls && !!v.poster)));
    await plain.close();
  } finally { await browser.close(); }
}
