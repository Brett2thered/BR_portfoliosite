/* ============================================================
   Brett Red — Secret Edit Mode
   Vanilla JS, no deps. Loaded only on index.html.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Constants ----------
  var STORAGE_KEY = 'br_card_order_v1';
  var SESSION_KEY = 'br_edit';
  var CREDS = { user: 'Daddy', pass: 'Baby' };

  // Match Framer's 5 breakpoints (see edit-mode plan)
  var BREAKPOINTS = [
    { key: 'xxl', mq: '(min-width: 2633px)' },
    { key: 'xl',  mq: '(min-width: 1728px) and (max-width: 2632.98px)' },
    { key: 'lg',  mq: '(min-width: 1680px) and (max-width: 1727.98px)' },
    { key: 'md',  mq: '(min-width: 834px)  and (max-width: 1679.98px)' },
    { key: 'sm',  mq: '(max-width: 833.98px)' }
  ];

  // Minimum card-like dimensions (px) — anything smaller is treated as a fragment
  var MIN_CARD_W = 200;
  var MIN_CARD_H = 100;

  // ---------- State ----------
  var state = {
    bp: null,                // current breakpoint key
    cards: [],               // [{ key, el, baselineRect }]
    storedOrder: loadOrder(),// per-bp order arrays
    history: [],             // stack of previous order arrays for undo
    drag: null               // active drag context
  };

  // ---------- Helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function loadOrder() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveOrder() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedOrder)); } catch (e) {}
  }

  function detectBreakpoint() {
    for (var i = 0; i < BREAKPOINTS.length; i++) {
      if (window.matchMedia(BREAKPOINTS[i].mq).matches) return BREAKPOINTS[i].key;
    }
    return 'md';
  }

  function isVisible(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function slug(s) {
    return String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function stableKey(el) {
    var name = el.getAttribute('data-framer-name');
    if (name) return slug(name);
    var href = el.getAttribute('href');
    if (!href) {
      var inner = el.querySelector && el.querySelector('a[href]');
      if (inner) href = inner.getAttribute('href');
    }
    if (href) {
      var m = href.match(/([a-z0-9-]+)(?:\.html)?$/i);
      if (m) return 'href-' + slug(m[1]);
    }
    // Stable fallback: source-order index assigned later
    return null;
  }

  // Find all visible cards at the current breakpoint by walking
  // every visible Column N container and treating each card-shaped
  // direct child as a card.
  function collectVisibleCards() {
    var cards = [];
    var seenKeys = {};
    var fallbackIdx = 0;
    var columns = $$('[data-framer-name^="Column"]');
    columns.forEach(function (col) {
      if (!isVisible(col)) return;
      Array.prototype.slice.call(col.children).forEach(function (el) {
        if (!isVisible(el)) return;
        // Skip nested Column / wrapper containers
        var name = el.getAttribute('data-framer-name') || '';
        if (/^Column/i.test(name)) return;
        var r = el.getBoundingClientRect();
        if (r.width < MIN_CARD_W || r.height < MIN_CARD_H) return;
        var key = stableKey(el) || ('card-' + (fallbackIdx++));
        if (seenKeys[key]) return;
        seenKeys[key] = true;
        el.classList.add('br-card');
        el.setAttribute('data-br-card', key);
        // Framer attaches scroll-driven CSS animations that pin transform
        // to keyframe values, overriding our inline transform. Cancel them.
        if (el.getAnimations) {
          el.getAnimations().forEach(function (a) {
            try { a.cancel(); } catch (e) {}
          });
        }
        cards.push({ key: key, el: el });
      });
    });
    // Sort cards by visual position (top, then left) so the order array
    // is meaningful and stable across reloads.
    cards.sort(function (a, b) {
      var ra = a.el.getBoundingClientRect();
      var rb = b.el.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 4) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    return cards;
  }

  function snapshotBaselines() {
    // Clear any existing transforms first so we measure true Framer positions
    state.cards.forEach(function (c) { c.el.style.transform = ''; });
    // Force layout
    void document.body.offsetHeight;
    state.cards.forEach(function (c) {
      var r = c.el.getBoundingClientRect();
      c.baselineRect = { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
    });
  }

  function applyOrder(animate) {
    var bp = state.bp;
    var order = state.storedOrder[bp];
    if (!order) {
      // No stored order = identity (cards in their Framer-native slots)
      state.cards.forEach(function (c) { c.el.style.transform = ''; });
      return;
    }
    // Map: cardKey -> baselineRect of the slot it should occupy
    // Slot N is the baseline of the card that was originally at index N.
    var baselineByIndex = state.cards.map(function (c) { return c.baselineRect; });
    var defaultOrder = state.cards.map(function (c) { return c.key; });

    order.forEach(function (key, slotIdx) {
      var card = state.cards.find(function (c) { return c.key === key; });
      if (!card) return;
      var targetRect = baselineByIndex[slotIdx];
      if (!targetRect) return;
      var dx = targetRect.left - card.baselineRect.left;
      var dy = targetRect.top - card.baselineRect.top;
      if (!animate) card.el.style.transition = 'none';
      card.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (!animate) {
        // Re-enable transitions next frame
        requestAnimationFrame(function () { card.el.style.transition = ''; });
      }
    });
    // Make sure default-order entries (any card not in stored array) reset
    defaultOrder.forEach(function (key) {
      if (order.indexOf(key) === -1) {
        var card = state.cards.find(function (c) { return c.key === key; });
        if (card) card.el.style.transform = '';
      }
    });
  }

  function currentOrder() {
    // Read effective order at current bp: stored or identity
    var bp = state.bp;
    if (state.storedOrder[bp] && state.storedOrder[bp].length) return state.storedOrder[bp].slice();
    return state.cards.map(function (c) { return c.key; });
  }

  function setOrder(newOrder) {
    state.history.push(currentOrder());
    state.storedOrder[state.bp] = newOrder.slice();
    saveOrder();
    applyOrder(true);
    updatePill();
  }

  // ---------- Modal ----------
  var modalEl = null;
  function openModal() {
    if (!modalEl) buildModal();
    modalEl.classList.add('br-open');
    setTimeout(function () {
      var u = $('#br-user', modalEl); if (u) u.focus();
    }, 60);
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('br-open');
    var err = $('.br-error', modalEl); if (err) err.textContent = '';
    var u = $('#br-user', modalEl); if (u) u.value = '';
    var p = $('#br-pass', modalEl); if (p) p.value = '';
  }
  function buildModal() {
    modalEl = document.createElement('div');
    modalEl.className = 'br-modal-backdrop';
    modalEl.innerHTML =
      '<div class="br-modal" role="dialog" aria-modal="true" aria-labelledby="br-modal-title">' +
        '<h2 id="br-modal-title">Welcome back.</h2>' +
        '<p>Sign in to edit.</p>' +
        '<div class="br-field"><label for="br-user">Username</label><input id="br-user" type="text" autocomplete="username" /></div>' +
        '<div class="br-field"><label for="br-pass">Password</label><input id="br-pass" type="password" autocomplete="current-password" /></div>' +
        '<div class="br-error" aria-live="polite"></div>' +
        '<div class="br-actions">' +
          '<button type="button" class="br-btn br-btn-ghost" data-act="cancel">Cancel</button>' +
          '<button type="button" class="br-btn br-btn-primary" data-act="login">Sign in</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) closeModal();
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'cancel') closeModal();
      if (act === 'login') tryLogin();
    });
    modalEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tryLogin(); }
      if (e.key === 'Escape') closeModal();
    });
  }
  function tryLogin() {
    var u = $('#br-user', modalEl).value.trim();
    var p = $('#br-pass', modalEl).value;
    var err = $('.br-error', modalEl);
    var panel = $('.br-modal', modalEl);
    if (u === CREDS.user && p === CREDS.pass) {
      err.textContent = '';
      sessionStorage.setItem(SESSION_KEY, '1');
      closeModal();
      enterEditMode();
    } else {
      err.textContent = 'Wrong username or password.';
      panel.classList.remove('br-shake');
      void panel.offsetWidth;
      panel.classList.add('br-shake');
    }
  }

  // ---------- Edit mode UI ----------
  var pillEl = null;
  function enterEditMode() {
    document.documentElement.classList.add('br-edit-on');
    state.cards = collectVisibleCards();
    snapshotBaselines();
    applyOrder(false);
    attachDragHandlers();
    suppressLinkNav(true);
    buildPill();
    updatePill();
  }
  function exitEditMode() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }
  function buildPill() {
    if (pillEl) return;
    pillEl = document.createElement('div');
    pillEl.className = 'br-edit-pill';
    pillEl.innerHTML =
      '<span class="br-pill-dot" aria-hidden="true"></span>' +
      '<span>Edit Mode</span>' +
      '<span class="br-bp" data-role="bp"></span>' +
      '<button type="button" data-act="undo" disabled>Undo</button>' +
      '<button type="button" data-act="reset">Reset</button>' +
      '<button type="button" data-act="logout">Logout</button>';
    document.body.appendChild(pillEl);
    pillEl.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'logout') exitEditMode();
      if (act === 'undo') undo();
      if (act === 'reset') resetCurrentBp();
    });
  }
  function updatePill() {
    if (!pillEl) return;
    var bpLabel = $('[data-role="bp"]', pillEl);
    if (bpLabel) bpLabel.textContent = state.bp;
    var undoBtn = pillEl.querySelector('[data-act="undo"]');
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
  }
  function undo() {
    if (!state.history.length) return;
    var prev = state.history.pop();
    state.storedOrder[state.bp] = prev;
    saveOrder();
    applyOrder(true);
    updatePill();
  }
  function resetCurrentBp() {
    state.history.push(currentOrder());
    delete state.storedOrder[state.bp];
    saveOrder();
    applyOrder(true);
    updatePill();
  }

  // ---------- Drag interaction (Pointer Events) ----------
  function attachDragHandlers() {
    state.cards.forEach(function (card) {
      card.el.addEventListener('pointerdown', onPointerDown);
    });
  }
  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!document.documentElement.classList.contains('br-edit-on')) return;
    var el = e.currentTarget;
    var key = el.getAttribute('data-br-card');
    var card = state.cards.find(function (c) { return c.key === key; });
    if (!card) return;
    e.preventDefault();
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    var rect = el.getBoundingClientRect();
    state.drag = {
      card: card,
      startX: e.clientX,
      startY: e.clientY,
      // Existing transform offset so we can drag relative to current position
      baseDx: rect.left - card.baselineRect.left + window.scrollX - window.scrollX,
      baseDy: rect.top - card.baselineRect.top + window.scrollY - window.scrollY,
      target: null
    };
    el.classList.add('br-dragging');
    el.style.transition = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onDragKey);
  }
  function onPointerMove(e) {
    var d = state.drag; if (!d) return;
    var dx = d.baseDx + (e.clientX - d.startX);
    var dy = d.baseDy + (e.clientY - d.startY);
    d.card.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    // Hit-test other cards using their CURRENT visible rect
    var hit = null;
    for (var i = 0; i < state.cards.length; i++) {
      var other = state.cards[i];
      if (other === d.card) continue;
      var r = other.el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        hit = other; break;
      }
    }
    if (d.target && d.target !== hit) d.target.el.classList.remove('br-drop-target');
    if (hit && hit !== d.target) hit.el.classList.add('br-drop-target');
    d.target = hit;
  }
  function onPointerUp(e) {
    var d = state.drag; if (!d) return;
    cleanupDrag();
    var card = d.card;
    if (d.target) {
      d.target.el.classList.remove('br-drop-target');
      // Swap card and target in the current order
      var order = currentOrder();
      var ai = order.indexOf(card.key);
      var bi = order.indexOf(d.target.key);
      if (ai !== -1 && bi !== -1) {
        order[ai] = d.target.key;
        order[bi] = card.key;
        // Re-enable transition for animated swap
        card.el.style.transition = '';
        d.target.el.style.transition = '';
        setOrder(order);
      } else {
        // fallback: snap back
        card.el.style.transition = '';
        applyOrder(true);
      }
    } else {
      // Snap back to current effective order
      card.el.style.transition = '';
      applyOrder(true);
    }
    card.el.classList.remove('br-dragging');
  }
  function onPointerCancel() {
    var d = state.drag; if (!d) return;
    cleanupDrag();
    if (d.target) d.target.el.classList.remove('br-drop-target');
    d.card.el.style.transition = '';
    d.card.el.classList.remove('br-dragging');
    applyOrder(true);
  }
  function onDragKey(e) {
    if (e.key === 'Escape') onPointerCancel();
  }
  function cleanupDrag() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('keydown', onDragKey);
    state.drag = null;
  }

  // ---------- Suppress link navigation while editing ----------
  function suppressLinkNav(on) {
    state.cards.forEach(function (card) {
      if (on) card.el.addEventListener('click', blockClick, true);
      else card.el.removeEventListener('click', blockClick, true);
    });
  }
  function blockClick(e) {
    if (document.documentElement.classList.contains('br-edit-on')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ---------- Trigger ----------
  function attachFooterTrigger() {
    var footer = document.querySelector('[data-framer-name="v2/Footer"]');
    if (!footer) return;
    function isOverLink(target) {
      var t = target;
      while (t && t !== footer) {
        if (t.tagName === 'A') return true;
        t = t.parentNode;
      }
      return false;
    }
    function open(e) {
      if (document.documentElement.classList.contains('br-edit-on')) return;
      if (isOverLink(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openModal();
    }
    // Capture-phase click; Framer's footer scroll-to-top has no effect
    // on this page so we don't need to suppress pointerdown.
    footer.addEventListener('click', open, true);
  }

  // ---------- Breakpoint watcher ----------
  function watchBreakpoint() {
    BREAKPOINTS.forEach(function (b) {
      try {
        var mql = window.matchMedia(b.mq);
        var handler = function () {
          var newBp = detectBreakpoint();
          if (newBp !== state.bp) {
            state.bp = newBp;
            // Re-collect cards (different ones may now be visible)
            state.cards.forEach(function (c) { c.el.style.transform = ''; c.el.classList.remove('br-card'); c.el.removeAttribute('data-br-card'); });
            state.cards = collectVisibleCards();
            snapshotBaselines();
            applyOrder(false);
            if (document.documentElement.classList.contains('br-edit-on')) {
              attachDragHandlers();
            }
            updatePill();
          }
        };
        if (mql.addEventListener) mql.addEventListener('change', handler);
        else mql.addListener(handler);
      } catch (e) {}
    });
  }

  // ---------- Init ----------
  function init() {
    state.bp = detectBreakpoint();
    attachFooterTrigger();
    watchBreakpoint();
    // Auto-resume edit mode if session is active
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      // Defer to allow Framer layout to settle
      setTimeout(enterEditMode, 60);
    }
    // Public hook for future features
    window.__brEdit = {
      enter: enterEditMode,
      exit: exitEditMode,
      open: openModal,
      state: state,
      bp: function () { return state.bp; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
