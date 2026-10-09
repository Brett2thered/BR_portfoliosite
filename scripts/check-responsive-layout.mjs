import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const expectations = [
  { width: 1440, columns: 3 },
  { width: 900, columns: 2 },
];

const browser = await chromium.launch({ headless: true });

try {
  for (const expectation of expectations) {
    const page = await browser.newPage({ viewport: { width: expectation.width, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll("[data-br-id]").length > 0);

    const layout = await page.evaluate(() => {
      const columns = Array.from(document.querySelectorAll(
        '[data-framer-name="Column 1"], [data-framer-name="Column 2"], [data-framer-name="Column 3"]',
      ));
      const cards = Array.from(document.querySelectorAll("[data-br-id]"));
      const visible = cards.filter((card) => {
        const styles = getComputedStyle(card);
        const rect = card.getBoundingClientRect();
        return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });

      return {
        columns: columns.filter((column) => {
          const styles = getComputedStyle(column);
          return styles.display !== "none" && column.getBoundingClientRect().width > 0;
        }).length,
        totalProjects: new Set(cards.map((card) => card.dataset.brId)).size,
        visibleProjects: new Set(visible.map((card) => card.dataset.brId)).size,
      };
    });

    if (layout.columns !== expectation.columns) {
      throw new Error(`${expectation.width}px: expected ${expectation.columns} columns, received ${layout.columns}`);
    }
    if (layout.visibleProjects !== layout.totalProjects) {
      throw new Error(`${expectation.width}px: expected all ${layout.totalProjects} projects, received ${layout.visibleProjects}`);
    }

    console.log(`${expectation.width}px: ${layout.columns} columns, all ${layout.totalProjects} projects visible`);
    await page.close();
  }
} finally {
  await browser.close();
}
