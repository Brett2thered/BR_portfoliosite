/* Tiny, dependency-free loading states. Runs in the head so parser-created
 * cards receive their placeholders before the page's first painted frame. */
(function () {
  'use strict';

  var names = [
    'Brett Player', 'Cloud People', 'Anchor Player', 'New Project', 'Meta',
    'Levels', 'Anthem', 'Arya Works', 'Navdy', 'Triton Player', 'Intel',
    'patchworks', 'Wonder', 'Education Card', 'Hack', 'TedX', 'Image of Reference'
  ];
  var selector = names.map(function (name) { return '[data-framer-name="' + name + '"]'; }).join(',');
  var tracked = new WeakSet();
  var posters = {
    'Brett Player': 'assets/brett-video-poster.jpg',
    'Cloud People': 'assets/cloud-people.webp',
    'Triton Player': 'assets/triton-poster.jpg'
  };

  function imageReady(image) {
    return new Promise(function (resolve) {
      function loaded() {
        if (!image.naturalWidth) return resolve(false);
        if (image.decode) image.decode().then(function () { resolve(true); }, function () { resolve(true); });
        else resolve(true);
      }
      if (image.complete) return loaded();
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', function () { resolve(false); }, { once: true });
    });
  }

  function videoReady(video) {
    return new Promise(function (resolve) {
      if (video.readyState >= 2) return resolve(true);
      if (video.error) return resolve(false);
      video.addEventListener('loadeddata', function () { resolve(true); }, { once: true });
      video.addEventListener('error', function () { resolve(false); }, { once: true });
    });
  }

  function frameReady(frame) {
    return new Promise(function (resolve) {
      var complete = false;
      var isVimeo = /^https:\/\/player\.vimeo\.com\//.test(frame.src);
      function finish(ready) {
        if (complete) return;
        complete = true;
        clearInterval(poll);
        clearTimeout(timeout);
        window.removeEventListener('message', message);
        frame.removeEventListener('load', loaded);
        frame.removeEventListener('error', failed);
        resolve(ready);
      }
      function probe() {
        if (!isVimeo || !frame.contentWindow) return;
        frame.contentWindow.postMessage({ method: 'addEventListener', value: 'loaded' }, 'https://player.vimeo.com');
        frame.contentWindow.postMessage({ method: 'getVideoTitle' }, 'https://player.vimeo.com');
      }
      function message(event) {
        if (event.origin !== 'https://player.vimeo.com' || event.source !== frame.contentWindow) return;
        var data = event.data;
        try { if (typeof data === 'string') data = JSON.parse(data); } catch (error) { return; }
        if (data && (data.event === 'loaded' || data.event === 'playing' ||
          (data.method === 'getVideoTitle' && typeof data.value === 'string'))) finish(true);
      }
      function loaded() { if (isVimeo) probe(); else finish(true); }
      function failed() { finish(false); }
      window.addEventListener('message', message);
      frame.addEventListener('load', loaded);
      frame.addEventListener('error', failed);
      var poll = isVimeo ? setInterval(probe, 750) : null;
      // If a third-party player cannot communicate, expose its own controls
      // or error UI rather than trapping the visitor behind a loading layer.
      var timeout = setTimeout(function () { finish(true); }, 20000);
      probe();
    });
  }

  function watch(card) {
    if (tracked.has(card)) return;
    var media = card.querySelectorAll('img, video, iframe');
    var poster = posters[card.getAttribute('data-framer-name')];
    if (!media.length && !poster) return;
    tracked.add(card);

    var avatar = card.getAttribute('data-framer-name') === 'Image of Reference';
    card.setAttribute('data-br-media-state', 'loading');
    card.setAttribute('aria-busy', 'true');
    var ghost = document.createElement('div');
    ghost.className = 'br-card-ghost' + (avatar ? ' br-card-ghost--avatar' : '');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = '<span class="br-ghost-chip"></span><span class="br-ghost-art"></span>' +
      '<span class="br-ghost-line"></span><span class="br-ghost-line br-ghost-line--short"></span>' +
      '<span class="br-ghost-error">Preview unavailable</span>';
    card.appendChild(ghost);

    var tasks;
    if (poster) {
      var preview = new Image();
      preview.src = poster;
      tasks = [imageReady(preview)];
    } else {
      tasks = Array.from(media).map(function (element) {
        if (element.tagName === 'IMG') return imageReady(element);
        if (element.tagName === 'VIDEO') return videoReady(element);
        return frameReady(element);
      });
    }
    Promise.all(tasks).then(function (ready) {
      var success = ready.every(Boolean);
      card.setAttribute('aria-busy', 'false');
      card.setAttribute('data-br-media-state', success ? 'ready' : 'error');
      if (success) setTimeout(function () { ghost.remove(); }, 240);
    });
  }

  function scan() { document.querySelectorAll(selector).forEach(watch); }
  var observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', function () {
    scan();
    observer.disconnect();
  }, { once: true });
  scan();
})();
