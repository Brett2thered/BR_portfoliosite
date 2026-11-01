import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-medicare-hover';
await mkdir(output, {recursive:true});
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
for (const [engine, type] of Object.entries({chromium, webkit})) {
  const browser = await type.launch();
  try {
    for (const width of [420, 900, 1440, 2560]) {
      const page = await browser.newPage({viewport:{width, height:1000}});
      await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame()
        ? route.fulfill({contentType:'text/html', body:'<!doctype html>'}) : route.continue().catch(() => {}));
      await page.goto(`${base}/?preview=nds#medicare`, {waitUntil:'domcontentloaded'});
      const card = page.locator('#medicare');
      await card.scrollIntoViewIfNeeded();
      assert.equal(await card.locator('button').count(), 0, 'No pause button on the homepage card');
      assert.equal(await card.locator('.br-medicare-caption').count(), 0, 'No metric caption or corner arrow');
      assert.ok(!/30\+|Five questions|↗/.test(await card.innerText()));
      const front = card.locator('.br-medicare-front');
      const studio = card.locator('.br-medicare-studio');
      await card.locator('.br-medicare-preload').evaluate((image) => image.decode());
      await studio.locator('img').evaluate((image) => image.decode());
      await page.waitForFunction(() => document.getElementById('medicare').dataset.motion === 'playing');
      assert.equal(await studio.evaluate((el) => Number(getComputedStyle(el).opacity)), 0);
      await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(3000)]);
      await card.screenshot({path:join(output, `${engine}-${width}-default.png`)});
      // Element screenshots can round WebKit's scroll position by one pixel;
      // measure after that adjustment, not before it.
      const normal = await card.boundingBox();
      await card.hover();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.br-medicare-studio')).opacity) > .99);
      assert.ok(await front.evaluate((el) => Number(getComputedStyle(el).opacity) < .01));
      assert.equal(await card.getAttribute('data-motion'), 'paused');
      assert.equal(await studio.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(1, 1, 1)');
      assert.ok((await studio.innerText()).includes('National Design Studio'));
      const hovered = await card.boundingBox();
      assert.ok(['width','height','x','y'].every((key) => Math.abs(normal[key] - hovered[key]) < 1), 'Hover preserves card bounds and radius: ' + JSON.stringify({normal,hovered}));
      await card.screenshot({path:join(output, `${engine}-${width}-hover.png`)});
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.br-medicare-studio')).opacity) < .01);
      await page.keyboard.press('Tab');
      const link = card.getByRole('link', {name:'Explore the Medicare project'});
      await link.focus();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.br-medicare-studio')).opacity) > .99);
      await link.press('Enter');
      await page.waitForURL(`${base}/medicare.html`);
      assert.ok((await page.locator('main').innerText()).includes('National Design Studio'));
      console.log(`${engine} ${width}px: clean card, studio hover/focus, unchanged bounds, paused hidden motion and native project navigation passed`);
      await page.close();
    }
    const touch = await browser.newPage({viewport:{width:420,height:1000},isMobile:true,hasTouch:true});
    await touch.goto(`${base}/?preview=nds#medicare`,{waitUntil:'domcontentloaded'});
    const touchLink = touch.locator('#medicare a');
    await touchLink.scrollIntoViewIfNeeded();
    assert.equal(await touch.locator('.br-medicare-studio').evaluate((el) => Number(getComputedStyle(el).opacity)), 0);
    await touchLink.tap();
    await touch.waitForURL(`${base}/medicare.html`);
    await touch.close();
    const reduced = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await reduced.goto(`${base}/?preview=nds#medicare`,{waitUntil:'domcontentloaded'});
    await reduced.locator('#medicare').scrollIntoViewIfNeeded();
    assert.equal(await reduced.locator('.br-medicare-collage').evaluate((el) => getComputedStyle(el).animationName), 'none');
    await reduced.locator('#medicare').hover();
    await reduced.waitForFunction(() => Number(getComputedStyle(document.querySelector('.br-medicare-studio')).opacity) > .99);
    await reduced.close();
    console.log(`${engine}: one-tap touch navigation and reduced-motion brand state passed`);
  } finally { await browser.close(); }
}
