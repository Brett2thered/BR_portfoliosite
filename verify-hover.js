/*
 * Full verification of the card hover-zoom + shine.
 * Usage: node verify-hover.js [chromium|webkit]
 *
 * 1. REST DIFF at 1000/1512/1800 — script-blocked vs loaded must be
 *    pixel-near-identical at rest (Vimeo blocked in both for determinism).
 * 2. TRANSPORT (Triton, 1800) — content must scale in place on hover
 *    (no containing-block jumps), chip stays near its rest position.
 * 3. SHIMMER COVERAGE (1800) — every visible card root must show pixel
 *    change mid-sweep vs settled-hover.
 * 4. Corner stays rounded on Levels; console stays clean.
 */
const fs = require("fs");
const playwright = require("playwright");
const engine = process.argv[2] || "chromium";

const diffPixels = async (page, fileA, fileB) => {
  const load = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
  return page.evaluate(async ({ A, B }) => {
    const img = async (src) => { const i = new Image(); await new Promise((r, j) => { i.onload = r; i.onerror = j; i.src = src; }); return i; };
    const ia = await img(A), ib = await img(B);
    if (ia.width !== ib.width) return { widthMismatch: [ia.width, ib.width] };
    // full-page heights may differ slightly (overflow:hidden shortens the
    // document) — compare the common region and report the height delta.
    const h = Math.min(ia.height, ib.height);
    const cv = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = h; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, h).data; };
    const da = cv(ia), db = cv(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4)
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 9) n++;
    return { total: da.length / 4, diff: n, heightDelta: ia.height - ib.height };
  }, { A: load(fileA), B: load(fileB) });
};

