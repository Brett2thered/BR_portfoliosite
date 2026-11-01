(function () {
  'use strict';
  var frame = document.getElementById('medicare-prototype');
  var reset = document.getElementById('restart-prototype');
  if (!frame || !reset) return;
  reset.hidden = false;
  reset.addEventListener('click', function () { frame.src = 'prototypes/medicare/'; });
})();
