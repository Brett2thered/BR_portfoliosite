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
    { id: 17, name: 'Hiro Badge',         framerName: 'Hiro' },
    { id: 18, name: 'Hiro',               framerName: 'Rectangle 27' },
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
    list: listCards
  };
})();
