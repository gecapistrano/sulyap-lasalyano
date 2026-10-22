/* Hanging-sign hero. The warm gallery flip is retired.
   Parallax matches reference: translate3d(0, scrollY * data-speed, 0).
   Home enter: replay plaque/chip/CTA in-anim when splash is skipped or bfcache restores. */
(function(){
  var chip = document.getElementById('flip');
  var sign = document.getElementById('sign');
  var hero = document.querySelector('.hero');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var landTimer = 0;
  var enterBusy = false;

  function setWarm(warm){
    document.body.classList.toggle('warm', warm);
    document.documentElement.classList.toggle('warm', warm);
    if(chip) chip.setAttribute('data-warm', warm ? '1' : '0');
    document.dispatchEvent(new CustomEvent('viewflip', {detail:{warm:warm}}));
  }

  /* Gallery route is gone. flipView only clears a leftover warm state. */
  window.flipView = function(){
    setWarm(false);
    if((location.hash || '').indexOf('#/gallery') === 0) location.hash = '#/';
  };

  /* Cool home: data-nav on #flip scrolls to #about-sulyap-lasalyano. Warm: return home. */
  if(chip){
    chip.addEventListener('click', function(e){
      e.stopPropagation();
      if(document.documentElement.classList.contains('warm')){
        e.preventDefault();
        location.hash = '#/';
      }
    });
  }

  function scheduleChipLand(ms){
    if(!chip) return;
    clearTimeout(landTimer);
    landTimer = setTimeout(function(){
      chip.classList.add('landed');
      /* Keep html.home-enter — removing it would re-fire base sign-drop. */
    }, ms);
  }

  /* First-load splash path: chip lands after default CSS chip-in delay. */
  if(chip && !window.__homeEnter){
    scheduleChipLand(1700);
  }

  function restartAnim(el){
    if(!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  function playHomeEnter(opts){
    opts = opts || {};
    var root = document.documentElement;
    var fromBfcache = !!(opts.bfcache || window.__homeEnterBfcache);
    window.__homeEnter = false;
    window.__homeEnterBfcache = false;

    if(reduced){
      root.classList.remove('home-enter-hold', 'home-enter');
      if(chip) chip.classList.add('landed');
      return;
    }
    if(enterBusy && !fromBfcache) return;
    enterBusy = true;

    try{ scrollTo(0, 0); }catch(e){}

    if(chip) chip.classList.remove('landed');

    var drop = document.querySelector('.sign-drop');
    var swing = document.querySelector('.sign-swing');
    var cta = document.querySelector('.hero-cta');

    /* bfcache: animations already finished — hard restart before applying snappy enter. */
    if(fromBfcache || !root.classList.contains('home-enter-hold')){
      restartAnim(drop);
      restartAnim(swing);
      restartAnim(chip);
      restartAnim(cta);
    }

    root.classList.remove('home-enter');
    void root.offsetWidth;
    root.classList.add('home-enter');
    root.classList.remove('home-enter-hold');

    /* Snappier return: chip-in ~0.4s delay + 0.45s → land ~950ms */
    scheduleChipLand(950);

    if(window.pmSiteGuide && typeof window.pmSiteGuide.replayEntrance === 'function'){
      try{ window.pmSiteGuide.replayEntrance(); }catch(e){}
    }

    setTimeout(function(){ enterBusy = false; }, 1200);
  }

  window.pmHomeEnter = playHomeEnter;

  function onHomeEnter(e){
    var detail = (e && e.detail) || {};
    /* Defer one frame so held keyframes paint before release. */
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        playHomeEnter({ bfcache: !!detail.bfcache });
      });
    });
  }

  document.addEventListener('homeenter', onHomeEnter);
  if(window.__homeEnter){
    onHomeEnter({ detail:{ bfcache: !!window.__homeEnterBfcache } });
  }

  /* ============ Parallax + scroll push on the hanging board (reference) ============ */
  var layers = document.querySelectorAll('.hero > .layer[data-speed]');
  if(sign && hero && !reduced){
    var lastY = scrollY, kick = 0, queued = false;
    function frame(){
      queued = false;
      var home = document.getElementById('page-home');
      if(home && home.hidden) return;
      var y = scrollY, dy = y - lastY; lastY = y;
      if(y < hero.offsetHeight * 1.3){
        for(var i = 0; i < layers.length; i++){
          var sp = parseFloat(layers[i].dataset.speed) || 0.3;
          layers[i].style.transform = 'translate3d(0,' + (y * sp).toFixed(1) + 'px,0)';
        }
      }
      kick = kick * 0.9 + Math.max(-3, Math.min(3, dy * 0.08));
      sign.style.setProperty('--kick', kick.toFixed(2));
      if(Math.abs(kick) > 0.02) queue();
    }
    function queue(){ if(!queued){ queued = true; requestAnimationFrame(frame); } }
    addEventListener('scroll', queue, {passive:true});
    queue();
  }

  /* Cursor flashlight over the dark SVG (fine pointer / hover only) */
  var spot = hero && hero.querySelector('.hero-spotlight');
  var finePtr = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(hero && spot && finePtr && !reduced){
    var sx = 50, sy = 42, spotRaf = 0;
    function paintSpot(){
      spotRaf = 0;
      spot.style.setProperty('--sx', sx.toFixed(2) + '%');
      spot.style.setProperty('--sy', sy.toFixed(2) + '%');
    }
    hero.addEventListener('pointermove', function(e){
      var r = hero.getBoundingClientRect();
      if(r.width < 1 || r.height < 1) return;
      sx = ((e.clientX - r.left) / r.width) * 100;
      sy = ((e.clientY - r.top) / r.height) * 100;
      if(!spotRaf) spotRaf = requestAnimationFrame(paintSpot);
    }, {passive:true});
    hero.addEventListener('pointerenter', function(){ hero.classList.add('is-lit'); });
    hero.addEventListener('pointerleave', function(){ hero.classList.remove('is-lit'); });
  }
})();
