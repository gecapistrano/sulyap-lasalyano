/* Hanging-sign hero + flipView API. Soft wipe when past the stage.
   Parallax matches reference: translate3d(0, scrollY * data-speed, 0). */
(function(){
  var chip = document.getElementById('flip');
  var wipe = document.getElementById('wipe');
  var stage = document.querySelector('.stage-panel');
  var sign = document.getElementById('sign');
  var hero = document.querySelector('.hero');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setWarm(warm){
    document.body.classList.toggle('warm', warm);
    document.documentElement.classList.toggle('warm', warm);
    if(chip) chip.setAttribute('data-warm', warm ? '1' : '0');
    document.dispatchEvent(new CustomEvent('viewflip', {detail:{warm:warm}}));
  }

  function nearHero(){
    return stage ? stage.getBoundingClientRect().bottom > 0 : scrollY < 40;
  }

  function goWarm(warm){
    if(nearHero() || reduced){
      setWarm(warm);
      if(!nearHero() && scrollY) scrollTo(0, 0);
      return;
    }
    if(!wipe){ setWarm(warm); scrollTo(0,0); return; }
    wipe.classList.add('on');
    setTimeout(function(){
      setWarm(warm);
      scrollTo({top:0, left:0, behavior:'instant'});
      requestAnimationFrame(function(){ wipe.classList.remove('on'); });
    }, 230);
  }

  window.flipView = function(forceWarm){
    if(typeof forceWarm === 'boolean') goWarm(forceWarm);
    else goWarm(!document.documentElement.classList.contains('warm'));
  };

  /* Cool home: data-nav on #flip scrolls to #nx-gallery. Warm: return home. */
  if(chip){
    chip.addEventListener('click', function(e){
      e.stopPropagation();
      if(document.documentElement.classList.contains('warm')){
        e.preventDefault();
        location.hash = '#/';
      }
    });
    setTimeout(function(){ chip.classList.add('landed'); }, 1700);
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
