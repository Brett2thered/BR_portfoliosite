/* ============================================================
   Brett Red — theme runtime
   Light-touch additions to the Framer-generated page.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Card registry ----------
  // Each card on the homepage has a sequential id (#1..#27) and a
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
    { id: 11, name: 'Stat: $22.8m',       framerName: 'Stats Card' },
    { id: 12, name: 'Ref: Nir Eyal',      chip: 'Reference', body: 'Nir Eyal' },
    { id: 13, name: 'Ref: Generic',       framerName: 'Reference Card' },
    { id: 14, name: 'Levels',             framerName: 'Levels' },
    { id: 15, name: 'Triton Sub',         framerName: 'Triton Player' },
    { id: 16, name: 'Resident Designer',  framerName: 'Resident Designer Video' },
    { id: 17, name: 'patchworks',         framerName: 'patchworks' },
    { id: 18, name: '1PRM',               framerName: 'New Project' },
    { id: 19, name: 'Doc.ai',             framerName: 'Doc.ai' },
    { id: 20, name: 'Cloud People',       framerName: 'Cloud People' },
    { id: 21, name: 'Education',          framerName: 'Education Card' },
    { id: 22, name: 'TedX',               framerName: 'TedX' },
    { id: 23, name: 'Stat: 4.9★',         framerName: 'Stats w/ Dark Stars' },
    { id: 24, name: 'Ref: Ted Goldstein', chip: 'Reference', body: 'Goldstien' },
    { id: 25, name: 'Anthem',             framerName: 'Anthem' },
    { id: 26, name: 'Wonder Workshop',    framerName: 'Wonder' },
    { id: 27, name: 'Medicare',           framerName: 'Medicare' }
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

  // ---------- Restore every project at every layout ----------
  // Framer's tablet export hides both Column 3 and selected cards with
  // `hidden-7pcg6j`; its ultra-wide export also hides most cards with
  // `hidden-b5hu3r`. The portfolio should keep a complete project list at
  // every breakpoint, so layout code below changes columns—not content.
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
        child.classList.remove('hidden-7pcg6j');
        child.classList.remove('hidden-yjk9vg');
        root.classList.remove('hidden-b5hu3r');
        root.classList.remove('hidden-7pcg6j');
        root.classList.remove('hidden-yjk9vg');
      });
    });
  }

  // ---------- Responsive project columns ----------
  // One editorial sequence for every layout. Never use loaded media, font
  // metrics or card heights to choose a column: these can arrive in any order.
  // Existing outer card nodes are moved, preserving their links and listeners.
  var TWO_COL_MIN = 834;
  var THREE_COL_MIN = 1024;
  var FOUR_COL_MIN = 2560;
  var FIVE_COL_MIN = 3200;
  var CARD_ORDER = [
    1, 3, 27, 18, 20, 2, 19,
    9, 14, 25, 4, 5, 7, 12, 15, 6, 17, 13, 16, 26, 24, 21, 10, 22,
    8, 11, 23
  ];
  var layoutCount = 0;
  var syncColumns = null;

  function colByName(name) {
    return document.querySelector('[data-framer-name="' + name + '"]');
  }
  function isLayoutCard(node) {
    if (node.nodeType !== 1 || node.style.display === 'none') return false;
    var fn = node.getAttribute('data-framer-name') || '';
    return fn.indexOf('Column') !== 0;
  }

  function setupResponsiveColumns() {
    if (syncColumns) { syncColumns(); return; }
    var cols = ['Column 1', 'Column 2', 'Column 3'].map(colByName).filter(Boolean);
    if (cols.length < 3) return;
    var container = cols[0].parentNode;
    var records = [];
    cols.forEach(function (col) {
      Array.prototype.forEach.call(col.children, function (node) {
        if (isLayoutCard(node)) records.push({ node: node, sourceIndex: records.length });
      });
    });
    records.sort(function (a, b) {
      var aRank = CARD_ORDER.indexOf(Number(a.node.getAttribute('data-br-id')));
      var bRank = CARD_ORDER.indexOf(Number(b.node.getAttribute('data-br-id')));
      return (aRank < 0 ? CARD_ORDER.length + a.sourceIndex : aRank) -
        (bRank < 0 ? CARD_ORDER.length + b.sourceIndex : bRank);
    });
    // Only the empty column shells are new. Cards and media are never cloned.
    for (var number = 4; number <= 5; number++) {
      var column = document.createElement('div');
      column.className = cols[0].className;
      column.setAttribute('data-framer-name', 'Column ' + number);
      container.appendChild(column);
      cols.push(column);
    }
    var queries = [TWO_COL_MIN, THREE_COL_MIN, FOUR_COL_MIN, FIVE_COL_MIN].map(function (min) {
      return window.matchMedia('(min-width: ' + min + 'px)');
    });
    syncColumns = function () {
      var count = 1;
      queries.forEach(function (query, index) { if (query.matches) count = index + 2; });
      if (count === layoutCount) return;
      layoutCount = count;
      container.setAttribute('data-br-column-count', String(count));
      if (count === 1) container.setAttribute('data-br-mobile-stack', '');
      else container.removeAttribute('data-br-mobile-stack');
      cols.forEach(function (col, index) {
        if (index >= count) col.setAttribute('data-br-inactive-column', '');
        else col.removeAttribute('data-br-inactive-column');
      });
      records.forEach(function (record, index) {
        var card = record.node;
        card.setAttribute('data-br-feed-order', String(index));
        if (count === 1) card.setAttribute('data-br-mobile-order', String(index));
        else card.removeAttribute('data-br-mobile-order');
        // Reserve the upper-left pair. The rest start in Column 2 and wrap
        // through every active column, preserving the remaining sequence.
        var target = count === 1 || index < 2 ? 0 : (index - 1) % count;
        cols[target].appendChild(card);
      });
      window.dispatchEvent(new CustomEvent('br:layout', { detail: { columns: count } }));
    };
    syncColumns();
    queries.forEach(function (query) {
      if (query.addEventListener) query.addEventListener('change', syncColumns);
      else if (query.addListener) query.addListener(syncColumns);
    });
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
    setupVimeoPoster('Brett Player', 'assets/brett-video-poster.jpg', { forceMuted: false });
    setupVimeoPoster('Triton Player', 'assets/triton-poster.jpg', { forceMuted: false });
    setupResumeDownload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__brTheme = {
    cards: CARDS,
    cardOrder: CARD_ORDER.slice(),
    getColumnCount: function () { return layoutCount; },
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
