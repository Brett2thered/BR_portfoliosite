/* Silent, viewport-aware playback for illustrated case-study loops.
 * Native controls work without JS. Poster readiness drives the shared ASCII
 * reveal, so a paused/reduced-motion video never waits for playback to load. */
(function () {
  'use strict';
  var videos = Array.from(document.querySelectorAll('[data-project-loop]'));
  if (!videos.length) return;
  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var paused = preference.matches;
  var toggle = document.getElementById('animation-toggle');
  var status = document.getElementById('animation-mode');
  var entries = videos.map(function (video) {
    video.muted = true;
    return { video: video, visible: false, manualPause: false, managedPause: false, starting: false };
  });

  function labels() {
    if (toggle) toggle.textContent = paused ? 'Play animations' : 'Pause all animations';
    if (status) status.textContent = paused
      ? (preference.matches ? 'Animations are paused for your reduced-motion setting. You can play them if you choose.' : 'Animations are paused. You can still use each video’s controls.')
      : 'Silent loops play as they enter view. Use the video controls or pause all animations.';
  }
  function stop(entry) {
    if (!entry.video.paused) entry.managedPause = true;
    entry.video.pause();
  }
  function sync(entry) {
    if (paused || document.hidden || !entry.visible || entry.manualPause) return stop(entry);
    if (!entry.video.paused || entry.starting) return;
    entry.starting = true;
    entry.video.preload = 'auto';
    var request = entry.video.play();
    if (request) request.catch(function () { /* Native controls and poster remain available. */ })
      .finally(function () { entry.starting = false; });
    else entry.starting = false;
  }
  function syncAll() { entries.forEach(sync); }

  entries.forEach(function (entry) {
    var video = entry.video;
    // These elements opt out of generic video-readiness tracking; a poster
    // can be revealed without fetching or animating the entire video.
    var visual = window.BRAscii && window.BRAscii.create(video.parentElement, { source: video, preview: video.getAttribute('poster') });
    var settled = false;
    function ready() { if (!settled) { settled = true; if (visual) visual.finish(true); } }
    var poster = new Image();
    poster.onload = function () {
      if (poster.decode) poster.decode().catch(function () {}).then(ready);
      else ready();
    };
    poster.onerror = ready;
    poster.src = video.getAttribute('poster');
    video.addEventListener('loadeddata', ready, { once: true });
    video.addEventListener('pause', function () {
      if (entry.managedPause) entry.managedPause = false;
      else entry.manualPause = true;
    });
    video.addEventListener('play', function () {
      if (entry.starting && (paused || document.hidden || !entry.visible)) return stop(entry);
      entry.manualPause = false;
      if (!entry.starting && paused) { paused = false; labels(); }
    });
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (changes) {
      changes.forEach(function (change) {
        var entry = entries.find(function (item) { return item.video === change.target; });
        entry.visible = change.isIntersecting;
        sync(entry);
      });
    }, { threshold: .05 });
    entries.forEach(function (entry) { observer.observe(entry.video); });
  } else {
    entries.forEach(function (entry) { entry.visible = true; });
    syncAll();
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      paused = !paused;
      if (!paused) entries.forEach(function (entry) { entry.manualPause = false; });
      labels(); syncAll();
    });
  }
  preference.addEventListener('change', function () { if (preference.matches) { paused = true; labels(); syncAll(); } });
  document.addEventListener('visibilitychange', syncAll);
  labels();
})();