(async () => {
  const browser = await playwright[engine].launch();
  const logs = [];
  const newPage = async (blockHover, width) => {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    await page.route("**vimeo**", (r) => r.abort());
    if (blockHover) await page.route("**/hover-animation.js", (r) => r.abort());
    else {
      page.on("console", (m) => { if (m.type() !== "info") logs.push(`[${m.type()}] ${m.text()}`); });
      page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
    }
    await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);
    return page;
  };

  // --- 1. rest diffs at three widths
  for (const w of [1000, 1512, 1800]) {
    const pA = await newPage(true, w);
    await pA.screenshot({ path: `/tmp/v-base-${w}.png`, fullPage: true });
    await pA.close();
    const pB = await newPage(false, w);
    await pB.screenshot({ path: `/tmp/v-with-${w}.png`, fullPage: true });
    const d = await diffPixels(pB, `/tmp/v-base-${w}.png`, `/tmp/v-with-${w}.png`);
    console.log(`REST DIFF @${w}: ${JSON.stringify(d)} (${d.diff !== undefined ? ((100 * d.diff) / d.total).toFixed(3) + "%" : "?"})`);
    await pB.close();
  }

  // --- 2 + 3 at 1800
  const p = await newPage(false, 1800);

  // Transport/Triton geometry through hover
  const triton = p.locator('a[data-framer-name="Triton Player"]:visible').first();
  await triton.scrollIntoViewIfNeeded();
  await p.mouse.move(0, 0);
  await p.waitForTimeout(400);
  const snapTriton = () => triton.evaluate((el) => {
    const card = el.getBoundingClientRect();
    const chip = el.querySelector('[data-framer-name="Text Chip"]').getBoundingClientRect();
    return { card: [card.x, card.y, card.width, card.height].map(Math.round), chipTopOffset: Math.round(chip.y - card.y), chipH: Math.round(chip.height) };
  });
  const tRest = await snapTriton();
  const r1 = await triton.evaluate((el) => { const c = el.getBoundingClientRect(); return { x: c.x - 12, y: c.y - 12, width: c.width + 24, height: c.height + 24 }; });
  await p.screenshot({ path: `/tmp/v-triton-rest-${engine}.png`, clip: r1 });
  await triton.hover();
  await p.waitForTimeout(1100);
  const tHov = await snapTriton();
  await p.screenshot({ path: `/tmp/v-triton-hov-${engine}.png`, clip: r1 });
  console.log(`TRITON rest: card=${tRest.card} chipTopOffset=${tRest.chipTopOffset}`);
  console.log(`TRITON hov:  card=${tHov.card} chipTopOffset=${tHov.chipTopOffset} (expect ≈ rest±(scale shift ~9px), NOT ±200px)`);

  // Shimmer coverage: every visible card root
  await p.mouse.move(0, 0);
  await p.waitForTimeout(600);
  const rootsInfo = await p.evaluate(() => {
    const roots = [];
    document.querySelectorAll('[data-framer-name^="Column"]').forEach((col) => {
      [...col.children].forEach((child) => {
        const root = /-container(\s|$)/.test(child.className) ? child.firstElementChild : child;
        if (!root || roots.includes(root)) return;
        if (((root.getAttribute("data-framer-name") || "").indexOf("Column") === 0)) return;
        roots.push(root);
      });
    });
    return roots.map((el, i) => {
      el.setAttribute("data-verify-id", "card-" + i);
      const r = el.getBoundingClientRect();
      return { id: "card-" + i, name: el.getAttribute("data-framer-name"), visible: !!(el.offsetWidth || el.offsetHeight), y: Math.round(r.y + scrollY) };
    });
  });
  const visible = rootsInfo.filter((r) => r.visible);
  console.log(`CARD ROOTS: ${rootsInfo.length} total, ${visible.length} visible at 1800`);
  let pass = 0, fail = [], unhoverable = [];
  for (const card of visible) {
    const loc = p.locator(`[data-verify-id="${card.id}"]`);
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      await p.mouse.move(0, 0);
      await p.waitForTimeout(250);
      const r = await loc.evaluate((el) => { const c = el.getBoundingClientRect(); return { x: Math.max(0, c.x), y: Math.max(0, c.y), width: Math.min(c.width, 1780), height: Math.min(c.height, 920) }; });
      await loc.hover({ timeout: 5000 });
      await p.waitForTimeout(220); // mid-sweep
      await p.screenshot({ path: "/tmp/v-mid.png", clip: r });
      await p.waitForTimeout(1200); // settled, band parked
      await p.screenshot({ path: "/tmp/v-set.png", clip: r });
      const d = await diffPixels(p, "/tmp/v-mid.png", "/tmp/v-set.png");
      const ok = d.diff > d.total * 0.01; // >1% of card pixels changed mid-sweep
      if (ok) pass++; else fail.push(`${card.name} (${((100 * d.diff) / d.total).toFixed(2)}%)`);
    } catch (e) {
      unhoverable.push(`${card.name} [${e.message.split("\n")[0]}]`);
    }
  }
  console.log(`SHIMMER: ${pass}/${visible.length} cards show sweep. ${fail.length ? "NO SWEEP: " + fail.join(", ") : "all swept"}`);
  if (unhoverable.length) console.log(`UNHOVERABLE (${unhoverable.length}): ${unhoverable.join("; ")}`);

  // Levels corner while hovered
  const levels = p.locator('a[data-framer-name="Levels"]:visible').first();
  await levels.scrollIntoViewIfNeeded();
  await p.mouse.move(0, 0);
  await p.waitForTimeout(300);
  await levels.hover();
  await p.waitForTimeout(1100);
  const lr = await levels.evaluate((el) => { const c = el.getBoundingClientRect(); return { x: c.x, y: c.y }; });
  await p.screenshot({ path: `/tmp/v-corner-${engine}.png`, clip: { x: lr.x - 15, y: lr.y - 15, width: 70, height: 70 } });

  console.log("CONSOLE:", logs.length ? logs.join(" | ") : "clean");
  await p.close();
  await browser.close();
})().catch((e) => { console.error("VERIFY FAILED:", e); process.exit(1); });
