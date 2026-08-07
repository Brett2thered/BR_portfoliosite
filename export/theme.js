/* ============================================================
   Brett Red — theme runtime
   Light-touch additions to the Framer-generated page.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Card registry ----------
  // Each card on the homepage has a sequential id (#1..#26) and a
  // human-friendly name. Use these names when discussing the page.
  // Matching priority: framerName, then chip+body text.
  var CARDS = [
    { id: 1,  name: 'Intro',              chip: 'Hello',     body: 'hands on product design' },
    { id: 2,  name: 'Anchor Maps',        framerName: 'Anchor Player' },
    { id: 3,  name: 'Brett Video',        framerName: 'Brett Player' },
    { id: 4,  name: 'Ref: Abdullah',      chip: 'Reference', body: 'Abdullah' },
    { id: 5,  name: 'Arya',               framerName: 'Arya Works' },
    { id: 6,  name: 'Intel',              framerName: 'Intel' },
    { id: 7,  name: 'Navdy',              framerName: 'Navdy' },
    { id: 8,  name: 'Stat: Ranked',       framerName: 'Ranked Designer' },
    { id: 9,  name: 'Meta',               framerName: 'Meta' },
    { id: 10, name: 'Hack',               framerName: 'Hack' },
    { id: 11, name: 'Stat: $22.8m',       chip: 'Stats',     body: '22.8' },
    { id: 12, name: 'Ref: Nir Eyal',      chip: 'Reference', body: 'Nir Eyal' },
    { id: 13, name: 'Ref: Generic',       framerName: 'Reference Card' },
    { id: 14, name: 'Levels',             framerName: 'Levels' },
    { id: 15, name: 'Triton Sub',         framerName: 'Triton Player' },
    { id: 16, name: 'Resident Designer',  framerName: 'Resident Designer Video' },
    { id: 17, name: 'Hiro',               framerName: 'Hiro' },
    { id: 19, name: 'Doc.ai',             framerName: 'Doc.ai' },
    { id: 20, name: 'Cloud People',       framerName: 'Cloud People' },
    { id: 21, name: 'Education',          framerName: 'Education Card' },
    { id: 22, name: 'TedX',               framerName: 'TedX' },
    { id: 23, name: 'Stat: 4.9★',         chip: 'Stats',     body: '4.9' },
    { id: 24, name: 'Ref: Ted Goldstein', chip: 'Reference', body: 'Goldstien' },
    { id: 25, name: 'Anthem',             framerName: 'Anthem' },
    { id: 26, name: 'Wonder Workshop',    framerName: 'Wonder' }
  ];

  // Cards that ship without a Text Chip — inject the site's standard chip.
  // variant: 'white' (dark/photo cards) or 'gray' (light/white cards),
  // matching the two Text Chip color schemes used across the export.
  var CHIP_OVERRIDES = [
    { match: 'Anchor Player', text: 'Maps', variant: 'gray' }
  ];

  // ---------- Helpers ----------
  function chipTextOf(card) {
    var c = card.querySelector('[data-framer-name="Text Chip"]');
    return c ? (c.textContent || '').trim() : '';
  }
  function cardBody(card) { return (card.textContent || '').trim(); }

  function matchCard(card) {
    var fn = card.getAttribute('data-framer-name') || '';
    for (var i = 0; i < CARDS.length; i++) {
      var spec = CARDS[i];
      if (spec.framerName && spec.framerName === fn) return spec;
    }
    // No framerName match — try chip + body
    var ct = chipTextOf(card);
    var body = cardBody(card);
    for (var j = 0; j < CARDS.length; j++) {
      var s = CARDS[j];
      if (s.framerName) continue;
      if (s.chip && s.chip !== ct) continue;
      if (s.body && body.indexOf(s.body) === -1) continue;
      return s;
    }
    return null;
  }

  // ---------- Inject missing chips ----------
  // Builds the same Text Chip component the Framer export uses everywhere
  // else (cloned markup, incl. the positioning container class), so injected
  // chips are pixel-identical to native ones.
  function buildChip(text, variant) {
    var color = variant === 'gray' ? 'rgb(145, 145, 145)' : 'rgb(255, 255, 255)';
    var container = document.createElement('div');
    container.className = 'framer-1oot72p-container';
    // Some cards stack their media at z-index 1 (e.g. Anchor Player's video),
    // which would bury a z-auto chip; stay below the shine overlay (30).
    container.style.zIndex = '10';
    container.innerHTML =
      '<div class="framer-LqJ91 framer-irEC4 framer-5ecovm framer-v-5ecovm" data-border="true" data-framer-name="Text Chip" style="--border-bottom-width: 1px; --border-color: ' + color + '; --border-left-width: 1px; --border-right-width: 1px; --border-style: solid; --border-top-width: 1px; border-radius: 30px; opacity: 1;">' +
        '<div class="framer-1cfs03k" data-framer-name="Content" data-framer-component-type="RichTextContainer" style="--extracted-r6o4lv: var(--variable-reference-mu5RRRhhz-YxvJNWf8B); --framer-link-text-color: rgb(0, 153, 255); --framer-link-text-decoration: underline; --variable-reference-mu5RRRhhz-YxvJNWf8B: ' + color + '; transform: none; opacity: 1;">' +
          '<p class="framer-text framer-styles-preset-vat19p" data-styles-preset="sRNyPB9IY" style="--framer-text-alignment: center; --framer-text-color: var(--extracted-r6o4lv, var(--variable-reference-mu5RRRhhz-YxvJNWf8B));"></p>' +
        '</div>' +
      '</div>';
    container.querySelector('p').textContent = text;
    return container;
  }

  function injectMissingChips() {
    CHIP_OVERRIDES.forEach(function (spec) {
      var nodes = document.querySelectorAll('[data-framer-name="' + spec.match + '"]');
      if (!nodes.length) nodes = document.querySelectorAll(spec.match);
      nodes.forEach(function (card) {
        if (card.querySelector('[data-framer-name="Text Chip"]')) return;
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(buildChip(spec.text, spec.variant));
      });
    });
  }

  // ---------- Tag every card with data-br-id and data-br-name ----------
  function tagCards() {
    var columns = Array.from(document.querySelectorAll('[data-framer-name^="Column"]'));
    var tagged = 0, untagged = [];
    columns.forEach(function (col) {
      Array.from(col.children).forEach(function (card) {
        var fn = card.getAttribute('data-framer-name') || '';
        if (/^Column/i.test(fn)) return;
        var spec = matchCard(card);
        if (spec) {
          card.setAttribute('data-br-id', String(spec.id));
          card.setAttribute('data-br-name', spec.name);
          tagged++;
        } else {
          untagged.push({ framerName: fn || '(none)', cls: (card.className || '').slice(0, 60) });
        }
      });
    });
    return { tagged: tagged, untagged: untagged };
  }

  // ---------- Fix cards dropped at certain breakpoints ----------
  // Framer's responsive design is left intact: 1 column on phones, 2 on
  // tablet, 3 on desktop. The bug was the ultra-wide (>=2633px) layout, which
  // hid 21 of the 25 cards via the `hidden-b5hu3r` class — that class only
  // sets display:none at >=2633px, so stripping it from the cards makes
  // ultra-wide match the 3-column desktop layout while leaving the phone and
  // tablet curation (driven by other classes) untouched. We also hide the one
  // duplicate card variant (Levels ships a second copy that renders twice in
  // the 1728-2632px range).
  function fixDroppedCards() {
    var cols = document.querySelectorAll('[data-framer-name="Column 1"], [data-framer-name="Column 2"], [data-framer-name="Column 3"]');
    var seen = {};
    Array.prototype.forEach.call(cols, function (col) {
      Array.prototype.forEach.call(col.children, function (child) {
        var root = /-container(\s|$)/.test(child.className) ? (child.firstElementChild || child) : child;
        var fn = root.getAttribute('data-framer-name') || '';
        if (fn.indexOf('Column') === 0) return;
        var id = root.getAttribute('data-br-id');
        if (id && seen[id]) { child.style.display = 'none'; return; } // duplicate variant -> hide everywhere
        if (id) seen[id] = true;
        child.classList.remove('hidden-b5hu3r');
        root.classList.remove('hidden-b5hu3r');
      });
    });
  }

  // ---------- Large-display 4th column (>=2560px) ----------
  // The masonry ships as three equal flex columns (each flex:1 0 0, so N
  // visible columns split the row into N equal tracks). Framer hides columns
  // 2/3 on phones/tablets; from 1680px up all three show, which on a 27" QHD /
  // Studio Display / ultrawide / 4K panel stretches every card past 800px and
  // reads sparse. At >=2560px (the common "large display" floor) we add a
  // fourth equal column and rebalance every visible card across the four by
  // height (shortest column first), then restore the exact original
  // three-column layout below the threshold. Card nodes are MOVED, never
  // cloned, so the hover wrapper, shine overlay, Motion hover listeners and
  // data-br tags added by the other runtime scripts travel with each card.
  var FOUR_COL_MIN = 2560;
  var col4 = null;
  var origOrder = null; // [{node, parent}] in authored order, for exact 3-col restore

  function colByName(name) {
    return document.querySelector('[data-framer-name="' + name + '"]');
  }
  function baseColumns() {
    return ['Column 1', 'Column 2', 'Column 3'].map(colByName).filter(Boolean);
  }
  function isCardVisible(node) {
    if (node.nodeType !== 1) return false;
    var fn = node.getAttribute('data-framer-name') || '';
    if (fn.indexOf('Column') === 0) return false;       // nested column stack, not a card
    return !!(node.offsetWidth || node.offsetHeight);    // excludes display:none duplicates/curation
  }

  function recordOriginal() {
    if (origOrder) return;
    origOrder = [];
    baseColumns().forEach(function (col) {
      Array.prototype.forEach.call(col.children, function (node) {
        origOrder.push({ node: node, parent: col });
      });
    });
  }

  function restoreThree() {
    if (!origOrder) return;
    // Re-append every original child to its original column in authored order;
    // appendChild moves the node, so iterating in document order rebuilds the
    // exact three-column DOM (including the hidden duplicate variant).
    origOrder.forEach(function (rec) { rec.parent.appendChild(rec.node); });
    if (col4 && col4.parentNode) col4.parentNode.removeChild(col4);
    col4 = null;
  }

  function applyFour() {
    var cols = baseColumns();
    if (cols.length < 3) return;
    var container = cols[0].parentNode;
    if (!container) return;

    // Fourth column clones Column 1's class, so flex:1 0 0 / justify / gap are
    // pixel-identical and the row immediately divides into four equal tracks.
    col4 = document.createElement('div');
    col4.className = cols[0].className;
    col4.setAttribute('data-framer-name', 'Column 4');
    container.appendChild(col4);
    cols.push(col4);

    // Gather visible cards in authored order, then measure each at its final
    // (4-col) width in one pass — every track is the same width, so a card's
    // height is independent of which column it lands in.
    var cards = [];
    cols.forEach(function (col) {
      Array.prototype.forEach.call(col.children, function (node) {
        if (isCardVisible(node)) cards.push(node);
      });
    });
    var measures = cards.map(function (n) { return n.offsetHeight || 0; });

    // Greedy masonry: drop each card into the currently shortest column.
    var heights = [0, 0, 0, 0];
    cards.forEach(function (node, idx) {
      var i = heights.indexOf(Math.min.apply(Math, heights));
      cols[i].appendChild(node);           // appendChild MOVES the node
      heights[i] += measures[idx];
    });
  }

  function setupResponsiveColumns() {
    if (baseColumns().length < 3) return;  // page has no masonry — no-op
    recordOriginal();
    var mq = window.matchMedia('(min-width: ' + FOUR_COL_MIN + 'px)');
    function sync() {
      restoreThree();                      // canonical 3-col base (idempotent)
      if (mq.matches) applyFour();
    }
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync); // Safari < 14
  }

  // ---------- Vimeo poster fallback ----------
  // Cards that embed a Vimeo iframe render empty white until Vimeo autoplays,
  // and autoplay is blocked in many contexts (embedded WebViews, Safari's
  // low-power mode, unfocused tabs on load, or any iframe URL that isn't
  // muted). Overlay the saved video poster on top of the iframe with
  // pointer-events:none, then fade it out when Vimeo posts its first `play`
  // event. If autoplay never fires the overlay just stays visible — still the
  // correct visual for the card. Also normalises the iframe URL — `muted=1`
  // and `loop=1` — so autoplay is actually allowed to succeed where the
  // browser policy is muted-only.
  function setupVimeoPoster(cardName, posterAsset, opts) {
    var card = document.querySelector('[data-framer-name="' + cardName + '"]');
    if (!card) return;
    var marker = 'data-br-vimeo-poster';
    if (card.querySelector('[' + marker + ']')) return;
    var iframe = card.querySelector('iframe');
    if (!iframe) {
      // Framer lazy-injects the Vimeo iframe after first paint. Retry once
      // it appears, then bail.
      var obs = new MutationObserver(function () {
        if (card.querySelector('iframe')) { obs.disconnect(); setupVimeoPoster(cardName, posterAsset, opts); }
      });
      obs.observe(card, { childList: true, subtree: true });
      return;
    }

    // Normalise the URL so muted=1 and loop=1 are both set — the Framer-
    // exported URL sometimes ships with muted=0, which browsers refuse to
    // autoplay silently.
    if (opts && opts.forceMuted) {
      try {
        var u = new URL(iframe.src);
        u.searchParams.set('muted', '1');
        u.searchParams.set('autoplay', '1');
        u.searchParams.set('loop', '1');
        if (iframe.src !== u.toString()) iframe.src = u.toString();
      } catch (err) { /* older browsers without URL — skip */ }
    }

    var poster = document.createElement('div');
    poster.setAttribute(marker, cardName);
    poster.style.cssText = [
      'position:absolute',
      'inset:0',
      'background:#fff url(' + posterAsset + ') center/cover no-repeat',
      'pointer-events:none',
      'opacity:1',
      'transition:opacity 400ms ease',
      'z-index:1'
    ].join(';');

    // The iframe is inside a positioned wrapper; place the poster as a sibling
    // so it shares the same clipping rect and z-context. hover-animation.js
    // moves the whole subtree into its own hover-zoom wrap div later, so the
    // poster inherits that transform and stays aligned with the iframe.
    var wrap = iframe.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    wrap.appendChild(poster);

    // Fade poster once we've confirmed *sustained* playback. Vimeo's `play`,
    // `playing`, and `timeupdate` events all fire optimistically — even when
    // the browser blocks autoplay and Vimeo pauses moments later — so we
    // combine two independent signals from Vimeo's JS API and require them
    // to agree across four consecutive polls (~4s): the player reports
    // `getPaused` false, and `getCurrentTime` is strictly advancing between
    // polls. Autoplay-blocked contexts pause the video within a second or
    // two, so a full 4s streak is strong ground truth. Any hiccup resets
    // the streak.
    var faded = false;
    var streak = 0;
    var lastPaused = null;
    var lastTime = -1;
    var poll = null;
    function fade() {
      if (faded) return;
      faded = true;
      if (poll) { clearInterval(poll); poll = null; }
      poster.style.opacity = '0';
      setTimeout(function () { if (poster.parentNode) poster.parentNode.removeChild(poster); }, 500);
      window.removeEventListener('message', onMsg);
    }
    function bump(paused, time) {
      var advancing = time > lastTime + 0.05;
      if (paused === false && advancing) {
        streak++;
        if (streak >= 4) fade();
      } else {
        streak = 0;
      }
      lastTime = time;
      lastPaused = paused;
    }
    function onMsg(e) {
      if (!/vimeo\.com/.test(e.origin)) return;
      if (e.source !== iframe.contentWindow) return;
      var data = e.data;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch (err) { return; }
      if (!data) return;
      if (data.method === 'getPaused') lastPaused = data.value;
      else if (data.method === 'getCurrentTime' && typeof data.value === 'number') {
        // Pair the freshest `getPaused` with this time reading.
        bump(lastPaused, data.value);
      }
    }
    window.addEventListener('message', onMsg);

    // Subscribe: set loop:true as insurance (Vimeo's URL `loop` param is
    // ignored for some clip types — the JS API is the reliable path), then
    // poll getPaused + getCurrentTime every second. Ordering matters — ask
    // for paused first so `lastPaused` is fresh when the time reply arrives.
    function subscribe() {
      try {
        iframe.contentWindow.postMessage({ method: 'setLoop', value: true }, '*');
      } catch (err) { /* cross-origin — silently ignore */ }
      if (poll) return;
      poll = setInterval(function () {
        if (faded) return;
        try {
          iframe.contentWindow.postMessage({ method: 'getPaused' }, '*');
          iframe.contentWindow.postMessage({ method: 'getCurrentTime' }, '*');
        } catch (err) { /* cross-origin — silently ignore */ }
      }, 1000);
    }
    if (iframe.contentWindow) subscribe();
    iframe.addEventListener('load', subscribe);
  }

  function setupAnchorPoster() {
    setupVimeoPoster('Anchor Player', 'assets/anchor-globe.webp', { forceMuted: false });
  }
  function setupCloudPeoplePoster() {
    setupVimeoPoster('Cloud People', 'assets/cloud-people.webp', { forceMuted: true });
  }

  // ---------- Public API ----------
  function listCards() {
    return CARDS.map(function (c) {
      var nodes = document.querySelectorAll('[data-br-id="' + c.id + '"]');
      return { id: c.id, name: c.name, domCount: nodes.length };
    });
  }

  // Make the THANK YOU footer a resume-download surface. Clicks anywhere on
  // the section that reach us trigger a download of assets/BR_Resume2026.pdf.
  // The edit-mode.js "sign in to edit" easter egg lives in the empty strip
  // below the "FOR YOUR TIME" heading (capture-phase, stopImmediatePropagation);
  // our handler runs for every OTHER click in the section.
  function setupResumeDownload() {
    var section = document.querySelector('[data-framer-name="v2/Footer"]');
    if (!section || section.hasAttribute('data-br-resume-wired')) return;
    section.setAttribute('data-br-resume-wired', '');
    section.style.cursor = 'pointer';
    section.setAttribute('aria-label', 'Download Brett Red resume (PDF)');

    function trigger() {
      var a = document.createElement('a');
      a.href = 'assets/BR_Resume2026.pdf';
      a.download = 'BR_Resume2026.pdf';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    section.addEventListener('click', trigger);
  }

  function init() {
    injectMissingChips();
    tagCards();
    fixDroppedCards();
    setupResponsiveColumns();
    setupAnchorPoster();
    setupCloudPeoplePoster();
    setupResumeDownload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__brTheme = {
    cards: CARDS,
    injectMissingChips: injectMissingChips,
    tagCards: tagCards,
    fixDroppedCards: fixDroppedCards,
    setupResponsiveColumns: setupResponsiveColumns,
    setupAnchorPoster: setupAnchorPoster,
    setupCloudPeoplePoster: setupCloudPeoplePoster,
    setupVimeoPoster: setupVimeoPoster,
    setupResumeDownload: setupResumeDownload,
    list: listCards
  };
})();
