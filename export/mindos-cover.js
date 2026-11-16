/* The video's clock drives the logo, so buffering and pauses cannot cause drift.
 * The logo holds across the loop seam; TEDx remains outside the animated layer. */
(() => {
  const card = document.querySelector('.mindos-cover');
  if (!card) return;
  const video = card.querySelector('video');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let starting = false;
  let frame = null;
  const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
  const smooth = value => {
    const x = Math.max(0, Math.min(1, value));
    return x * x * (3 - 2 * x);
  };

  function paint() {
    const progress = video.duration ? video.currentTime / video.duration : 0;
    const opacity = reduced.matches ? 1 : progress < .5
      ? 1 - smooth((progress - .09) / .08)
      : smooth((progress - .76) / .10);
    card.style.setProperty('--mindos-brand-opacity', opacity.toFixed(4));
    card.style.setProperty('--mindos-brand-scale', (.94 + .06 * opacity).toFixed(4));
  }
  function cancelFrame() {
    if (frame === null) return;
    if (nativeFrames) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = null;
  }
  function tick() {
    frame = null;
    paint();
    if (!visible || document.hidden || reduced.matches) return stop();
    if (video.paused) return;
    frame = nativeFrames ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function stop() {
    video.pause();
    cancelFrame();
    if (reduced.matches && video.currentTime !== 0) video.currentTime = 0;
  }
  function sync() {
    if (reduced.matches || !visible || document.hidden) return stop();
    if (!video.paused || starting) return;
    starting = true;
    video.play().then(() => {
      if (reduced.matches || !visible || document.hidden) stop();
    }).catch(() => { /* The supplied logo remains visible if playback is blocked. */ })
      .finally(() => { starting = false; });
  }

  video.addEventListener('play', () => {
    if (!visible || document.hidden || reduced.matches) return stop();
    cancelFrame(); tick();
  });
  video.addEventListener('pause', cancelFrame);
  video.addEventListener('seeked', paint);
  video.addEventListener('loadedmetadata', paint);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { threshold: .2 });
  observer.observe(card);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => {
    if (reduced.matches) { stop(); video.currentTime = 0; }
    paint();
    sync();
  });
  paint();
})();
