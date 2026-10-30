/* ASCII loading states and lazy loading for media on the sub-pages
 * (case studies etc.).
 *
 * ascii-loaders.js draws external overlays until media is ready, then decodes
 * the preview into place. Nothing is inserted into Framer's owned markup.
 *
 * Lazy loading: the first iframe and the first video on a page load right away.
 * The rest wait until they are within NEAR_MARGIN of the viewport, so a page
 * with several Loom embeds no longer starts them all at once. Chrome's own
 * loading="lazy" starts ~1,250px early, which defers nothing on these short
 * pages. Iframes are parked and resumed with location.replace, which keeps the
 * src attribute intact and adds no browser history entries.
 * If this script fails to run, everything loads eagerly as before.
 *
 * The home page has its own named-card loaders in card-loaders.js; this file
 * is injected into every other page by scripts/inject-media-loaders.mjs.
 * data-br-no-skeleton opts an element out of both; data-br-eager keeps it
 * eager but still shows the skeleton. */
(function () {
  'use strict';
  if (window.__brMediaLoaders) return;
  window.__brMediaLoaders = true;

  var HOST = 'data-br-media';        // on the wrapper: loading | ready | error
  var SELF = 'data-br-media-self';   // on the media itself, when its wrapper has other children
  var KIND = 'data-br-media-kind';   // video | frame | image (video gets a play glyph)
  var SELECTOR = 'iframe, video, img';
  var GIVE_UP_MS = 20000;            // never hold a third-party player behind a placeholder longer
  var NEAR_PX = 300;                 // start loading deferred media this far before it scrolls into view
  var DEFERRED = 'data-br-deferred'; // on media that is parked until it is near the viewport
  var HAS_IO = 'IntersectionObserver' in window;


  var tracked = new WeakSet();   // media elements already handled
  var hosts = new WeakMap();     // wrapper -> record
  var selfVisuals = new WeakMap();
  var records = [];              // every wrapper record, for the end-of-parse re-check
  var seen = { IFRAME: 0, VIDEO: 0 };   // the first of each kind is never deferred
  var NOW = Promise.resolve();

  var parked = new Set();        // deferred media waiting to come near the viewport

  // IntersectionObserver ignores anything clipped by an ancestor, such as the
  // next slide of a carousel just past the screen edge, so also compare each
  // element's box with the viewport directly (on load and on resize).
  function isNear(el) {
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;          // display:none and the like
    return r.bottom > -NEAR_PX && r.top < innerHeight + NEAR_PX && r.right > -NEAR_PX && r.left < innerWidth + NEAR_PX;
  }

  function sweep() { parked.forEach(function (entry) { if (isNear(entry.el)) entry.wake(); }); }
  var sweepQueued = false;
  function queueSweep() {
    if (sweepQueued || !parked.size) return;          // nothing parked: scrolling costs nothing
    sweepQueued = true;
    requestAnimationFrame(function () { sweepQueued = false; sweep(); });
  }
  window.addEventListener('load', sweep);
  window.addEventListener('resize', queueSweep);
  window.addEventListener('scroll', queueSweep, { passive: true, capture: true });

  function whenNear(el) {
    return new Promise(function (resolve) {
      var entry = { el: el, wake: function () { io.disconnect(); parked.delete(entry); resolve(); } };
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) return entry.wake();
      }, { rootMargin: NEAR_PX + 'px' });
      parked.add(entry);
      io.observe(el);
    });
  }

  /* Park an iframe: cancel the navigation the parser just started, then resume
   * it with location.replace so no history entry is added. */
  function deferFrame(el) {
    var real = el.getAttribute('src');
    try { el.contentWindow.location.replace('about:blank'); } catch (e) { return null; }
    el.setAttribute(DEFERRED, '');
    return whenNear(el).then(function () {
      el.removeAttribute(DEFERRED);
      try { el.contentWindow.location.replace(real); } catch (e) { el.setAttribute('src', real); }
    });
  }

  /* Park a video: dropping src and calling load() cancels the fetch; autoplay
   * resumes by itself once src is back. */
  function deferVideo(el) {
    var real = el.getAttribute('src');
    if (!real || el.querySelector('source')) return null;
    el.removeAttribute('src');
    el.load();
    el.setAttribute(DEFERRED, '');
    return whenNear(el).then(function () {
      el.removeAttribute(DEFERRED);
      el.setAttribute('src', real);
    });
  }

  /* Returns a promise that resolves when the element starts loading. */
  function defer(el) {
    if (!HAS_IO || (el.tagName !== 'IFRAME' && el.tagName !== 'VIDEO')) return NOW;
    if (seen[el.tagName]++ === 0 || el.hasAttribute('data-br-eager')) return NOW;
    return (el.tagName === 'IFRAME' ? deferFrame(el) : deferVideo(el)) || NOW;
  }

  function kindOf(el) {
    if (el.tagName === 'VIDEO') return 'video';
    if (el.tagName === 'IMG') return 'image';
    return /(^|\/\/)([\w-]+\.)?(loom\.com|vimeo\.com|youtube(-nocookie)?\.com|youtu\.be)\//i.test(el.getAttribute('src') || '')
      ? 'video' : 'frame';
  }

  function eligible(el) {
    if (el.closest('[data-br-ascii-portal]')) return false;
    if (el.hasAttribute('data-br-no-skeleton') || el.hasAttribute('hidden')) return false;
    var src = el.getAttribute('src') || '';
    if (el.tagName === 'IFRAME') {
      return !!src && !/^about:/i.test(src) && !/^https?:\/\/([\w-]+\.)?framer\.com\/edit/i.test(src);
    }
    if (el.tagName === 'VIDEO') {
      if (!src && !el.querySelector('source')) return false;
      // Nothing is fetched until play, so a placeholder would never clear.
      return !(el.preload === 'none' && !el.autoplay);
    }
    // Inline data: images and SVG icons/logos are instant; leave them alone.
    return !!src && !/^data:/i.test(src) && !/\.svg(\?|#|$)/i.test(src);
  }

  /* Resolve to a boolean once the media is usable (true) or has failed (false).
   * Nothing is listened for until `gate` resolves, i.e. until loading starts. */
  function whenLoaded(el, gate) {
    return new Promise(function (resolve) {
      var timer;
      function done(ok) { clearTimeout(timer); resolve(ok); }
      gate.then(function () {
        var tag = el.tagName;
        if (tag === 'IMG') {
          var settle = function () {
            if (el.decode) el.decode().then(function () { done(true); }, function () { done(true); });
            else done(true);
          };
          if (el.complete) return el.naturalWidth ? settle() : done(false);
          el.addEventListener('load', settle, { once: true });
          el.addEventListener('error', function () { done(false); }, { once: true });
          return;
        }
        if (tag === 'VIDEO') {
          if (el.readyState >= 2) return done(true);
          if (el.error) return done(false);
          el.addEventListener('loadeddata', function () { done(true); }, { once: true });
          el.addEventListener('error', function () { done(false); }, { once: true });
        } else {
          el.addEventListener('load', function onLoad() {
            // Parking an iframe loads about:blank first; that is not the embed.
            try { if (el.contentWindow.location.href === 'about:blank') return; } catch (e) { /* cross-origin: the real page */ }
            el.removeEventListener('load', onLoad);
            done(true);
          });
        }
        // A player that never reports back should expose its own controls instead.
        timer = setTimeout(function () { done(true); }, GIVE_UP_MS);
      });
    });
  }

  function clearWrapper(rec) {
    rec.wrapper.removeAttribute(HOST);
    rec.wrapper.removeAttribute(KIND);
    rec.wrapper.removeAttribute('aria-busy');
    if (rec.restorePosition) rec.wrapper.style.removeProperty('position');
  }

  async function finish(rec, state) {
    rec.done = true;
    rec.wrapper.setAttribute(HOST, state);
    rec.wrapper.setAttribute('aria-busy', 'false');
    if (rec.visual) await rec.visual.finish(state !== 'error');
    if (state === 'error') return;
    clearWrapper(rec);
    hosts.delete(rec.wrapper);
  }

  function wrapperFor(el) {
    var wrapper = el.parentElement;
    if (!wrapper || wrapper === document.body || wrapper.children.length !== 1) return null;
    var rec = hosts.get(wrapper);
    if (rec) return rec;
    rec = { wrapper: wrapper, media: new Set(), failed: false, done: false, demoted: false, restorePosition: false };
    hosts.set(wrapper, rec);
    records.push(rec);
    rec.visual = window.BRAscii && window.BRAscii.create(wrapper, { source: function () {
      return wrapper.querySelector('img, video, iframe');
    } });
    wrapper.setAttribute(KIND, kindOf(el));
    wrapper.setAttribute(HOST, 'loading');
    wrapper.setAttribute('aria-busy', 'true');
    return rec;
  }

  function track(el) {
    if (tracked.has(el)) return;
    tracked.add(el);
    if (!eligible(el)) return;

    var rec = wrapperFor(el);
    if (rec) rec.media.add(el);
    else startSelf(el);

    whenLoaded(el, defer(el)).then(async function (ok) {
      if (!rec || rec.demoted) {
        var visual = selfVisuals.get(el);
        if (visual) await visual.finish(ok);
        if (ok) el.removeAttribute(SELF); else el.setAttribute(SELF, 'error');
        el.removeAttribute('aria-busy');
        return;
      }
      rec.media.delete(el);
      if (!ok) rec.failed = true;
      if (rec.media.size === 0) finish(rec, rec.failed ? 'error' : 'ready');
    });
  }

  function startSelf(el) {
    el.setAttribute(SELF, 'loading');
    el.setAttribute('aria-busy', 'true');
    if (window.BRAscii) selfVisuals.set(el, window.BRAscii.create(el, { source: el }));
  }

  // The parser can hand us a media element before its later siblings exist.
  // Once parsing is done, any wrapper that turned out to hold other content
  // stops using the wrapper-wide placeholder so it can never cover that content.
  function recheck() {
    records.forEach(function (rec) {
      if (rec.done || rec.demoted || rec.wrapper.children.length <= 1) return;
      rec.demoted = true;
      if (rec.visual) rec.visual.cancel();
      clearWrapper(rec);
      rec.media.forEach(startSelf);
    });
  }
  document.addEventListener('DOMContentLoaded', recheck, { once: true });

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(SELECTOR)) track(root);
    var found = root.querySelectorAll ? root.querySelectorAll(SELECTOR) : [];
    for (var i = 0; i < found.length; i++) track(found[i]);
  }

  // Runs from <head>, so media is picked up as the parser creates it, and
  // keeps watching for anything Framer mounts later.
  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) scan(added[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document.documentElement);
})();
