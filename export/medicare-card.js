(function () {
  'use strict';
  var card = document.querySelector('[data-framer-name="Medicare"]');
  if (!card) return;
  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  var visible = false, hovered = false, focused = false;
  function sync() {
    card.dataset.motion = visible && !document.hidden && !hovered && !focused && !preference.matches ? 'playing' : 'paused';
  }
  card.addEventListener('pointerenter', function (event) { if (finePointer.matches && event.pointerType !== 'touch') { hovered = true; sync(); } });
  card.addEventListener('pointerleave', function () { hovered = false; sync(); });
  card.addEventListener('focusin', function () { focused = true; sync(); });
  card.addEventListener('focusout', function (event) { focused = card.contains(event.relatedTarget); sync(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }).observe(card);
  } else visible = true;
  preference.addEventListener('change', sync);
  finePointer.addEventListener('change', function () { if (!finePointer.matches) hovered = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  sync();
})();
