/* Continuous scroll --p wash, section nav scope (aria-current a11y), skip pill. */
(function(){
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /*
    Continuous wash (--p): page scroll fraction with a slight early bias so the
    soft .bar-prog highlight reaches further left→right ahead of true scroll,
    without discrete section snaps.
    EARLY ≈ 0.18 of scroll range (≈ one section feel on a 4-stop bar).
  */
  var EARLY = 0.18;

  function progress(){
    var doc = document.documentElement;
    var max = doc.scrollHeight - innerHeight;
    var raw = max > 0 ? scrollY / max : 0;
    var p = Math.min(1, Math.max(0, raw + EARLY * (1 - raw)));
    doc.style.setProperty('--p', p.toFixed(4));
  }
  addEventListener('scroll', progress, {passive:true});
  addEventListener('resize', progress);
  progress();

  /*
    Section → data-nav key (Home / Museum / Library / Soon).
    aria-current only (no visual accent pill). Mid-viewport spy.
  */
  var NAV_SECTIONS = [
    { id: 'hero', key: 'hero' },
    { id: 'about-dlsu-presidents-memorabilia', key: 'gallery' },
    { id: 'about-aeairc', key: 'library' },
    { id: 'about-sulyap-lasalyano', key: 'soon' },
    { id: 'footer', key: 'soon' }
  ];
  var SECTION_TO_NAV = {
    hero: 'hero',
    'about-dlsu-presidents-memorabilia': 'gallery',
    'about-aeairc': 'library',
    'about-sulyap-lasalyano': 'soon',
    footer: 'soon'
  };
  var lockKey = null;
  var lockUntil = 0;
  var lastKey = '';

  function glow(){
    var nav = document.querySelector('.bar-nav');
    var g = document.querySelector('.bar-nav-glow');
    if(!nav || !g) return;
    var cur = nav.querySelector('[aria-current="page"]');
    if(!cur){ g.classList.remove('on'); return; }
    var nr = nav.getBoundingClientRect();
    var cr = cur.getBoundingClientRect();
    g.style.width = cr.width + 'px';
    g.style.transform = 'translateX(' + (cr.left - nr.left) + 'px)';
    g.classList.add('on');
  }

  function setNavScope(key, lockMs){
    if(!key) key = 'hero';
    if(lockMs){
      lockKey = key;
      lockUntil = Date.now() + lockMs;
    }
    if(key === lastKey && !lockMs){
      glow();
      return;
    }
    lastKey = key;
    document.querySelectorAll('[data-nav]').forEach(function(a){
      if(a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var brand = document.querySelector('.bar-brand');
    if(brand){
      if(key === 'hero') brand.setAttribute('aria-current', 'page');
      else brand.removeAttribute('aria-current');
    }
    var bar = document.getElementById('bar');
    if(bar) bar.setAttribute('data-nav-scope', key);
    glow();
  }

  function scopeFromScroll(){
    if(Date.now() < lockUntil && lockKey) return lockKey;

    var pageGal = document.getElementById('page-gallery');
    if(pageGal && !pageGal.hidden) return 'gallery';

    var pageHome = document.getElementById('page-home');
    if(pageHome && pageHome.hidden) return 'hero';

    var marker = Math.max(200, innerHeight * 0.45);
    var best = 'hero';
    var bestTop = -Infinity;
    for(var i = 0; i < NAV_SECTIONS.length; i++){
      var s = NAV_SECTIONS[i];
      var el = document.getElementById(s.id);
      if(!el || el.hidden) continue;
      var top = el.getBoundingClientRect().top;
      if(top <= marker && top >= bestTop){
        bestTop = top;
        best = s.key;
      }
    }
    return best;
  }

  function syncNavScope(){
    setNavScope(scopeFromScroll());
  }

  window.setNavScope = function(key, lockMs){
    setNavScope(key, typeof lockMs === 'number' ? lockMs : 900);
  };
  window.navKeyForSection = function(id){
    return SECTION_TO_NAV[id] || null;
  };

  addEventListener('scroll', syncNavScope, {passive:true});
  addEventListener('resize', function(){ syncNavScope(); glow(); });
  document.addEventListener('routechange', function(e){
    var r = e.detail && e.detail.route;
    if(r === 'gallery') setNavScope('gallery', 400);
    else syncNavScope();
    progress();
  });
  setTimeout(syncNavScope, 50);
  setTimeout(glow, 60);

  var skip = document.getElementById('skipto');
  if(!skip) return;
  /* DOM order: museum → AEAIRC → Sulyap edu → gallery page → footer.
     #history was renamed to #about-aeairc — old id made AEAIRC drop out of the list. */
  var targets = [
    document.getElementById('about-dlsu-presidents-memorabilia'),
    document.getElementById('about-aeairc'),
    document.getElementById('about-sulyap-lasalyano'),
    document.getElementById('page-gallery'),
    document.getElementById('footer') || document.querySelector('.site-footer')
  ].filter(Boolean);

  function nearest(){
    var y = scrollY + innerHeight * 0.35;
    var best = null, bestD = Infinity;
    targets.forEach(function(el){
      if(el.hidden) return;
      var top = el.getBoundingClientRect().top + scrollY;
      var d = top - y;
      if(d > 40 && d < bestD){ bestD = d; best = el; }
    });
    return best;
  }

  function syncSkip(){
    var deep = scrollY > innerHeight * 0.55;
    var atEnd = scrollY > (document.documentElement.scrollHeight - innerHeight * 1.4);
    /* Hide at page end — footer .to-top owns “Back to top”. */
    skip.classList.toggle('on', deep && !atEnd);
    var lab = skip.querySelector('[data-i]');
    if(lab){
      lab.setAttribute('data-i', 'skip.next');
      if(window.applyLang){
        var L = window.pmLang ? window.pmLang() : 'en';
        var k = lab.getAttribute('data-i');
        if(window.T && window.T[L] && window.T[L][k]) lab.textContent = window.T[L][k];
      }
    }
  }
  addEventListener('scroll', syncSkip, {passive:true});
  document.addEventListener('routechange', syncSkip);
  syncSkip();

  skip.addEventListener('click', function(){
    var n = nearest();
    if(n) n.scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
  });

  document.getElementById('toTop') && document.getElementById('toTop').addEventListener('click', function(){
    scrollTo({top:0, behavior: reduced ? 'auto' : 'smooth'});
  });

  /* Footer ivory soft-light + mild glass-tile tilt (same --sx/--sy follow as hero) */
  var foot = document.querySelector('.site-footer');
  var footSpot = foot && foot.querySelector('.foot-spotlight');
  var footFine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(foot && footSpot && footFine && !reduced){
    var fSx = 50, fSy = 50, footRaf = 0;
    function paintFootSpot(){
      footRaf = 0;
      footSpot.style.setProperty('--sx', fSx.toFixed(2) + '%');
      footSpot.style.setProperty('--sy', fSy.toFixed(2) + '%');
      /* Subtle tilt toward pointer — max ~0.5deg */
      var tx = ((fSy - 50) / 50) * -0.5;
      var ty = ((fSx - 50) / 50) * 0.5;
      foot.style.setProperty('--tilt-x', tx.toFixed(2) + 'deg');
      foot.style.setProperty('--tilt-y', ty.toFixed(2) + 'deg');
    }
    foot.addEventListener('pointermove', function(e){
      var r = foot.getBoundingClientRect();
      if(r.width < 1 || r.height < 1) return;
      fSx = ((e.clientX - r.left) / r.width) * 100;
      fSy = ((e.clientY - r.top) / r.height) * 100;
      if(!footRaf) footRaf = requestAnimationFrame(paintFootSpot);
    }, {passive:true});
    foot.addEventListener('pointerenter', function(){ foot.classList.add('is-lit'); });
    foot.addEventListener('pointerleave', function(){
      foot.classList.remove('is-lit');
      foot.style.setProperty('--tilt-x', '0deg');
      foot.style.setProperty('--tilt-y', '0deg');
    });
  }
})();
