/* Audit which canonical cards (theme.js registry) are visible per breakpoint. */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("http://localhost:5173/", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const widths = [390, 800, 1200, 1512, 1700, 2000, 2800];
  for (const w of widths) {
    await p.setViewportSize({ width: w, height: 1000 });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const reg = (window.__brTheme && window.__brTheme.cards) || [];
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
      const visibleSet = {};
      reg.forEach((c) => {
        const nodes = document.querySelectorAll('[data-br-id="' + c.id + '"]');
        visibleSet[c.id] = [...nodes].some(vis);
      });
      const missing = reg.filter((c) => !visibleSet[c.id]).map((c) => c.name);
      const visibleCount = reg.filter((c) => visibleSet[c.id]).length;
      const colInfo = [...document.querySelectorAll('[data-framer-name^="Column"]')].map((c) => ({ name: c.getAttribute("data-framer-name"), vis: vis(c), kids: [...c.children].filter(vis).length }));
      return { total: reg.length, visibleCount, missing, colInfo };
    });
    console.log(`\n=== ${w}px === visible ${r.visibleCount}/${r.total}`);
    console.log("  columns:", r.colInfo.map((c) => `${c.name}:${c.vis ? c.kids : "hidden"}`).join("  "));
    console.log("  MISSING:", r.missing.length ? r.missing.join(", ") : "none");
  }
  await b.close();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
