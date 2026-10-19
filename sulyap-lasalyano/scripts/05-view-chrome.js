/* Sticky bar (full → pill), mobile menu, marquee scrub, AEAIRC info + parallax. */
(function(){
  var bar = document.getElementById('bar');
  var hero = document.querySelector('.hero');
  var menuBtn = document.getElementById('menuBtn');
  var msheet = document.getElementById('msheet');
  var mClose = document.getElementById('msheetClose');
  var sheetClosing = false;

  function reduceMotion(){
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function isMobile(){
    return matchMedia('(max-width:860px)').matches;
  }

  /* Desktop: full bar at top → pill when scrolled past hero head.
     Mobile: .on reveals brand lockup. */
  function syncBar(){
    if(!bar) return;
    var past = scrollY > 48;
    if(hero){
      var hb = hero.getBoundingClientRect().bottom;
      past = past || hb < 100;
    }
    var mobile = isMobile();
    bar.classList.toggle('on', past || mobile);
    bar.classList.toggle('bar--pill', !mobile && past);
  }
  addEventListener('scroll', syncBar, {passive:true});
  addEventListener('resize', syncBar);
  syncBar();

  document.querySelectorAll('[data-flip]').forEach(function(el){
    el.addEventListener('click', function(){ closeSheet(); });
  });

  function openSheet(){
    if(!msheet || sheetClosing) return;
    msheet.classList.remove('is-closing');
    msheet.hidden = false;
    msheet.style.animation = 'none';
    void msheet.offsetWidth;
    msheet.style.animation = '';
    document.body.classList.add('msheet-open');
    if(menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSheet(immediate){
    if(!msheet || msheet.hidden) return;
    if(menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('msheet-open');

    if(immediate || reduceMotion() || sheetClosing){
      sheetClosing = false;
      msheet.classList.remove('is-closing');
      msheet.hidden = true;
      return;
    }

    sheetClosing = true;
    msheet.classList.add('is-closing');
    var done = function(e){
      if(e && e.target !== msheet) return;
      msheet.removeEventListener('animationend', done);
      clearTimeout(msheet._closeT);
      msheet.classList.remove('is-closing');
      msheet.hidden = true;
      sheetClosing = false;
    };
    msheet.addEventListener('animationend', done);
    msheet._closeT = setTimeout(done, 280);
  }

  if(menuBtn) menuBtn.addEventListener('click', function(){
    if(msheet && !msheet.hidden && !sheetClosing) closeSheet();
    else openSheet();
  });
  if(mClose) mClose.addEventListener('click', function(){ closeSheet(); });
  if(msheet){
    msheet.querySelectorAll('a[data-route], a[data-nav]').forEach(function(a){
      a.addEventListener('click', function(){ closeSheet(); });
    });
  }
  addEventListener('keydown', function(e){
    if(e.key === 'Escape' && msheet && !msheet.hidden) closeSheet();
  });

  document.addEventListener('viewflip', function(){
    if(bar){
      bar.classList.add('flipping');
      setTimeout(function(){ bar.classList.remove('flipping'); }, 850);
    }
  });

  /* ---- Marquee: JS-driven translateX; scrub on drag; links click when not scrubbed ---- */
  var marquee = document.getElementById('marquee');
  var track = document.getElementById('marqueeTrack');
  if(marquee && track && !reduceMotion()){
    var DURATION_MS = 48000;
    var DRAG_THRESHOLD = 8;
    var drag = false, tracking = false, startX = 0, base = 0, offset = 0;
    var offscreen = false, lastTs = 0, activePtr = null;

    track.style.animation = 'none';

    function loopWidth(){
      return track.scrollWidth / 2 || 1;
    }
    function wrap(px){
      var w = loopWidth();
      if(w <= 1) return 0;
      px = px % w;
      if(px > 0) px -= w;
      return px;
    }
    function paint(){
      track.style.transform = 'translate3d(' + offset + 'px,0,0)';
    }
    function tick(ts){
      requestAnimationFrame(tick);
      if(!lastTs){ lastTs = ts; return; }
      var dt = ts - lastTs;
      lastTs = ts;
      if(offscreen || drag || tracking || document.hidden) return;
      if(dt > 80) dt = 80;
      var w = loopWidth();
      offset = wrap(offset - (w / DURATION_MS) * dt);
      paint();
    }
    requestAnimationFrame(tick);

    if('IntersectionObserver' in window){
      var mio = new IntersectionObserver(function(entries){
        var en = entries[0];
        if(en){
          offscreen = !en.isIntersecting;
          marquee.classList.toggle('is-paused', offscreen);
          if(!offscreen) lastTs = 0;
        }
      }, {threshold:0.02});
      mio.observe(marquee);
    }

    marquee.addEventListener('pointerdown', function(e){
      if(e.button && e.button !== 0) return;
      tracking = true;
      drag = false;
      activePtr = e.pointerId;
      startX = e.clientX;
      base = offset;
    });
    marquee.addEventListener('pointermove', function(e){
      if(!tracking || e.pointerId !== activePtr) return;
      var dx = e.clientX - startX;
      if(!drag && Math.abs(dx) < DRAG_THRESHOLD) return;
      if(!drag){
        drag = true;
        marquee.classList.add('is-dragging');
        try{ marquee.setPointerCapture(e.pointerId); }catch(err){}
      }
      offset = wrap(base + dx);
      paint();
    });
    function endDrag(e){
      if(!tracking || (e && activePtr != null && e.pointerId !== activePtr)) return;
      var wasDrag = drag;
      tracking = false;
      drag = false;
      activePtr = null;
      marquee.classList.remove('is-dragging');
      try{ if(e) marquee.releasePointerCapture(e.pointerId); }catch(err){}
      lastTs = 0;
      if(wasDrag && e && e.type === 'pointerup'){
        /* Suppress click after scrub so portrait links do not navigate mid-drag. */
        var block = function(ev){ ev.preventDefault(); ev.stopPropagation(); };
        marquee.addEventListener('click', block, {capture:true, once:true});
      }
    }
    marquee.addEventListener('pointerup', endDrag);
    marquee.addEventListener('pointercancel', endDrag);
  }

  /* ---- AEAIRC building parallax + Info panel ---- */
  var aeaSec = document.getElementById('about-aeairc');
  var aeaBg = document.getElementById('aeaBg');
  var aeaBtn = document.getElementById('aeaInfoBtn');
  var aeaPanel = document.getElementById('aeaInfoPanel');
  var aeaBubble = document.getElementById('aeaInfoBubble');
  var aeaAnchor = aeaBtn && aeaBtn.closest ? aeaBtn.closest('.aea-info-anchor') : null;

  /* Bubble pop: only while #about-aeairc intersects; reset on leave */
  if(aeaSec && 'IntersectionObserver' in window){
    var aeaInView = false;
    function rearmAeaBubble(){
      if(reduceMotion() || !aeaBubble) return;
      aeaBubble.style.animation = 'none';
      void aeaBubble.offsetWidth;
      aeaBubble.style.animation = '';
    }
    function setAeaInView(on){
      if(on === aeaInView) return;
      aeaInView = on;
      aeaSec.classList.toggle('is-in-view', on);
      /* Re-arm CSS animations from frame 0 when re-entering */
      if(on) rearmAeaBubble();
    }
    var aeaIo = new IntersectionObserver(function(entries){
      var e = entries[0];
      setAeaInView(!!(e && e.isIntersecting));
    }, {threshold:0.18, rootMargin:'0px'});
    aeaIo.observe(aeaSec);
  }

  if(aeaBg && aeaSec && !reduceMotion()){
    var aeaQ = false;
    function aeaFrame(){
      aeaQ = false;
      var rect = aeaSec.getBoundingClientRect();
      var mid = rect.top + rect.height * 0.5;
      /* Moderate Y travel — no scale() (would soft-upscale a modest plate) */
      var y = (innerHeight * 0.5 - mid) * 0.4;
      aeaBg.style.setProperty('--aea-y', y.toFixed(1));
    }
    function aeaQueue(){ if(!aeaQ){ aeaQ = true; requestAnimationFrame(aeaFrame); } }
    addEventListener('scroll', aeaQueue, {passive:true});
    addEventListener('resize', aeaQueue);
    aeaQueue();
  }

  /* Cursor soft-light over the building (same --sx/--sy follow as hero) */
  var aeaSpot = aeaSec && aeaSec.querySelector('.aea-spotlight');
  var aeaFinePtr = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(aeaSec && aeaSpot && aeaFinePtr && !reduceMotion()){
    var aeaSx = 50, aeaSy = 48, aeaSpotRaf = 0;
    function paintAeaSpot(){
      aeaSpotRaf = 0;
      aeaSpot.style.setProperty('--sx', aeaSx.toFixed(2) + '%');
      aeaSpot.style.setProperty('--sy', aeaSy.toFixed(2) + '%');
    }
    aeaSec.addEventListener('pointermove', function(e){
      var r = aeaSec.getBoundingClientRect();
      if(r.width < 1 || r.height < 1) return;
      aeaSx = ((e.clientX - r.left) / r.width) * 100;
      aeaSy = ((e.clientY - r.top) / r.height) * 100;
      if(!aeaSpotRaf) aeaSpotRaf = requestAnimationFrame(paintAeaSpot);
    }, {passive:true});
    aeaSec.addEventListener('pointerenter', function(){ aeaSec.classList.add('is-lit'); });
    aeaSec.addEventListener('pointerleave', function(){ aeaSec.classList.remove('is-lit'); });
  }

  if(aeaBtn && aeaPanel){
    var panelClosing = false;
    function dismissBubble(){
      if(aeaBubble) aeaBubble.classList.add('is-dismissed');
    }
    function setExpanded(open){
      aeaBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(aeaAnchor) aeaAnchor.classList.toggle('is-open', !!open);
      if(open) dismissBubble();
    }
    function openPanel(){
      if(panelClosing) return;
      aeaPanel.classList.remove('is-closing');
      aeaPanel.hidden = false;
      setExpanded(true);
    }
    function closePanel(immediate){
      if(aeaPanel.hidden) return;
      setExpanded(false);
      if(immediate || reduceMotion() || panelClosing){
        panelClosing = false;
        aeaPanel.classList.remove('is-closing');
        aeaPanel.hidden = true;
        return;
      }
      panelClosing = true;
      aeaPanel.classList.add('is-closing');
      var done = function(e){
        if(e && e.target !== aeaPanel) return;
        aeaPanel.removeEventListener('animationend', done);
        clearTimeout(aeaPanel._t);
        aeaPanel.classList.remove('is-closing');
        aeaPanel.hidden = true;
        panelClosing = false;
      };
      aeaPanel.addEventListener('animationend', done);
      aeaPanel._t = setTimeout(done, 280);
    }
    aeaBtn.addEventListener('click', function(){
      if(aeaPanel.hidden || panelClosing) openPanel();
      else closePanel();
    });
    if(aeaBubble){
      aeaBubble.addEventListener('click', function(){
        dismissBubble();
        openPanel();
      });
      aeaBubble.style.cursor = 'pointer';
    }
    addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !aeaPanel.hidden) closePanel();
    });
  }
})();
