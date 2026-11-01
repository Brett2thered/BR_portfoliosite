import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-responsive-order';
// Independent editorial fixture: do not derive this from runtime placement.
const feed = [1, 3, 27, 18, 20, 2, 19, 9, 14, 25, 4, 5, 7, 12, 15, 6, 17, 13, 16, 26, 24, 21, 10, 22, 8, 11, 23];
const stats = [8, 11, 23];
const widths = [320, 420, 833, 834, 900, 1023, 1024, 1440, 2559, 2560, 2633, 3199, 3200, 3840];
const countAt = (width) => width >= 3200 ? 5 : width >= 2560 ? 4 : width >= 1024 ? 3 : width >= 834 ? 2 : 1;
const expectedColumns = (count) => {
  if (count === 1) return [feed];
  const columns = Array.from({ length: count }, () => []);
  columns[0].push(1, 3);
  feed.slice(2).forEach((id, index) => columns[(index + 1) % count].push(id));
  return columns;
};
const results = [];
await mkdir(output, { recursive: true });

async function measure(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-framer-name="Column Container"]');
    const visible = (node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    const columns = [...grid.children].filter(visible).map((column) => ({
      name: column.dataset.framerName, x: column.getBoundingClientRect().x, width: column.getBoundingClientRect().width,
      cards: [...column.children].filter(visible).map((card) => {
        const rect = card.getBoundingClientRect();
        return { id: Number(card.dataset.brId), top: rect.top, bottom: rect.bottom, width: rect.width, cssOrder: getComputedStyle(card).order, rank: Number(card.dataset.brFeedOrder) };
      }),
    }));
    const cards = columns.flatMap((column) => column.cards);
    return {
      width: innerWidth, columns, cards,
      overflow: document.documentElement.scrollWidth - innerWidth,
      footer: document.querySelector('[data-framer-name="v2/Footer"]').getBoundingClientRect().top,
      levelsTotal: document.querySelectorAll('[data-br-id="14"]').length,
      levelsVisible: [...document.querySelectorAll('[data-br-id="14"]')].filter(visible).length,
      originalNodesRetained: window.__orderingOriginalCards.every((node) => node.isConnected && grid.contains(node)),
      originalMediaRetained: window.__orderingOriginalMedia.every((node) => node.isConnected && grid.contains(node)),
      originalCount: window.__orderingOriginalCards.length,
      originalMediaCount: window.__orderingOriginalMedia.length,
    };
  });
}

