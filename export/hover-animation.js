/*
 * Card hover-zoom + glassy shine — vanilla Motion (the Framer Motion family).
 * Depends on motion.js (window.Motion), which must load before this file.
 *
 * Covers EVERY masonry card: direct children of the Framer "Column" stacks —
 * project anchors, DIV cards (Stats, Hack, Intel, …), and component
 * containers (framer-*-container), whose real card is their sole child.
 *
 * On cursor hover the card's CONTENT zooms with a spring (an injected
 * wrapper is scaled, never the rounded card itself) and a glassy band sweeps
 * across once per hover-enter.
 *
 * Why the wrapper: transforming the rounded card makes Chromium/WebKit drop
 * the rounded overflow clip on composited children — corners render square.
 * Keeping the card untransformed means its border-radius clip never
 * degrades, so the corner radius stays exactly constant.
 *
 * Wrapper geometry: position:absolute; inset:0 makes the wrapper's box equal
 * the card's padding box at all times. When the hover transform turns the
 * wrapper into the containing block for absolutely-positioned children, they
 * resolve against the same box as before — no jumps (cards like Triton
 * position all content absolutely; a flex-sized wrapper collapses to 0
 * height there and content leaps on hover). Inner layout (flex, gap,
 * padding) mirrors the card via `inherit`, which tracks media-query changes
 * live — computed-style copies would freeze one breakpoint's values.
 *
 * Pointer-only (Motion's hover() ignores emulated touch), and fully disabled
 * under prefers-reduced-motion.
 */
