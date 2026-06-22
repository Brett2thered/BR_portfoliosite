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

  // ---------- Public API ----------
  function listCards() {
    return CARDS.map(function (c) {
      var nodes = document.querySelectorAll('[data-br-id="' + c.id + '"]');
      return { id: c.id, name: c.name, domCount: nodes.length };
    });
  }

  function init() {
    injectMissingChips();
    tagCards();
    fixDroppedCards();
    setupResponsiveColumns();
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
    list: listCards
  };
})();
