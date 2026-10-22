/* Long-press the plaque Sulyap logo (~3s) → Curator desk.
   Short click keeps #about-sulyap-lasalyano (via href + data-nav). */
(function () {
  var HOLD_MS = 3000;
  var HINT_MS = 1500;
  var MOVE_PX = 16;
  var el = document.querySelector('.sign .partner-logo[data-plaque-egg], .sign a.partner-logo');
  if (!el) return;

  var timer = null;
  var hintTimer = null;
  var startX = 0;
  var startY = 0;
  var startT = 0;
  var armed = false;
  var opened = false;
  var suppressClick = false;
  var activeId = null;

  function clearTimers() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
  }

  function clearHint() {
    try {
      el.style.removeProperty('scale');
    } catch (err) {}
  }

  function disarm() {
    clearTimers();
    armed = false;
    activeId = null;
    clearHint();
  }

  function curatorHref() {
    try {
      if (location.protocol === 'file:') return 'curator.html';
      var path = location.pathname || '/';
      if (/index\.html$/i.test(path)) {
        return path.replace(/index\.html$/i, 'curator.html');
      }
      /* Directory URL (/ or /subdir/) → absolute curator path for serve.mjs / Vercel */
      var dir = path.endsWith('/') ? path : path.replace(/[^/]*$/, '');
      if (!dir || dir === '/') return '/curator';
      return dir.replace(/\/?$/, '/') + 'curator';
    } catch (err) {
      return 'curator.html';
    }
  }

  function openCurator() {
    if (opened) return;
    opened = true;
    suppressClick = true;
    disarm();
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (err) {}
    /* Same-origin: skip splash + play home in-anim when returning from curator. */
    try {
      sessionStorage.setItem('sl_home_ready', '1');
    } catch (err) {}
    location.assign(curatorHref());
  }

  function heldLongEnough() {
    return startT > 0 && Date.now() - startT >= HOLD_MS - 30;
  }

  function onPointerDown(e) {
    if (e.isPrimary === false) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    /* Block scroll / callout from stealing the hold (touch + pen). */
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      try {
        e.preventDefault();
      } catch (err) {}
    }
    opened = false;
    suppressClick = false;
    armed = true;
    activeId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startT = Date.now();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {}
    clearTimers();
    clearHint();
    hintTimer = setTimeout(function () {
      if (!armed || opened) return;
      try {
        el.style.scale = '1.06';
      } catch (err) {}
    }, HINT_MS);
    timer = setTimeout(openCurator, HOLD_MS);
  }

  function onPointerMove(e) {
    if (!armed || activeId != null && e.pointerId !== activeId) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) {
      disarm();
    }
  }

  function onPointerUp(e) {
    if (activeId != null && e.pointerId !== activeId) return;
    if (armed && heldLongEnough()) {
      openCurator();
      return;
    }
    disarm();
  }

  function onPointerCancel(e) {
    if (activeId != null && e.pointerId !== activeId) return;
    /* Browser long-press / scroll often cancels the pointer before 3s.
       If we already crossed the hold threshold, still navigate. */
    if (armed && heldLongEnough()) {
      openCurator();
      return;
    }
    disarm();
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('lostpointercapture', function () {
    if (!armed || opened) return;
    if (heldLongEnough()) openCurator();
    else disarm();
  });

  /* Capture-phase: swallow the click that follows a completed hold. */
  el.addEventListener(
    'click',
    function (e) {
      if (!opened && !suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      opened = false;
      suppressClick = false;
    },
    true
  );

  el.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  el.addEventListener(
    'dragstart',
    function (e) {
      e.preventDefault();
    },
    true
  );
})();
