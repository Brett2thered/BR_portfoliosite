# Medicare Portfolio Case Study Implementation Plan

> **For agentic workers:** Execute inline with the executing-plans workflow; no subagents are needed for this shared homepage change.

**Goal:** Add an animated, reference-based Medicare card linking to a case study with a working embedded prototype and the creator’s recruitment story.

**Architecture:** Insert a static native card through a repeatable build script, register it with the existing responsive layout, and scope new styles/motion to that card. Keep the supplied HTML prototype isolated under `export/prototypes/medicare/` with scripts-only sandboxing; keep its existing interactions and label all guidance as sample content, not an official service.

**Tech Stack:** Static HTML/CSS/JS, Node build scripts, Playwright Chromium and WebKit.

### 1. Test the missing feature first

- [x] Create `scripts/check-medicare-page.mjs`. Assert a Medicare card exists, native navigation opens `medicare.html`, and the supplied prototype is embedded and interactive.
- [x] Run `node scripts/check-medicare-page.mjs`; observe failure for the missing card before implementation.

### 2. Build the reference-based looping card

- [x] Add `scripts/build-medicare-card.mjs` and `scripts/templates/medicare-card.html`. The generator replaces only its marked insertion and adds scoped CSS/JS once.
- [x] Copy the supplied hero screenshot, unchanged, to `export/assets/medicare/hero-reference.png`. Use SVG clipping of the reference’s collage plus transform/opacity animation; no new stock or generated imagery.
- [x] Add `export/medicare-card.css` and `export/medicare-card.js` for a seamless people/card loop, pause control, viewport suspension, and reduced-motion still state.
- [x] Register Medicare as card 27 in `export/theme.js`; keep the existing first nine mobile cards, insert Medicare next, and leave Thank You last.

### 3. Build the explanation and embed

- [x] Add `export/medicare.html` with the shared case-study styles: overview and approach at the top, recruitment by the National Design Agency, collaboration, reduction from 30-plus steps to five questions, and an explanation of progressive disclosure.
- [x] Copy the supplied flow to `export/prototypes/medicare/index.html`. Replace the official-government banner with a persistent portfolio-prototype/sample-data notice, add noindex metadata, and retain all existing local branching/chat/reset behavior.
- [x] Add a labeled browser mockup iframe (`sandbox="allow-scripts allow-modals"`) plus open-prototype and reset links. Do not give the frame same-origin access or connect it to enrollment, AI, or analytics services.
- [x] Add `/medicare` routing and sitemap entry, and include the generator in prepublish. Update documented card counts and existing exact-count test assertions from 26 to 27 visible cards.

### 4. Verify and hand off a preview

- [x] Test at 320, 420, 900, 1440 and 2560px in Chromium/WebKit: complete card coverage, consistent spacing/radius, native keyboard navigation, loop progress, pause, viewport suspension, reduced motion, no overflow.
- [x] Drive real embedded questions through timing, benefits, employer coverage, coverage comparison, prescriptions, sample plan and final route; verify edit and reset. Test an alternate branch and contextual help.
- [x] Save and inspect mobile/desktop screenshots and multiple loop phases. Run existing spacing, Intel, and Anthem regressions after updating count expectations.
- [x] Run `npm run prepublishOnly`, JS syntax checks and `git diff --check`. Start/confirm the preview and link the user to it. Leave changes uncommitted unless requested.

### Verification results

- Medicare journey: all 10 Chromium/WebKit viewport cases passed, plus reduced-motion and no-JavaScript fallbacks.
- Motion: four browser/viewport cases passed, including exact matching transforms at 0 and 9000ms and offscreen suspension.
- Existing spacing: all 32 cases passed. Intel and Anthem: eight cases each passed.
- Independent read-only code review: no material findings.
- Preview responds with HTTP 200 at `http://127.0.0.1:4173/medicare.html`. Automatic in-app browser opening was unavailable because of a pre-existing local symlink-root configuration error; use the preview link directly.

### Requested homepage refinement

- Removed the pause button, metric caption, and corner arrow from the homepage card.
- Added a monochrome National Design Studio hover/keyboard-focus face using the official wordmark from `ndstudio.gov`; pointer exit restores Medicare. Touch remains one-tap project navigation.
- Kept viewport/reduced-motion suspension and paused the hidden collage during hover/focus.
- Corrected the case-study organization name to National Design Studio.
- `scripts/check-medicare-hover.mjs`: eight Chrome/Safari-engine size cases, plus touch and reduced-motion cases passed. Existing direct-entry and seamless-loop checks passed after the update.
