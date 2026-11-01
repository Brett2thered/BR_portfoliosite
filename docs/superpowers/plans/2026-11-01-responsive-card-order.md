# Deterministic Responsive Card Ordering

**Goal:** Keep the introduction together, prioritize the requested projects, move stats later, and support one through five columns without changing card styling.

**Architecture:** One editorial sequence feeds one deterministic placement function. Column 1 always starts with Hello and the introductory video; the remaining sequence is assigned round-robin starting in Column 2. Existing nodes are moved, never cloned. CSS resets `order` on every outer card wrapper at every width so Framer styles cannot override that DOM order.

**Constraints:** Preserve all pending SEO work outside this commit. Do not change stats HTML, CSS, fonts, typography, numbers or artwork. Preserve all 27 unique cards, the hidden Levels duplicate, and the final Thank You card.

## Sequence and breakpoints

```js
const feed = [1, 3, 27, 18, 20, 2, 19, 9, 14, 25, 4, 5, 7, 12, 15, 6, 17, 13, 16, 26, 24, 21, 10, 22, 8, 11, 23];
// <834: 1; >=834: 2; >=1024: 3; >=2560: 4; >=3200: 5 columns.
// Wider layouts: columns[0] = [1, 3]; rest[i] -> columns[(i + 1) % count].
```

The remaining non-stat sequence is the existing mobile sequence after removing only the newly prioritized projects and the three stats. No other editorial changes are permitted.

## Steps

- [x] Replace the limited responsive regression with Chromium/WebKit checks at each threshold, forward/reverse resize, cold four/five-column loads, and deferred media/fonts. Verify the existing code fails.
- [x] Replace the four independent runtime paths in `export/theme.js` with the sequence and placement above; preserve node identity and emit a layout notification after breakpoint changes.
- [x] Update `export/theme.css` to reset outer-wrapper order globally and give Column 5 the same spacing, width, flex behavior and card-relative sizing as the other columns.
- [x] Align `export/edit-mode.js` with the five layout ranges, use runtime IDs for unique keys, and prevent stored transforms from leaking into normal browsing during resize.
- [x] Update spacing/mobile/Medicare assertions, package scripts, `CARDS.md`, and root `AGENTS.md` with the user's fixed constraints.
- [x] Run browser regressions, inspect mobile/tablet/desktop/four/five-column screenshots, and review the change. Stage only this task, excluding the pre-existing SEO hunks.
- [ ] Commit, validate the actual committed tree independently of pending SEO files, fast-forward main and push `origin main`. Preserve unrelated working-tree changes.

## Verification

```sh
npm run test:responsive-layout
npm run test:spacing
npm run test:mobile-spacing
npm run test:stats
node --check export/theme.js
node --check export/edit-mode.js
git diff --check
```

Expected: correct one/two/three/four/five column counts; [1,3] pinned to Column 1; exact priority/remaining/stats order; all outer CSS order values zero; all 27 cards and original media nodes retained; one hidden Levels duplicate; 20px gutters/gaps, fluid Column 5, no horizontal overflow, and Thank You below the entire feed. Stats source/style files stay byte-identical.

## Verification notes

The original regression failed on the incorrect mobile sequence; browser measurements also showed nonzero legacy `order` and the separated introduction on tablet/desktop. The corrected regression passes in Chromium and WebKit across 14 widths in both resize directions, cold four/five-column pages with delayed images/fonts, preserved original nodes/media, seeded saved preferences in ordinary browsing, and active editor resizes through all five ranges. Spacing passes at 18 widths per engine; the seven mobile widths per engine and native stats regression also pass. Mobile/tablet/five-column screenshots were inspected. Independent review found no blocking issues and verified the remaining non-stat sequence against baseline. Stats CSS and generator have no diff. The pre-existing SEO patch was removed from the commit index only, not the working tree.