(function () {
  "use strict";

  var M = window.Motion;
  if (!M || typeof M.hover !== "function" || typeof M.animate !== "function") {
    console.warn("[hover-animation] Motion (window.Motion) unavailable — card hover effects skipped.");
    return;
  }

  // Respect users who asked their OS to reduce motion.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var SCALE = 1.04;
  var SPRING = { type: "spring", stiffness: 350, damping: 28 };

  // Glassy sweep — slow and smooth. easeInOutSine is the gentlest symmetric
  // curve, so the band glides in and back out with no snap at either end.
  // Each card then gets a small deterministic offset in speed, brightness,
  // and band width (computed per card below) so the masonry never shines in
  // lockstep — same card keeps the same character across reloads.
  var SWEEP_EASE = [0.37, 0, 0.63, 1]; // easeInOutSine
  var SWEEP_DUR = 1.6;                  // s, base (was 0.85 — sharper, faster)
  var BAND_WIDTH = 60;                  // %, base band width
  var SHINE_PEAK = 0.42;               // base peak white opacity

  // Deterministic pseudo-random in [0,1) from an integer seed — the classic
  // fract(sin) hash. Stable per index, so each card keeps its personality.
  function hash01(n) {
    var x = Math.sin((n + 1) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // Collect card roots from the masonry columns. Skip nested Column stacks
  // (layout, not cards); unwrap component containers to the card they hold.
  var roots = [];
  document.querySelectorAll('[data-framer-name^="Column"]').forEach(function (col) {
    Array.prototype.forEach.call(col.children, function (child) {
      var root = /-container(\s|$)/.test(child.className) ? child.firstElementChild : child;
      if (!root || roots.indexOf(root) !== -1) return;
      if (((root.getAttribute("data-framer-name") || "").indexOf("Column") === 0)) return;
      roots.push(root);
    });
  });

  // Per-card state: the zoom wrapper + the shine band.
  var cards = new WeakMap();
  var inFlowCards = [];

  // Self-check: cards sized intrinsically (fixed px or Framer's aspect-ratio
  // trick, where height:100% resolves against auto height and collapses —
  // e.g. Triton) leave the in-flow wrapper mis-sized. Those cards don't
  // depend on child flow for their height, so the absolute variant (box ≡
  // padding box at all times) is safe and exact for them. Hidden cards
  // measure 0×0 and pass trivially — they're re-checked on resize once
  // their breakpoint shows them (one-way conversion).
  function toAbsolute(wrap) {
    wrap.style.position = "absolute";
    wrap.style.inset = "0";
    wrap.style.width = "auto";
    wrap.style.height = "auto";
    wrap.style.aspectRatio = "auto";
    wrap.style.boxSizing = "border-box";
    wrap.style.padding = "inherit";
  }

  function fitWrapper(el, wrap) {
    var cs = getComputedStyle(el);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

    // Padded card with absolutely-positioned children: their insets must
    // keep resolving against the card's padding box, which the in-flow
    // wrapper (content box) shifts — e.g. Meta's chip drops by padding-top.
    // Every such card here is all-absolute (intrinsic height), so the
    // absolute wrapper is exact. A padded card mixing flow and absolute
    // children would have no fully-correct wrapper — warn if one appears.
    if (padX + padY > 0) {
      var absKids = 0, flowKids = 0;
      Array.prototype.forEach.call(wrap.children, function (c) {
        if (getComputedStyle(c).position === "absolute") absKids++; else flowKids++;
      });
      if (absKids > 0) {
        if (flowKids === 0) return toAbsolute(wrap);
        console.warn("[hover-animation] padded card mixes flow and absolute children — hover geometry may drift:", el);
      }
    }

    if (!el.offsetWidth && !el.offsetHeight) {
      if (inFlowCards.indexOf(el) === -1) inFlowCards.push(el);
      return;
    }
    var cardBox = el.getBoundingClientRect();
    var wrapBox = wrap.getBoundingClientRect();
    if (Math.abs(cardBox.height - padY - wrapBox.height) > 1 || Math.abs(cardBox.width - padX - wrapBox.width) > 1) {
      toAbsolute(wrap);
    } else {
      if (inFlowCards.indexOf(el) === -1) inFlowCards.push(el);
    }
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var pending = inFlowCards;
      inFlowCards = [];
      pending.forEach(function (el) {
        var card = cards.get(el);
        if (card) fitWrapper(el, card.wrap); // re-adds to inFlowCards unless converted
      });
    }, 150);
  });

  roots.forEach(function (el, i) {
    if (getComputedStyle(el).position === "static") el.style.position = "relative";

    // In-flow wrapper first: content-sized cards (Stats, Hack, text cards)
    // derive their height from flow children, so the wrapper must stay in
    // flow there. position:relative makes it the containing block for
    // absolutely-positioned children at rest AND while transformed — the
    // reference box never flips on hover.
    var wrap = document.createElement("div");
    wrap.style.cssText =
      "position:relative;width:100%;height:100%;aspect-ratio:inherit;" +
      "transform-origin:center center;" +
      "display:inherit;flex-direction:inherit;flex-wrap:inherit;justify-content:inherit;" +
      "align-items:inherit;align-content:inherit;gap:inherit;";
    // ASCII overlays live outside the cards, so only real content is zoomed.
    while (el.firstChild) wrap.appendChild(el.firstChild);
    el.appendChild(wrap);

    // Self-check: cards sized intrinsically (fixed px or Framer's
    // aspect-ratio trick, where height:100% resolves against auto and
    // collapses — e.g. Triton) leave the in-flow wrapper mis-sized. Those
    // cards don't depend on child flow for their height, so the absolute
    // variant (box ≡ padding box at all times) is safe and exact for them.
    fitWrapper(el, wrap);

    // The untransformed card is the one reliable rounded clip for the
    // zoomed content (some cards default to overflow: visible).
    el.style.overflow = "hidden";

    // Shine overlay sits outside the wrapper so the glint itself doesn't
    // zoom; its rounded clip tracks the card via border-radius: inherit.
    var shine = document.createElement("div");
    shine.setAttribute("aria-hidden", "true");
    shine.style.cssText =
      "position:absolute;inset:0;border-radius:inherit;overflow:hidden;" +
      "pointer-events:none;z-index:30;";

    // Diagonal gradient gives the slant, so the band only ever translates
    // on x. Faint dark flanks keep the sweep readable on white cards, where
    // a pure-white sheen would be invisible.
    // Per-card variation: small, decorrelated offsets in speed, brightness,
    // and band width so each card's glint feels a little different. Travel
    // (the x range in the hover handler) stays constant — duration alone sets
    // the pace, the width sets the spread, the gradient sets the brightness.
    var dur = SWEEP_DUR + (hash01(i) - 0.5) * 1.4;          // ~0.90–2.30 s
    var w = BAND_WIDTH + (hash01(i + 101) - 0.5) * 40;      // ~40–80 %
    var peak = SHINE_PEAK + (hash01(i + 211) - 0.5) * 0.36; // ~0.24–0.60
    var mid = peak * 0.43;                                   // inner glow, kept proportional to peak

    var band = document.createElement("div");
    band.style.cssText =
      "position:absolute;top:0;bottom:0;left:0;width:" + w.toFixed(1) + "%;" +
      "transform:translateX(-170%);will-change:transform;" +
      "background:linear-gradient(105deg," +
      "rgba(0,0,0,0) 0%," +
      "rgba(0,0,0,0.05) 22%," +
      "rgba(255,255,255," + mid.toFixed(3) + ") 38%," +
      "rgba(255,255,255," + peak.toFixed(3) + ") 50%," +
      "rgba(255,255,255," + mid.toFixed(3) + ") 62%," +
      "rgba(0,0,0,0.05) 78%," +
      "rgba(0,0,0,0) 100%);";

    shine.appendChild(band);
    el.appendChild(shine);
    cards.set(el, { wrap: wrap, band: band, dur: dur });
  });

  M.hover(roots, function (el) {
    var card = cards.get(el);
    if (!card) return;

    M.animate(card.wrap, { scale: SCALE }, SPRING);
    // One glassy sweep per hover-enter; the band parks off-card on the right.
    M.animate(card.band, { x: ["-170%", "280%"] }, { duration: card.dur, ease: SWEEP_EASE });

    // Returned callback fires on pointer-leave.
    return function () {
      M.animate(card.wrap, { scale: 1 }, SPRING);
    };
  });
})();
