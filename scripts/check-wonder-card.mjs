import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const output = process.argv[3] || '/private/tmp/br-wonder-card';
await mkdir(output, { recursive: true });
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    // Exercise both the reveal wrapper and the original card without it.
    for (const loaders of [true, false]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      if (!loaders) await page.route('**/card-loaders.js', route => route.abort());
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__brTheme);
      for (const width of [320, 420, 833, 834, 1023, 1024, 1440, 2560, 3200, 3840]) {
        await page.setViewportSize({ width, height: 1000 });
        const card = page.locator('[data-br-id="26"]');
        await card.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-br-id="26"]').querySelector('img').complete);
        const layout = await card.evaluate(card => {
          const rect = card.getBoundingClientRect();
          const box = element => {
            const r = element.getBoundingClientRect();
            return { top: r.top - rect.top, bottom: r.bottom - rect.top,
              left: r.left - rect.left, right: r.right - rect.left,
              centerX: (r.left + r.right) / 2 - rect.left,
              centerY: (r.top + r.bottom) / 2 - rect.top, width: r.width, height: r.height };
          };
          return { width: rect.width, height: rect.height,
            chip: box(card.querySelector('[data-framer-name="Text Chip"]')),
            logo: box(card.querySelector('[data-framer-name="logo-wonderworkshop"]')),
            label: card.querySelector('[data-framer-name="Text Chip"]').textContent.trim(),
            href: card.getAttribute('href'), radius: getComputedStyle(card).borderRadius };
        });
        const label = `${engine} ${width}px, loaders ${loaders ? 'on' : 'off'}`;
        assert.equal(layout.label, 'Work');
        assert.equal(layout.href, 'https://www.makewonder.com/dash/');
        assert.equal(layout.radius, '10px');
        assert.ok(Math.abs(layout.chip.top - 30) < 1, `${label}: Work label must be at the top, got ${layout.chip.top}px`);
        assert.ok(layout.logo.top > layout.chip.bottom + 20, `${label}: logo belongs below the title in the card body`);
        assert.ok(Math.abs(layout.logo.centerY - layout.height / 2) < 1, `${label}: logo is vertically centered`);
        for (const part of [layout.chip, layout.logo]) {
          assert.ok(Math.abs(part.centerX - layout.width / 2) < 1, `${label}: content is horizontally centered`);
          assert.ok(part.left >= 19 && part.right <= layout.width - 19, `${label}: content fits with consistent breathing room`);
        }
        assert.ok(Math.abs(layout.logo.width / layout.logo.height - 1336 / 528) < .02, `${label}: logo proportions preserved`);
        if (loaders && [420, 1440, 3200].includes(width)) {
          await page.waitForFunction(() => !document.querySelector('[data-br-id="26"]').hasAttribute('aria-busy') || document.querySelector('[data-br-id="26"]').getAttribute('aria-busy') === 'false');
          await card.screenshot({ path: join(output, `${engine}-${width}.png`) });
        }
        console.log(`${label}: title at top, logo centered, link and radius preserved`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
}
