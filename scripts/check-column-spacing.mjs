import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-column-spacing';
const widths = [320, 420, 833, 834, 900, 1023, 1024, 1280, 1440, 1679, 1680, 1920, 2559, 2560, 2633, 3200];
const results = [];
await mkdir(output, { recursive: true });
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id]'));
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(250);
      const layout = await page.evaluate(() => {
        const container = document.querySelector('[data-framer-name="Column Container"]');
        const root = container.parentElement;
        const rootRect = root.getBoundingClientRect(), gridRect = container.getBoundingClientRect();
        const footer = document.querySelector('[data-framer-name="v2/Footer"]');
        const columns = [...container.children].filter((el) => el.getBoundingClientRect().width > 0);
        return {
          padding: getComputedStyle(root).padding,
          topPadding: gridRect.top - rootRect.top,
          footerGap: footer.getBoundingClientRect().top - gridRect.bottom,
          overflow: document.documentElement.scrollWidth - innerWidth,
          columns: columns.map((column) => {
            const rect = column.getBoundingClientRect();
            const cards = [...column.children].filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
              .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            return {
              name: column.dataset.framerName, x: rect.x, width: rect.width,
              firstInset: cards[0].getBoundingClientRect().top - rect.top,
              lastInset: rect.bottom - cards.at(-1).getBoundingClientRect().bottom,
              cards: cards.map((card, index) => ({
                name: card.dataset.brName || card.dataset.framerName,
                gap: index ? card.getBoundingClientRect().top - cards[index - 1].getBoundingClientRect().bottom : null,
              })),
            };
          }),
          media: ['Cloud People', 'Triton Player'].map((name) => {
            const card = document.querySelector(`[data-framer-name="${name}"]`);
            const rect = card.getBoundingClientRect(), media = card.querySelector('iframe').getBoundingClientRect();
            return { name, insets: [media.top - rect.top, media.left - rect.left, rect.right - media.right, rect.bottom - media.bottom] };
          }),
        };
      });
      const label = `${engine}-${width}`;
      assert.equal(layout.padding, '20px', `${label}: outer padding`);
      assert.ok(Math.abs(layout.topPadding - 20) < 1, `${label}: top padding`);
      assert.ok(Math.abs(layout.footerGap - 20) < 1, `${label}: Thank You gap`);
      assert.ok(layout.overflow <= 1, `${label}: no horizontal overflow`);
      assert.equal(layout.columns.length, width < 834 ? 1 : width < 1024 ? 2 : width < 2560 ? 3 : 4);
      assert.equal(layout.columns.reduce((count, col) => count + col.cards.length, 0), 26, `${label}: every project visible`);
      for (const [index, column] of layout.columns.entries()) {
        assert.ok(Math.abs(column.firstInset) < 1 && Math.abs(column.lastInset) < 1, `${label}: ${column.name} has no extra vertical padding`);
        if (index) assert.ok(Math.abs(column.x - layout.columns[index - 1].x - layout.columns[index - 1].width - 20) < 1, `${label}: horizontal gutter`);
        for (const card of column.cards) if (card.gap !== null) assert.ok(Math.abs(card.gap - 20) < 1, `${label}: ${column.name} / ${card.name}: gap ${card.gap}`);
      }
      for (const media of layout.media) assert.ok(media.insets.every((inset) => Math.abs(inset) < 1), `${label}: ${media.name} has unused transparent space: ${media.insets}`);
      results.push({ engine, width, ...layout });
      console.log(`${label}: all card gaps, gutters, outer padding and footer gap are 20px; media fills its cards`);
      if ([420, 900, 1440, 1920, 2560, 3200].includes(width)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: join(output, `${label}-top.png`) });
        for (const name of ['Cloud People', 'Triton Player']) {
          await page.locator(`[data-framer-name="${name}"]`).scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(output, `${label}-${name.split(' ')[0]}.png`) });
        }
      }
    }
  } finally { await browser.close(); }
}
await writeFile(join(output, 'measurements.json'), JSON.stringify(results, null, 2));
