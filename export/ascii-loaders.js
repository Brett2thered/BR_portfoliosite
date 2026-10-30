/* Shared visual layer for card-loaders.js and media-loaders.js.
 * Portals and sampled proxies are owned by this file, outside Framer's tree.
 * Real media, links, captions and player controls are never rewritten. */
(function () {
  'use strict';
  if (window.BRAscii) return;
  var templates = window.__brAsciiSkeletons;
  if (!templates) return;
  var core = null;
  var entries = new Set();
  var activeReveals = 0;
  var portal;
  var queued = false;
  var ticker = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Explicit preview URL only: give reviewers time to see cached skeletons.
  var previewDelay = new URLSearchParams(location.search).get('ascii-preview') === '1' ? 1200 : 0;
  var moduleUrl = new URL('vendor/ascii-reveal/core.js', document.currentScript.src).href;
  var posters = templates.posters || { names: {}, media: {} };

  var style = document.createElement('style');
  style.setAttribute('data-br-ascii-style', '');
  style.textContent = templates.css + '\n' + [
    '[data-br-ascii-portal]{position:absolute;top:0;left:0;width:100%;height:0;z-index:40;pointer-events:none}',
    '.br-ascii-panel{position:absolute;box-sizing:border-box;overflow:hidden;pointer-events:none;',
    'background:#f1f2f0;color:#8b918a;isolation:isolate;--ascii-glyph:#7f887e;--ascii-skeleton:#8b918a;',
    '--ascii-accent:#677864;--ascii-surface:#f1f2f0;--ascii-font:ui-monospace,"SF Mono",Menlo,Consolas,monospace}',
    '.br-ascii-panel>.ars{position:absolute;inset:0;margin:0;overflow:hidden;--ars-base:.42}',
    '.br-ascii-panel .ars-block{height:100%;border-radius:0;background:none}',
    '.br-ascii-panel .ars-base{font-size:11px;line-height:var(--br-ascii-line-height,14px);letter-spacing:var(--br-ascii-spacing,0px)}',
    '.br-ascii-panel .ar-overlay{z-index:3;overflow:hidden;border-radius:inherit}',
    '.br-ascii-color-field{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit}',
    '.br-ascii-panel[data-br-ascii-color="source"]>.ars{opacity:.06}',
    '.br-ascii-panel [data-br-ascii-source]{position:absolute;display:block;margin:0}',
    // Keep the real media masked until the colored glyphs have resolved into
    // the preview. Otherwise the full image flashes through behind the wave.
    '.br-ascii-panel[data-br-ascii-state="revealing"]{background:var(--ascii-surface)}',
    '.br-ascii-error{position:absolute;inset:0;display:grid;place-content:center;',
    'font:13px/1.4 sans-serif;color:#737b70;background:#f1f2f0e6}',
    '.br-ascii-panel[data-br-ascii-state="error"] .ars{opacity:.35}',
    '@media(prefers-reduced-motion:reduce){.br-ascii-panel canvas{display:none!important}}'
  ].join('');
  (document.head || document.documentElement).appendChild(style);

  var coreReady = import(moduleUrl).then(function (module) {
    core = module;
    schedule();
    return module;
  }).catch(function () { return null; });

  function mount() {
    if (!document.body) return;
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('data-br-ascii-portal', '');
      portal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(portal);
    }
  }

  function stopSkeleton(entry) {
    if (entry.stop) entry.stop();
    entry.stop = null;
  }

  function dispose(entry) {
    if (entry.disposed) return;
    entry.disposed = true;
    stopSkeleton(entry);
    if (entry.controller) entry.controller.destroy();
    resizeObserver && resizeObserver.unobserve(entry.target);
    entry.panel.remove();
    entries.delete(entry);
    if (!entries.size) { clearInterval(ticker); ticker = 0; }
  }

  function sourceFor(entry) {
    return (typeof entry.options.source === 'function' ? entry.options.source() : entry.options.source) ||
      entry.target.querySelector('img,video,iframe');
  }

  // Framer often puts a square player wrapper inside a rounded "Image" card.
  // Only borrow a parent's corners when its edges match: never round an inset
  // image as though it occupied the entire surrounding section.
  function surfaceRadius(target, rect) {
    var node = target;
    for (var depth = 0; node && node !== document.body && depth < 6; depth++, node = node.parentElement) {
      var box = node.getBoundingClientRect();
      if (Math.abs(box.left - rect.left) > 2 || Math.abs(box.top - rect.top) > 2 ||
          Math.abs(box.right - rect.right) > 2 || Math.abs(box.bottom - rect.bottom) > 2) continue;
      var styles = getComputedStyle(node);
      var radii = [styles.borderTopLeftRadius, styles.borderTopRightRadius,
        styles.borderBottomRightRadius, styles.borderBottomLeftRadius];
      if (radii.some(function (radius) { return parseFloat(radius) > 0; })) return radii.join(' ');
    }
    return getComputedStyle(target).borderRadius;
  }

  function loadPreview(entry) {
    if (entry.previewTask) return entry.previewTask;
    var source = sourceFor(entry);
    var url = entry.options.preview || posters.names[entry.target.getAttribute('data-framer-name')] ||
      posters.media[entry.mediaUrl];
    // All exported img src values are local, even when currentSrc is a remote
    // responsive variant. Read the local copy instead of tainting the canvas.
    if (!url && source && source.tagName === 'IMG') {
      var local = new URL(source.getAttribute('src') || '', location.href);
      if (local.origin === location.origin) url = local.href;
    }
    if (!url) return Promise.resolve(null);
    var image = new Image();
    image.decoding = 'async';
    entry.previewTask = new Promise(function (resolve) {
      image.onload = function () {
        var ready = image.decode ? image.decode().catch(function () {}) : Promise.resolve();
        ready.then(function () {
          if (!entry.disposed) { entry.preview = image; entry.fieldDirty = true; schedule(); }
          resolve(image);
        });
      };
      image.onerror = function () { resolve(null); };
      image.src = url;
    });
    return entry.previewTask;
  }

  function drawSource(context, image, width, height, fit, position) {
    var sw = image.naturalWidth || image.videoWidth || image.width;
    var sh = image.naturalHeight || image.videoHeight || image.height;
    var scale = fit === 'contain' ? Math.min(width / sw, height / sh) : Math.max(width / sw, height / sh);
    if (fit === 'fill') return context.drawImage(image, 0, 0, width, height);
    var parts = (position || '50% 50%').split(' ');
    var x = /%$/.test(parts[0]) ? parseFloat(parts[0]) / 100 : .5;
    var y = /%$/.test(parts[1] || '') ? parseFloat(parts[1]) / 100 : .5;
    context.drawImage(image, (width - sw * scale) * x, (height - sh * scale) * y, sw * scale, sh * scale);
  }

  // Once the tiny poster arrives, even a long video download waits behind its
  // own colored glyph portrait, not a generic gray box. This field is painted
  // once per size; the upstream core supplies the animated decode afterwards.
  function paintColorField(entry, rect) {
    if (!entry.preview || reduced.matches || entry.state !== 'loading' || !entry.fieldDirty) return;
    entry.fieldDirty = false;
    var columns = Math.max(8, Math.min(100, Math.round(rect.width / 9)));
    var rows = Math.max(6, Math.min(80, Math.round(rect.height / 12)));
    var sample = document.createElement('canvas');
    sample.width = columns; sample.height = rows;
    var context = sample.getContext('2d', { willReadFrequently: true });
    context.scale(columns / rect.width, rows / rect.height);
    drawSource(context, entry.preview, rect.width, rect.height, 'cover');
    var pixels;
    try { pixels = context.getImageData(0, 0, columns, rows).data; } catch (error) { return; }
    var field = entry.field || document.createElement('canvas');
    field.className = 'br-ascii-color-field';
    var dpr = Math.min(devicePixelRatio || 1, 2);
    field.width = Math.round(rect.width * dpr); field.height = Math.round(rect.height * dpr);
    var output = field.getContext('2d');
    output.scale(dpr, dpr);
    output.textAlign = 'center'; output.textBaseline = 'middle';
    var cw = rect.width / columns, ch = rect.height / rows;
    output.font = Math.round(ch * .95) + 'px ui-monospace,Menlo,monospace';
    var ramp = '░▒▓█';
    for (var y = 0; y < rows; y++) for (var x = 0; x < columns; x++) {
      var offset = (y * columns + x) * 4;
      var r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
      var ink = 1 - (.2126 * r + .7152 * g + .0722 * b) / 255;
      output.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      output.globalAlpha = .12;
      output.fillRect(x * cw, y * ch, cw + .5, ch + .5);
      output.globalAlpha = .82;
      output.fillText(ramp[Math.min(3, Math.floor(ink * 4))], (x + .5) * cw, (y + .5) * ch);
    }
    entry.field = field;
    entry.panel.appendChild(field);
    entry.panel.setAttribute('data-br-ascii-color', 'source');
    stopSkeleton(entry);
  }

  function update() {
    queued = false;
    mount();
    // Read all geometry before writing overlay positions.
    var boxes = [];
    entries.forEach(function (entry) {
      boxes.push({ entry: entry, rect: entry.target.getBoundingClientRect(), styles: getComputedStyle(entry.target) });
    });
    boxes.forEach(function (box) {
      var entry = box.entry, r = box.rect, panel = entry.panel;
      if (!entry.target.isConnected) return dispose(entry);
      var visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
        r.right > 0 && r.left < innerWidth && box.styles.visibility !== 'hidden';
      entry.visible = visible;
      panel.hidden = !visible;
      if (!visible) {
        stopSkeleton(entry);
        panel.remove();
        var layoutReady = document.readyState !== 'loading' &&
          (window.__brTheme || !document.querySelector('script[src="theme.js"]'));
        if (layoutReady && !entry.target.getClientRects().length) dispose(entry);
        return;
      }
      if (!panel.isConnected) portal.appendChild(panel);
      loadPreview(entry);
      var radius = surfaceRadius(entry.target, r);
      var geometry = [r.left + scrollX, r.top + scrollY, r.width, r.height, radius].join('|');
      if (geometry !== entry.geometry) {
        entry.geometry = geometry;
        panel.style.left = r.left + scrollX + 'px';
        panel.style.top = r.top + scrollY + 'px';
        panel.style.width = r.width + 'px';
        panel.style.height = r.height + 'px';
        panel.style.borderRadius = radius;
        panel.style.clipPath = 'inset(0px round ' + radius + ')';
        entry.radius = radius;
        entry.fieldDirty = true;
        panel.style.setProperty('--br-ascii-line-height', Math.max(10, r.height / (entry.options.avatar ? 12 : 20)) + 'px');
        panel.style.setProperty('--br-ascii-spacing', Math.max(0, r.width / 96 - 6.6) + 'px');
      }
      paintColorField(entry, r);
      if (entry.state === 'loading' && !entry.field && core && !reduced.matches && !document.hidden && !entry.stop) {
        entry.stop = core.animateSkeletons(panel);
      } else if (reduced.matches || document.hidden || entry.state !== 'loading') stopSkeleton(entry);
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  var resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener && reduced.addEventListener('change', schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  // Font swaps can move a media card without resizing that card itself.
  if (document.fonts) {
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener('loadingdone', schedule);
  }

  function proxyFor(entry) {
    var source = sourceFor(entry);
    var proxy;
    var targetRect = entry.target.getBoundingClientRect();
    var sourceRect = source && source.isConnected ? source.getBoundingClientRect() : targetRect;
    var sample = entry.preview;
    if (source && source.tagName === 'VIDEO' && source.readyState >= 2 &&
        new URL(source.currentSrc || source.src, location.href).origin === location.origin) sample = source;
    if (sample) {
      proxy = document.createElement('canvas');
      proxy.width = Math.max(1, Math.min(Math.round(sourceRect.width * Math.min(devicePixelRatio || 1, 2)), 1280));
      proxy.height = Math.max(1, Math.round(proxy.width * sourceRect.height / sourceRect.width));
      var context = proxy.getContext('2d');
      var sourceStyle = source && source.isConnected ? getComputedStyle(source) : null;
      try {
        drawSource(context, sample, proxy.width, proxy.height,
          sourceStyle && (sample.tagName === 'VIDEO' || (source && source.tagName === 'IMG')) ? sourceStyle.objectFit : 'cover',
          sourceStyle && sourceStyle.objectPosition);
        context.getImageData(0, 0, 1, 1); // Never hand a tainted canvas to the core.
        entry.panel.setAttribute('data-br-ascii-color', 'source');
      } catch (error) { proxy = null; }
    }
    if (!proxy) {
      // Cross-origin players cannot be sampled: the neutral glyph field
      // dissolves over the real player, which stays fully interactive below.
      proxy = document.createElement('div');
    }
    proxy.setAttribute('data-br-ascii-source', '');
    var cs = source && source.isConnected ? getComputedStyle(source) : null;
    Object.assign(proxy.style, {
      left: sourceRect.left - targetRect.left + 'px', top: sourceRect.top - targetRect.top + 'px',
      width: sourceRect.width + 'px', height: sourceRect.height + 'px',
      objectFit: cs ? cs.objectFit : 'cover', objectPosition: cs ? cs.objectPosition : 'center'
    });
    if (Math.abs(sourceRect.width - targetRect.width) < 2 && Math.abs(sourceRect.height - targetRect.height) < 2) {
      proxy.style.borderRadius = entry.radius;
    }
    return proxy;
  }

  function fade(entry, duration) {
    if (entry.disposed) return Promise.resolve();
    if (!entry.panel.animate || !entry.visible) { dispose(entry); return Promise.resolve(); }
    return entry.panel.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'
    }).finished.catch(function () {}).then(function () { dispose(entry); });
  }

  async function finish(entry, success) {
    if (entry.disposed || entry.state !== 'loading') return;
    if (success && previewDelay) {
      await new Promise(function (resolve) { setTimeout(resolve, Math.max(0, previewDelay - (performance.now() - entry.created))); });
      if (entry.disposed) return;
    }
    stopSkeleton(entry);
    if (!success) {
      entry.state = 'error';
      entry.panel.setAttribute('data-br-ascii-state', 'error');
      var label = document.createElement('span');
      label.className = 'br-ascii-error';
      label.textContent = 'Preview unavailable';
      entry.panel.appendChild(label);
      return;
    }
    entry.state = 'revealing';
    // Already-cached content must never be hidden just to replay an effect.
    if (performance.now() - entry.created < 100) { dispose(entry); return; }
    update();
    if (!entry.visible || reduced.matches || activeReveals >= 2) return fade(entry, 120);
    var module = core || await Promise.race([coreReady, new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 120); })]);
    if (entry.disposed) return;
    if (!module || !entry.visible || reduced.matches) return fade(entry, 120);
    // Local posters are tiny and usually already decoded. Bound the wait so a
    // missing poster cannot hold usable media behind an optional animation.
    await Promise.race([loadPreview(entry), new Promise(function (resolve) { setTimeout(resolve, 150); })]);
    if (entry.disposed) return;
    if (activeReveals >= 2) return fade(entry, 120);
    activeReveals++;
    try {
      var proxy = proxyFor(entry);
      entry.panel.replaceChildren(proxy);
      entry.panel.setAttribute('data-br-ascii-state', 'revealing');
      entry.controller = module.createAsciiReveal(entry.panel, {
        preset: 'dither', duration: 'fast', speed: 1, lazy: false, fallback: true,
        selector: '[data-br-ascii-source]', media: '[data-br-ascii-source]'
      });
      await Promise.race([entry.controller.reveal(), new Promise(function (resolve) { setTimeout(resolve, 1100); })]);
    } catch (error) {
      // The original media is always present behind this optional effect.
    } finally {
      activeReveals--;
      await fade(entry, 80);
    }
  }

  window.BRAscii = {
    create: function (target, options) {
      var panel = document.createElement('div');
      panel.className = 'br-ascii-panel';
      panel.setAttribute('data-br-ascii-state', 'loading');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('data-br-ascii-for', target.getAttribute('data-framer-name') || target.tagName.toLowerCase());
      panel.innerHTML = options && options.avatar ? templates.avatar : templates.media;
      var entry = { target: target, options: options || {}, panel: panel, state: 'loading', created: performance.now(), disposed: false, visible: false };
      var source = sourceFor(entry);
      entry.mediaUrl = source ? (source.getAttribute('src') || '').split('?')[0] : '';
      panel.setAttribute('data-br-ascii-media', entry.mediaUrl);
      entries.add(entry);
      resizeObserver && resizeObserver.observe(target);
      if (!ticker) ticker = setInterval(function () { if (!document.hidden) schedule(); }, 150);
      schedule();
      return { finish: function (success) { return finish(entry, success); }, cancel: function () { dispose(entry); } };
    },
    coreReady: coreReady,
    refresh: schedule
  };
  window.addEventListener('pagehide', function (event) { if (!event.persisted) entries.forEach(dispose); });
})();