function verify(layout, label) {
  const count = countAt(layout.width);
  assert.equal(layout.columns.length, count, `${label}: column count`);
  assert.equal(layout.cards.length, 27, `${label}: all unique cards visible`);
  assert.equal(new Set(layout.cards.map((card) => card.id)).size, 27);
  assert.deepEqual(layout.columns.map((column) => column.cards.map((card) => card.id)), expectedColumns(count), `${label}: deterministic editorial placement`);
  assert.deepEqual(layout.cards.slice().sort((a, b) => a.rank - b.rank).map((card) => card.id), feed, `${label}: global editorial sequence`);
  assert.deepEqual(layout.columns[0].cards.slice(0, 2).map((card) => card.id), [1, 3], `${label}: Hello and video pinned in upper-left`);
  for (const column of layout.columns) {
    assert.deepEqual(column.cards.slice().sort((a, b) => a.top - b.top).map((card) => card.id), column.cards.map((card) => card.id), `${label}: visual order matches DOM`);
    assert.ok(column.cards.every((card) => card.cssOrder === '0'), `${label}: reset legacy order on every outer wrapper`);
    assert.ok(column.cards.every((card) => Math.abs(card.width - column.width) < 1), `${label}: cards fill their column`);
    const firstStat = column.cards.findIndex((card) => stats.includes(card.id));
    if (firstStat >= 0) assert.ok(column.cards.slice(firstStat).every((card) => stats.includes(card.id)), `${label}: stats follow other content in their column`);
  }
  const openingBottom = Math.max(...layout.cards.filter((card) => feed.slice(0, 7).includes(card.id)).map((card) => card.bottom));
  assert.ok(layout.cards.filter((card) => stats.includes(card.id)).every((card) => card.top > openingBottom), `${label}: stats below opening projects`);
  assert.ok(layout.footer >= Math.max(...layout.cards.map((card) => card.bottom)), `${label}: Thank You last`);
  assert.ok(layout.overflow <= 1, `${label}: no horizontal overflow`);
  assert.equal(layout.levelsTotal, 2); assert.equal(layout.levelsVisible, 1);
  assert.ok(layout.originalNodesRetained && layout.originalMediaRetained, `${label}: preserve actual cards, links and media nodes`);
  assert.equal(layout.originalCount, 28, `${label}: test captured every original wrapper, including the hidden duplicate`);
  assert.ok(layout.originalMediaCount > 0);
}

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 420, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const grid = document.querySelector('[data-framer-name="Column Container"]');
        window.__orderingOriginalCards = grid ? [...grid.children].flatMap((column) => [...column.children]) : [];
        window.__orderingOriginalMedia = grid ? [...grid.querySelectorAll('video, iframe')] : [];
      }, { once: true });
    });
    await context.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id]'));
    for (const width of [...widths, ...widths.slice().reverse()]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(100);
      const layout = await measure(page);
      verify(layout, `${engine}/${width}`);
      results.push({ engine, ...layout });
      if (widths.includes(width)) console.log(`${engine} ${width}: ${layout.columns.length} columns, pinned intro, priority projects, late stats, complete feed`);
      if ([420, 900, 1440, 2560, 3200, 3840].includes(width)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: join(output, `${engine}-${width}-opening.png`) });
      }
    }
    // Late media/fonts must not select a new column or editorial order.
    for (const width of [2560, 3200]) {
      let release;
      const ready = new Promise((resolve) => { release = resolve; });
      const delayed = await context.newPage();
      await delayed.setViewportSize({ width, height: 1000 });
      await delayed.route('**/*', async (route) => {
        if (['image', 'font'].includes(route.request().resourceType())) await ready;
        return route.request().url().startsWith(base) ? route.continue() : route.abort();
      });
      await delayed.goto(base, { waitUntil: 'domcontentloaded' });
      await delayed.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id]'));
      const before = await measure(delayed);
      verify(before, `${engine}/${width}/cold-delayed`);
      release();
      await delayed.evaluate(() => document.fonts.ready);
      await delayed.waitForTimeout(300);
      const after = await measure(delayed);
      verify(after, `${engine}/${width}/loaded`);
      assert.deepEqual(after.columns.map((col) => col.cards.map((card) => card.id)), before.columns.map((col) => col.cards.map((card) => card.id)));
      await delayed.close();
    }
    // Saved preferences must not move public cards on cold load or resize.
    const saved = await context.newPage();
    await saved.addInitScript((ids) => {
      const reverse = ids.slice().reverse().map((id) => 'card-' + id);
      localStorage.setItem('br_card_order_v1', JSON.stringify(Object.fromEntries(['one', 'two', 'three', 'four', 'five'].map((key) => [key, reverse]))));
    }, feed);
    await saved.setViewportSize({ width: 3200, height: 1000 });
    await saved.goto(base, { waitUntil: 'domcontentloaded' });
    await saved.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id]'));
    for (const width of [3200, 1440, 900, 420, 3840]) {
      await saved.setViewportSize({ width, height: 1000 });
      await saved.waitForTimeout(100);
      verify(await measure(saved), `${engine}/${width}/stored-preferences-public`);
    }
    await saved.evaluate(() => localStorage.removeItem('br_card_order_v1'));
    await saved.close();
    // Editor recognizes every card at every range, including all of Column 5
    // and the four references that share a Framer name but not a runtime ID.
    await page.setViewportSize({ width: 3200, height: 1000 });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__brEdit.enter());
    assert.equal(await page.evaluate(() => window.__brEdit.bp()), 'five');
    assert.equal(await page.evaluate(() => window.__brEdit.state.cards.length), 27);
    assert.equal(await page.evaluate(() => new Set(window.__brEdit.state.cards.map((card) => card.key)).size), 27);
    for (const [width, key] of [[420, 'one'], [900, 'two'], [1440, 'three'], [2560, 'four'], [3200, 'five']]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction((bp) => window.__brEdit.bp() === bp, key);
      assert.equal(await page.evaluate(() => window.__brEdit.state.cards.length), 27);
      verify(await measure(page), `${engine}/${width}/active-editor`);
    }
    await Promise.all([page.waitForEvent('domcontentloaded'), page.evaluate(() => window.__brEdit.exit())]);
    await page.waitForFunction(() => window.__brTheme && document.querySelector('[data-br-id]'));
    verify(await measure(page), `${engine}/editor-exit`);
    await context.close();
  } finally { await browser.close(); }
}
await writeFile(join(output, 'measurements.json'), JSON.stringify(results, null, 2));
