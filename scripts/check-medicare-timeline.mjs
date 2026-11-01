import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base=process.argv[2] || 'http://127.0.0.1:4173';
const output=process.argv[3] || '/private/tmp/br-medicare-timeline';
await mkdir(output,{recursive:true});
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const results=[];
async function check(demo,label) {
  const geometry=await demo.locator('.track').evaluate((track)=>{
    const r=track.getBoundingClientRect(),line=getComputedStyle(track,'::before');
    const centerX=r.left+parseFloat(line.left)+parseFloat(line.width)/2;
    const startY=r.top+parseFloat(line.top);
    const dots=[...track.querySelectorAll('.node')].map((node)=>{
      const r=node.getBoundingClientRect(),dot=getComputedStyle(node,'::before');
      const extraX=dot.boxSizing==='border-box'?0:parseFloat(dot.borderLeftWidth)+parseFloat(dot.borderRightWidth);
      const extraY=dot.boxSizing==='border-box'?0:parseFloat(dot.borderTopWidth)+parseFloat(dot.borderBottomWidth);
      return {x:r.left+parseFloat(dot.left)+(parseFloat(dot.width)+extraX)/2,
        y:r.top+parseFloat(dot.top)+(parseFloat(dot.height)+extraY)/2,box:dot.boxSizing};
    });
    return {centerX,startY,dots};
  });
  assert.ok(geometry.dots.length>0);
  assert.ok(geometry.dots.every((dot)=>Math.abs(dot.x-geometry.centerX)<.1),`${label}: all dots must be centered on the connector: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.startY-geometry.dots[0].y)<.1,`${label}: connector must begin at the first dot, with no line above it: ${JSON.stringify(geometry)}`);
  results.push({label,...geometry});
}
for(const [engine,type]of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {
    for(const dpr of [1,2]) for(const [mode,width]of [['standalone',320],['standalone',380],['standalone',600],['standalone',820],['standalone',1000],['embedded',320],['embedded',420],['embedded',900],['embedded',1440]]) {
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:dpr,reducedMotion:'reduce'});
      const label=`${engine}-${mode}-${width}-dpr${dpr}`;
      await page.goto(`${base}/${mode==='embedded'?'medicare.html':'prototypes/medicare/'}`,{waitUntil:'domcontentloaded'});
      let demo=page;
      if(mode==='embedded') {
        await page.locator('#medicare-prototype').scrollIntoViewIfNeeded();
        demo=page.frameLocator('#medicare-prototype');
      }
      await demo.locator('#active-node .opt').first().waitFor();
      await check(demo,label+' initial');
      await demo.locator('[data-node="timing"][data-pick="already"]').click();
      await demo.locator('[data-node="ss"][data-pick="no"]').waitFor();
      await check(demo,label+' answered');
      await demo.locator('[data-node="ss"][data-pick="no"]').click();
      await demo.locator('[data-node="working"][data-pick="none"]').waitFor();
      await check(demo,label+' multiple');
      await demo.locator('#restart').click();
      await demo.locator('[data-node="timing"][data-pick="already"]').waitFor();
      await check(demo,label+' reset');
      if(dpr===2 && (width===420||width===1000)) {
        const node=demo.locator('#active-node');
        await node.evaluate((el)=>scrollTo(0,scrollY+el.getBoundingClientRect().top-100));
        await node.locator('.q-card').evaluate(async (el)=>{
          await Promise.all(el.getAnimations().map((animation)=>animation.finished.catch(()=>{})));
          await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        });
        const r=await node.boundingBox();
        const clip={x:Math.max(0,Math.floor(r.x)-50),y:Math.max(0,Math.floor(r.y)-15),width:Math.min(width-Math.max(0,Math.floor(r.x)-50),Math.ceil(r.width)+55),height:Math.min(420,Math.ceil(r.height)+30)};
        await page.screenshot({path:join(output,label+'.png'),clip});
      }
      console.log(`${label}: centered dots and first-dot start passed through answering and reset`);
      await page.close();
    }
    // Keep normal motion enabled to ensure pop/line animations don't alter the shared axis.
    const motion=await browser.newPage({viewport:{width:1000,height:1000}});
    await motion.goto(`${base}/prototypes/medicare/`,{waitUntil:'domcontentloaded'});
    await motion.locator('[data-node="timing"][data-pick="already"]').click();
    await check(motion,engine+' normal motion');
    await motion.close();
  } finally {await browser.close();}
}
await writeFile(join(output,'measurements.json'),JSON.stringify(results,null,2));
