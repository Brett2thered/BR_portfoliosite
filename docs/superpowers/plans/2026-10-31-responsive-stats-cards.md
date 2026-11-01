# Responsive Stats Cards Implementation Plan

> **For agentic workers:** Execute inline; the three stats share one component and one responsive test matrix.

**Goal:** Replace the three exported stats cards with selectable, accessible text and CSS that remain readable at every masonry scale without image dependencies.

**Architecture:** `scripts/build-stats-cards.mjs` owns the three existing facts and statically replaces the original roots (including their component wrappers) at the same DOM positions. `export/stats-cards.css` styles a shared semantic section/shell/core structure with card-container-relative type and a CSS-only star row. No runtime rendering is required.

**Tech Stack:** HTML, CSS container units, Node, Playwright Chromium/WebKit.

### Verification first

- [x] Create `scripts/check-stats-cards.mjs` and observe the missing-native-cards assertion fail (`0 !== 3`).
- [x] Require three `.br-stat-card` sections, existing IDs 8/11/23, original facts, no `img/svg/canvas` or URL backgrounds, readable type, no clipping, 27 visible cards, and 200% text reflow.

### Native component

- [x] Add `scripts/build-stats-cards.mjs` with ranking/capital/rating definitions and `divEnd`/`replaceCard` helpers that fail on ambiguous or unbalanced source and replace their marked output idempotently.
- [x] Generate semantic sections with stable `stats-ranking`, `stats-capital`, and `stats-rating` fragment IDs, a Stats chip, hidden accessible headings, dark live-text metrics, original descriptions, and CSS-only rating stars.
- [x] Add `export/stats-cards.css`: 10px shells, intrinsic height, consistent padding, `clamp()` plus card-relative sizing on inner content, no metric shadows or fixed-position text.
- [x] Match capital/rating explicitly by Framer name in `export/theme.js`, retaining IDs and mobile order. Remove obsolete stat selectors from `export/theme.css` without changing reference/intro card styles.
- [x] Add the generator to `prepublishOnly` and document the source of truth in `CARDS.md`.

### Check and preview

- [x] Run `node scripts/check-stats-cards.mjs` across 320,420,768,834,900,1024,1440,1920,2560,3200px in both engines; inspect mobile, desktop, and wide-screen screenshots.
- [x] Verify 200% text at both 320/420px, blocked images/fonts, and no-JavaScript fallbacks. Run `npm run test:spacing` and `npm run test:medicare-hover` for layout and existing-card regressions.
- [x] Run `npm run prepublishOnly`, two byte-identical stats rebuilds for idempotency, `node --check scripts/build-stats-cards.mjs`, and `git diff --check`. Leave changes local and give the user a fresh preview link.

### Results

- All 20 browser/layout cases passed (60 individual stats measurements).
- Narrow-phone enlarged-text checks caught and fixed monetary-value and decorative-star overflow using container-relative caps. Body text retains the full enlarged rem size and card height grows intrinsically.
- All 32 spacing cases and existing Medicare hover/touch/reduced-motion checks passed.
- Independent read-only review found no material issues and verified unrelated homepage markup is byte-identical to the base after removing the stats substitutions and stylesheet link.
