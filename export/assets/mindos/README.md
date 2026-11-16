# MindOS portfolio assets

Source: `/Users/b/Desktop/Everything/BR_website/1_MindOS/`.

- `ideas.mp4`: `MindOS_FINAL.mp4`, resized to 960px, H.264, 24fps, silent.
- The cover now uses the full `ideas.mp4` loop. The old `cover.mp4` excerpt is retained but unused.
- `logo.svg`: unmodified copy of `/Users/b/Desktop/mindOS.svg`. The supplied white/mint logo fades out at 9–17% of each video cycle and returns at 76–86%, holding across the seam. Timing follows video playback, including buffering, seeks, and offscreen/hidden-tab pauses. Reduced motion displays a static logo. TEDx stays in a separate, always-visible layer.
- `anchor.mp4`, `connect.mp4`, `pick-and-place.mp4`, `scale.mp4`: corresponding square `MindOS-*.mov` sources, H.264, 24fps, silent. Original framing is preserved.
- JPEG posters are frames from those source clips; `cover.jpg` is a screenshot of the final homepage composition for social previews.
- TEDx logo: the existing `../img_19.png`, displayed as a separate sharp, undistorted layer.

The supplied `TedX.mp4` was reviewed through sampled frames and a local speech transcription to inform the writing. It is not included in the site. The sole talk player uses the existing card’s YouTube ID, `yFmuxjGLdQI`.

Copy is based on the supplied talk and prototype footage. The talk describes communication losing the connections behind an idea, a VR workspace for books/websites/videos/3D models, an entrepreneur’s reference map, and expanding/collapsing models. Co-presenter: Serban Porumbescu. Event/year also confirmed by the [official TEDxSanFrancisco 2016 programme](https://www.tedxsanfrancisco.com/2016). No adoption, research, or business outcomes are inferred.

Design: quiet mineral grey (#e7e7e7), graphite violet (#3b3549), original turquoise/violet geometry, and the existing TEDx red. The supplied MindOS wordmark emerges over a dark violet field within the original motion; TEDx remains fixed. Established Inter case-study typography. Layout and runtime ID 22 stay within the existing editorial sequence.

Checks: `node scripts/check-mindos.mjs` plus the repository’s responsive-layout, spacing, mobile-spacing, stats and SEO checks.
