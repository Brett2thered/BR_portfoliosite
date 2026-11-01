import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-stats-cards';
const widths = [320,420,768,834,900,1024,1440,1920,2560,3200];
await mkdir(output, {recursive:true});
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const cards = [
  {key:'ranking',id:'8',metric:'1%',text:'AngelList (Wellfound)'},
  {key:'capital',id:'11',metric:'22.8',text:'capital raised'},
  {key:'rating',id:'23',metric:'4.9',text:'Apple App Store'}
];
const results = [];
for (const [engine, type] of Object.entries({chromium,webkit})) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    await page.route('**/*', (route) => route.request().resourceType() === 'document' && route.request().frame().parentFrame()
      ? route.fulfill({contentType:'text/html',body:'<!doctype html>'}) : route.continue().catch(() => {}));
    await page.goto(base, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__brTheme);
    assert.equal(await page.locator('.br-stat-card').count(), 3, 'All three stats must be rebuilt as native cards');
    await Promise.race([page.evaluate(() => document.fonts.ready),page.waitForTimeout(3000)]);
    for (const width of widths) {
      await page.setViewportSize({width,height:1000});
      await page.mouse.move(0,0);
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-br-id]').evaluateAll((items) => items.filter((el) => el.offsetWidth && el.offsetHeight).length),27);
      for (const spec of cards) {
        const card = page.locator(`[data-stat="${spec.key}"]`);
        assert.equal(await card.getAttribute('data-br-id'),spec.id);
        assert.equal(await card.locator('img,picture,video,iframe,svg,canvas').count(),0,'Stats must have no image or canvas dependencies');
        assert.ok((await card.innerText()).includes(spec.text));
        assert.ok((await card.locator('.br-stat-value').innerText()).replace(/\s+/g,'').includes(spec.metric));
        const geometry = await card.evaluate((card) => {
          const rect = card.getBoundingClientRect(), shell = card.querySelector('.br-stat-shell'), core = card.querySelector('.br-stat-core');
          const images = [...card.querySelectorAll('*'),card].filter((el) => /url\(/.test(getComputedStyle(el).backgroundImage));
          const value = card.querySelector('.br-stat-value'), body = card.querySelector('.br-stat-description');
          return {width:rect.width,height:rect.height,overflow:card.scrollWidth-card.clientWidth,bodySize:parseFloat(getComputedStyle(body).fontSize),
            radius:getComputedStyle(card).borderRadius,backgroundImages:images.length,
            valueSize:parseFloat(getComputedStyle(value).fontSize),textShadow:getComputedStyle(value).textShadow,
            children:[shell,core,value,body].map((el) => {const r=el.getBoundingClientRect();return {left:r.left-rect.left,right:rect.right-r.right,top:r.top-rect.top,bottom:rect.bottom-r.bottom,overflow:el.scrollWidth-el.clientWidth};})};
        });
        assert.ok(geometry.width>0 && geometry.height>0);
        assert.equal(geometry.radius,'10px');
        assert.ok(geometry.overflow<=1 && geometry.children.every((r) => r.left>=-1 && r.right>=-1 && r.top>=-1 && r.bottom>=-1 && r.overflow<=1),`${engine} ${width} ${spec.key}: content fits ${JSON.stringify(geometry)}`);
        assert.ok(geometry.bodySize>=16 && geometry.valueSize>=48);
        assert.equal(geometry.backgroundImages,0);
        assert.equal(geometry.textShadow,'none');
        if ([320,420,900,1440,2560,3200].includes(width)) {
          await card.scrollIntoViewIfNeeded();
          await card.screenshot({path:join(output,`${engine}-${width}-${spec.key}.png`)});
        }
        results.push({engine,width,key:spec.key,...geometry});
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
      console.log(`${engine} ${width}px: all three text/CSS stats fit, remain readable, and preserve the complete project list`);
    }
    await page.addStyleTag({content:'html { font-size:200% !important; }'});
    for (const width of [320,420]) {
      await page.setViewportSize({width,height:1000});
      for (const spec of cards) {
      const card=page.locator(`[data-stat="${spec.key}"]`);
      await card.scrollIntoViewIfNeeded();
      assert.ok(await card.evaluate((card) => card.scrollWidth<=card.clientWidth+1 && card.querySelector('.br-stat-core').scrollWidth<=card.querySelector('.br-stat-core').clientWidth+1 && card.querySelector('.br-stat-description').getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom),`${engine} ${width} ${spec.key}: 200% text must reflow without clipping`);
      await card.screenshot({path:join(output,`${engine}-${width}-text-200-${spec.key}.png`)});
      }
    }
    await page.close();
    const fallback = await browser.newPage({viewport:{width:420,height:1000},javaScriptEnabled:false});
    await fallback.route('**/*',(route) => ['image','font'].includes(route.request().resourceType()) ? route.abort() : route.continue().catch(()=>{}));
    await fallback.goto(base,{waitUntil:'domcontentloaded'});
    assert.equal(await fallback.locator('.br-stat-card').count(),3);
    for (const spec of cards) {
      const card=fallback.locator(`[data-stat="${spec.key}"]`);
      assert.ok((await card.textContent()).includes(spec.metric));
      assert.ok(await card.isVisible());
    }
    await fallback.close();
    console.log(`${engine}: 200% text and no-JavaScript/no-image/no-font fallback passed`);
  } finally {await browser.close();}
}
await writeFile(join(output,'measurements.json'),JSON.stringify(results,null,2));
