# ASCII media loading

The homepage and all interior HTML pages share `export/ascii-loaders.js`.
`card-loaders.js` provides homepage readiness checks; `media-loaders.js` handles
interior images, videos, and lazy embeds. Text is displayed immediately.

The renderer uses the MIT-licensed `ascii-reveal` 0.3.0 JavaScript core, pinned
to commit `f602e204232d2d31de2b67c66a166bcdbde51602`. Source metadata and the
license are kept in `export/vendor/ascii-reveal/`. No CDN or React runtime is
required. `scripts/build-ascii-assets.mjs` pre-renders its skeleton templates.

Overlays and sampled previews live outside Framer's owned markup. Original
media nodes, links, captions, accessibility text, and player controls stay in
place. Native videos and video embeds have small local poster images, indexed
by source URL in `export/ascii-posters.json`. The generated skeleton asset
includes that manifest. The renderer never reads cross-origin player pixels.
Unknown embeds (for example scheduling or 3D tools) retain a neutral fallback.

Once a poster arrives, the waiting field is painted in its actual colors. When
the media is ready, the upstream `dither` preset resolves a color-safe canvas
proxy into the preview, then the overlay fades to the original live media.
Same-origin videos can use their current frame. Monochrome source footage
stays monochrome. The waiting field is static and repaints only on size changes;
the short animated decode runs at the upstream library's normal speed.

The overlay borrows corners from the nearest rounded surface with matching
bounds, not necessarily the immediate media wrapper. Panel clipping, the
sampled proxy, and the library overlay all share those corners. An opaque
surface prevents the full image flashing through behind an unfinished wave.
Font-loading events refresh overlay geometry when late web fonts move a card.

- Cached content is shown immediately; no artificial loading delay is used.
- Offscreen skeletons do not animate; at most two decode effects run at once.
- Reduced motion skips animated decoding.
- A missing engine falls back to the initial glyph field and a short fade.
- Failed media shows a static “Preview unavailable” state without blocking links.
- Interior embeds/videos after the first load near the viewport; browser Back
  history and embed `src` attributes are preserved.
- `data-br-no-skeleton` skips the loader and lazy loading for a media element.
- `data-br-eager` keeps an interior video/embed eager while retaining its loader.

## Preview and checks

Run `npm run preview`, then open <http://127.0.0.1:4173/>. For a deliberate
1.2-second demonstration of otherwise cached loading states, use
<http://127.0.0.1:4173/?ascii-preview=1>. The query flag is for review only.

Run `npm run test:ascii` against the running preview. It uses Playwright in
Chromium and WebKit at mobile and desktop widths, saves loading/decode/loaded
screenshots, and checks reduced motion, errors, a missing engine, and cached
media. The deterministic slow-network matrix holds real image requests and
uses controlled video/embed fixtures. The separate `check-card-loaders.mjs`,
`check-media-loaders.mjs`, and `check-lazy-media.mjs` checks exercise real native
media as well. `check-mobile-spacing.mjs` and `check-responsive-layout.mjs`
protect the existing grid, card order, padding, and radii.
`npm run test:spacing` additionally checks every visible card gap, column
gutter, outer padding, footer gap, and full-bleed video edge across 16 widths
in Chromium and WebKit, including both sides of every column-count breakpoint.

`npm run test:ascii-colors` checks six pages in both engines at 420px and
1280px. It measures chromatic pixels and color buckets in the upstream decode
canvas (not the image below it), checks for canvas security errors, and uses a
temporary solid-color control to verify all four rounded corners in screenshot
pixels. A test-only readiness gate holds the homepage's talking-video poster
while those measurements run; other cards retain their normal timing. The
test waits for fonts before measuring screenshot coordinates. It also saves
the actual colored-glyph canvas frames and records video
of the homepage and Facebook case study. The Anchor Maps check uses its real
black-and-white opening instead of inventing color. Other native playback is
stubbed for this deterministic matrix; the poster assets are real project media.

After a new Framer export, run `npm run ascii-assets` and
`npm run media-loaders`. Both are included in `prepublishOnly`; script injection
is idempotent.

When adding or changing a video, first run `npm run media-posters` (requires
FFmpeg and network access for remote footage/public embed thumbnails). This
explicit step generates 640px JPEGs; it is not run during ordinary publishing.
Commit the generated assets and JSON manifest, then rebuild `ascii-assets`.
Use `npm run media-posters -- --force` if a video's contents changed without
changing its URL; normal runs reuse existing generated previews.
