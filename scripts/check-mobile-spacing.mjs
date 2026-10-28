import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, webkit } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const outputDir = process.argv[3] || "/private/tmp/br-mobile-spacing";
const widths = [320, 375, 390, 420, 430, 768, 833];
const results = [];
const failures = [];
const openingOrder = ["Intro", "Brett Video", "Cloud People", "Anchor Maps", "1PRM", "Meta", "Levels", "Anthem", "Doc.ai"];
await mkdir(outputDir, { recursive: true });

for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 420, height: 912 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__brTheme && document.querySelector("[data-br-id]"));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 912 });
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => {
        const columns = document.querySelectorAll('[data-framer-name="Column Container"] > div');
        const cards = Array.from(columns).flatMap((column) => Array.from(column.children))
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return getComputedStyle(node).display !== "none" && rect.width > 0 && rect.height > 0;
          })
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        return {
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          footerTop: document.querySelector('[data-framer-name="v2/Footer"]').getBoundingClientRect().top,
          finalProjectBottom: cards[cards.length - 1].getBoundingClientRect().bottom,
          videoClip: getComputedStyle(document.querySelector('[data-framer-name="Brett Player"]')).clipPath,
          videoRadius: getComputedStyle(document.querySelector('[data-framer-name="Brett Player"] iframe')).borderTopLeftRadius,
          cards: cards.map((card, index) => {
            const rect = card.getBoundingClientRect();
            const previous = cards[index - 1]?.getBoundingClientRect();
            const surface = /-container(?:\s|$)/.test(card.className) ? card.firstElementChild : card;
            const media = card.matches('[data-framer-name="Triton Player"], [data-framer-name="Cloud People"]')
              ? card.querySelector("iframe")?.getBoundingClientRect() : null;
            const styles = getComputedStyle(surface);
            return {
              name: card.dataset.brName || card.dataset.framerName,
              left: rect.left,
              right: rect.right,
              height: rect.height,
              gap: previous ? rect.top - previous.bottom : null,
              radii: [styles.borderTopLeftRadius, styles.borderTopRightRadius,
                styles.borderBottomLeftRadius, styles.borderBottomRightRadius],
              media: media ? { top: media.top - rect.top, bottom: rect.bottom - media.bottom,
                left: media.left - rect.left, right: rect.right - media.right } : null,
            };
          }),
        };
      });
      results.push({ engine, width, ...metrics });
      try {
        assert.equal(metrics.cards.length, 26, "All 26 unique cards, including Hustle, must remain visible");
        assert.deepEqual(metrics.cards.slice(0, 9).map((card) => card.name), openingOrder,
          "The opening nine cards must follow the requested mobile sequence");
        assert.ok(metrics.footerTop >= metrics.finalProjectBottom, "Thank You must remain after every project");
        assert.equal(metrics.videoRadius, "10px", "Talking video must match the 10px card corners");
        assert.ok(metrics.videoClip.includes("10px"), "Talking video must clip the embedded player to its corners");
        assert.ok(metrics.scrollWidth <= metrics.viewport, "Page must not scroll horizontally");
        for (const card of metrics.cards) {
          if (card.gap !== null) assert.ok(Math.abs(card.gap - 20) < 1,
            `${card.name}: expected 20px preceding gap, received ${card.gap}`);
          assert.ok(card.radii.every((radius) => radius === "10px"), `${card.name}: corner radius drift`);
          if (card.media) assert.ok(Object.values(card.media).every((edge) => Math.abs(edge) < 1),
            `${card.name}: media does not fill its card: ${JSON.stringify(card.media)}`);
        }
        console.log(`${engine} ${width}px: all 26 cards, 20px gaps, 10px corners, media fills cards`);
      } catch (error) {
        failures.push(`${engine} ${width}px: ${error.message}`);
      }

      if ([375, 420, 430].includes(width)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(outputDir, `${engine}-${width}-opening.png`) });
        for (const name of ["Ranked Designer", "Triton Player", "Resident Designer Video", "Cloud People"]) {
          const card = page.locator(`[data-framer-name="${name}"]`);
          await card.scrollIntoViewIfNeeded();
          await page.evaluate((selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            scrollTo(0, scrollY + rect.bottom - 200);
          }, `[data-framer-name="${name}"]`);
          await page.waitForTimeout(200);
          await page.screenshot({ path: join(outputDir, `${engine}-${width}-${name.replaceAll(" ", "-")}.png`) });
        }
      }
    }

    // Inspect every card at the screenshot's phone width. Separate contact
    // sheets keep each card legible instead of shrinking a 10,000px page.
    await page.setViewportSize({ width: 420, height: 912 });
    await page.waitForTimeout(300);
    const cards = await page.locator('[data-framer-name="Column Container"] > div > *').all();
    const thumbnails = [];
    for (const card of cards) {
      if (!await card.isVisible()) continue;
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const name = await card.getAttribute("data-br-name") || await card.getAttribute("data-framer-name") || "Project";
      const path = join(outputDir, `${engine}-card-${thumbnails.length + 1}.png`);
      await card.screenshot({ path });
      thumbnails.push({ name, src: `data:image/png;base64,${(await readFile(path)).toString("base64")}` });
    }
    const gallery = await browser.newPage({ viewport: { width: 620, height: 1600 }, deviceScaleFactor: 1 });
    for (let index = 0; index < thumbnails.length; index += 6) {
      const batch = thumbnails.slice(index, index + 6);
      await gallery.setContent(`<style>
        body{margin:0;padding:16px;background:#ededed;font:14px sans-serif}
        main{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        figure{margin:0}img{width:100%;display:block}figcaption{padding:6px 0}
      </style><main>${batch.map(({ name, src }) => `<figure><img src="${src}"><figcaption>${name}</figcaption></figure>`).join("")}</main>`);
      await gallery.locator("img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
      const height = await gallery.evaluate(() => document.querySelector("main").getBoundingClientRect().bottom + 16);
      await gallery.setViewportSize({ width: 620, height: Math.ceil(height) });
      await gallery.screenshot({ path: join(outputDir, `${engine}-review-${index / 6 + 1}.png`) });
    }
  } finally {
    await browser.close();
  }
}

await writeFile(join(outputDir, "measurements.json"), JSON.stringify(results, null, 2));
if (failures.length) throw new Error(failures.join("\n"));
