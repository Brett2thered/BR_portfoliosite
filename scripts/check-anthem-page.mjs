import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-anthem-page';
// A deliberately held embed can keep WebKit's font-ready promise pending.
// Capture that genuine loading state instead of waiting for the held frame.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const embed = 'https://www.loom.com/embed/1df91cef93a14400bb9632d85c245474';
await mkdir(output, { recursive: true });
assert.ok((await readFile(new URL('../export/sitemap.xml', import.meta.url), 'utf8')).includes('<loc>https://www.brett.red/anthem</loc>'));
const deployment = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(deployment.rewrites.some((route) => route.source === '/anthem' && route.destination === '/anthem.html'));

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const width of [320, 420, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 700, hasTouch: width < 700 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      await page.route(embed, async (route) => {
        await gate;
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;height:100vh;display:grid;place-content:center;background:#eef0f1;font:16px sans-serif"><button onclick="this.textContent=\'Playing\'">Play video</button></body>' }).catch(() => {});
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id="25"]'));
      const card = page.locator('a[data-framer-name="Anthem"]');
      assert.equal(await card.getAttribute('href'), 'anthem.html');
      assert.notEqual(await card.getAttribute('target'), '_blank');
      assert.equal(await card.evaluate((el) => getComputedStyle(el).textDecorationLine), 'none');
      assert.equal(await page.locator('[data-br-id]').evaluateAll((cards) => cards.filter((el) => el.getBoundingClientRect().width && el.getBoundingClientRect().height).length), 26);
      assert.equal(await page.locator('a[data-framer-name="Navdy"]').getAttribute('href'), 'https://youtu.be/pKL4PJICS40?si=51z_0Nj5QPSR0pb-');
      assert.equal(await page.locator('a[href="https://www.linkedin.com/in/mrshakur/"]').count(), 1);
      await card.scrollIntoViewIfNeeded();
      if (width === 768) {
        await card.focus();
        await card.press('Enter');
      } else await card.click({ position: { x: 30, y: 30 } });
      await page.waitForURL(`${base}/anthem.html`, { waitUntil: 'commit' });
      await page.waitForSelector('h1');
      assert.equal(await page.locator('h1').innerText(), 'Anthem');
      assert.deepEqual(await page.locator('h2').allTextContents(), ['Overview', 'Approach']);
      assert.ok((await page.locator('.project-overview').innerText()).includes('health history'));
      assert.equal(await page.locator('iframe').count(), 1);
      assert.equal(await page.locator('iframe').getAttribute('src'), embed);
      assert.ok(await page.locator('iframe').getAttribute('title'));
      assert.notEqual(await page.locator('iframe').getAttribute('allowfullscreen'), null);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.brett.red/anthem');
      assert.ok((await page.content()).includes('G-E9WKM6FF0H'));
      await page.locator('.project-video').scrollIntoViewIfNeeded();
      await page.waitForSelector('.br-ascii-color-field');
      const layout = await page.evaluate(() => {
        const wrapper = document.querySelector('.project-video'), iframe = wrapper.querySelector('iframe');
        const frame = wrapper.getBoundingClientRect(), video = iframe.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          radius: getComputedStyle(wrapper).borderRadius,
          ratio: frame.width / frame.height,
          insets: [video.left - frame.left, video.top - frame.top, frame.right - video.right, frame.bottom - video.bottom],
          columns: getComputedStyle(document.querySelector('.project-overview')).gridTemplateColumns.split(' ').length,
          loaderRadius: getComputedStyle(document.querySelector('.br-ascii-panel')).borderRadius,
        };
      });
      assert.ok(layout.overflow <= 1);
      assert.equal(layout.radius, width <= 700 ? '10px' : '20px');
      assert.equal(layout.loaderRadius, layout.radius);
      assert.ok(Math.abs(layout.ratio - 16 / 9) < .01);
      assert.ok(layout.insets.every((value) => Math.abs(value) < 1));
      assert.equal(layout.columns, width <= 700 ? 1 : 2);
      await page.screenshot({ path: join(output, `${engine}-${width}-loading.png`) });
      release();
      await page.waitForFunction(() => !document.querySelector('.br-ascii-panel,[data-br-media],[data-br-media-self]'), null, { timeout: 15000 });
      const play = page.frameLocator('iframe').getByRole('button', { name: 'Play video' });
      await play.click();
      assert.equal(await page.frameLocator('iframe').getByRole('button', { name: 'Playing' }).textContent(), 'Playing');
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: join(output, `${engine}-${width}-layout.png`), fullPage: true });
      assert.deepEqual(errors, []);
      assert.equal(context.pages().length, 1, 'Internal project link must not open a new tab');
      await page.getByRole('link', { name: 'Back to all projects' }).click();
      await page.waitForURL(`${base}/`);
      console.log(`${engine} ${width}px: internal card navigation, copy, responsive layout, embed controls, colored loader, corners and return link passed`);
      await context.close();
    }
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(`${base}/anthem.html`, { waitUntil: 'domcontentloaded' });
    assert.equal(await noJs.locator('h1').innerText(), 'Anthem');
    assert.equal(await noJs.locator('iframe').getAttribute('src'), embed);
    assert.ok((await noJs.locator('.project-overview').innerText()).includes('timeline'));
    console.log(`${engine}: project copy and native embed are available without JavaScript`);
  } finally { await browser.close(); }
}
