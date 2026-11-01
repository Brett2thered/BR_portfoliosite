# Portfolio constraints

These are explicit user requirements. Preserve them in future changes unless the user explicitly changes them.

- Hello (runtime ID 1) is always first. The introductory video (ID 3) is directly below it: first/second on mobile and the first two positions in the upper-left column on every wider layout. Never separate them while changing column counts.
- Mobile opening: Hello → introductory video → Medicare (27) → 1PRM (18) → Cloud People (20) → Anchor Maps (2) → doc.ai (19).
- On wider layouts those priority projects lead the columns beside and immediately after the introduction.
- Stats (8, 11, 23) stay after the opening projects and other portfolio content. Do not change their typography, artwork, numbers, HTML or visual styling as part of a layout fix.
- Preserve the remaining non-stat sequence. `CARD_ORDER` in `export/theme.js` is the editorial source of truth; do not introduce another breakpoint-specific sequence.
- CSS viewport breakpoints: below 834px = 1 column; 834–1023px = 2; 1024–2559px = 3; 2560–3199px = 4; 3200px and above = 5. Columns 4 and 5 inherit the same 20px gutters, spacing, fluid sizing and card-relative styling.
- Reset legacy CSS `order` on the outer card wrappers at every breakpoint. Visual order must follow DOM order.
- Placement must be deterministic. Do not use card heights, media loading or font loading to select columns or change editorial order. Move existing nodes; do not clone cards/media or lose event listeners.
- Keep all 27 unique cards visible, retain the hidden duplicate Levels card as hidden, and keep Thank You after the complete feed.
- Keep the Hello card link-free. Do not add visible or hidden SEO navigation inside it.
- Saved local editor preferences must not affect ordinary visitors.

Run `npm run test:responsive-layout`, `npm run test:spacing`, `npm run test:mobile-spacing` and `npm run test:stats` for layout changes. Check Chromium/WebKit at breakpoint boundaries, cold four/five-column loads, delayed fonts/media and resizing in both directions. Inspect screenshots, not only code. Preserve unrelated working-tree changes and scope commits to the requested task.
