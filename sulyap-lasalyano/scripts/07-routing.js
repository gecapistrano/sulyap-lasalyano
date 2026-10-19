/* Hash routing: #/ home, #/history, #/gallery. Section anchors (#hero, …). */
(function(){
  try{ if('scrollRestoration' in history) history.scrollRestoration = 'manual'; }catch(e){}
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pageHome = document.getElementById('page-home');
  var pageGal = document.getElementById('page-gallery');
  var nxHome = document.getElementById('nx-home');
  var nxGal = document.getElementById('about-sulyap-lasalyano');
  var wipe = document.getElementById('wipe');
  var fromFlip = false;
  var boot = true;

  function toTop(){
    scrollTo({top:0, left:0, behavior:'instant'});
  }

  /* In-page section hashes (#hero) — not SPA paths (#/gallery). */
  function sectionIdFromHash(h){
    if(!h || h === '#' || h.indexOf('#/') === 0) return null;
    var id = decodeURIComponent(h.slice(1).split('?')[0]);
    return id && document.getElementById(id) ? id : null;
  }

  function scrollToId(id, smooth){
    var el = document.getElementById(id);
    if(!el) return;
    el.scrollIntoView({behavior: smooth && !reduced ? 'smooth' : 'auto'});
  }

  function setPages(r){
    if(pageHome) pageHome.hidden = (r === 'gallery');
    if(pageGal) pageGal.hidden = (r !== 'gallery');
    if(nxHome) nxHome.hidden = (r !== 'gallery');
    if(nxGal) nxGal.hidden = (r === 'gallery');
    document.querySelectorAll('[data-route]').forEach(function(a){
      if(a.dataset.route === r) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function applyWarmUI(warm){
    document.body.classList.toggle('warm', warm);
    document.documentElement.classList.toggle('warm', warm);
  }

  function withWipe(fn){
    if(reduced || !wipe){ fn(); return; }
    wipe.classList.add('on');
    setTimeout(function(){
      fn();
      requestAnimationFrame(function(){ wipe.classList.remove('on'); });
    }, 230);
  }

  function route(){
    var h = location.hash || '#/';
    var sec = sectionIdFromHash(h);
    var wasWarm = document.documentElement.classList.contains('warm');

    /* Full load / refresh: never restore mid-page section hashes — land on hero. */
    if(sec && boot){
      applyWarmUI(false);
      setPages('home');
      if(h !== '#/' && h !== '#'){
        try{ history.replaceState(null, '', '#/'); }catch(e){}
      }
      toTop();
      boot = false;
      fromFlip = false;
      document.dispatchEvent(new CustomEvent('routechange', {detail:{route:'home'}}));
      return;
    }

    /* In-session section links — scroll there; never toTop() over them. */
    if(sec){
      function finishSec(){
        applyWarmUI(false);
        setPages('home');
        var navKey = window.navKeyForSection ? window.navKeyForSection(sec) : null;
        if(navKey && window.setNavScope) window.setNavScope(navKey, 1000);
        requestAnimationFrame(function(){
          scrollToId(sec, true);
        });
        document.dispatchEvent(new CustomEvent('routechange', {detail:{route:'home'}}));
      }
      if(!fromFlip && wasWarm) withWipe(finishSec);
      else finishSec();
      fromFlip = false;
      return;
    }

    var r = h.indexOf('#/gallery') === 0 ? 'gallery'
          : h.indexOf('#/history') === 0 ? 'history' : 'home';
    var wantWarm = r === 'gallery';

    function finish(){
      applyWarmUI(wantWarm);
      setPages(r);
      if(r === 'history' && !boot){
        requestAnimationFrame(function(){
          var el = document.getElementById('history') || document.getElementById('about-aeairc');
          if(el) el.scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
        });
      } else {
        /* SPA home / gallery / refresh: land at top */
        toTop();
      }
      boot = false;
      document.dispatchEvent(new CustomEvent('routechange', {detail:{route:r}}));
    }

    if(!fromFlip && wantWarm !== wasWarm) withWipe(finish);
    else finish();
    fromFlip = false;
  }

  /* Refresh / bfcache: force top on home; clear leftover section hashes. */
  function forceHomeTop(){
    var h = location.hash || '#/';
    if(h.indexOf('#/gallery') === 0 || h.indexOf('#/history') === 0) return;
    if(sectionIdFromHash(h)){
      try{ history.replaceState(null, '', '#/'); }catch(e){}
    }
    toTop();
  }
  addEventListener('pageshow', forceHomeTop);
  addEventListener('load', forceHomeTop);

  /* Hero flip chip toggled warmth — keep the hash aligned */
  document.addEventListener('viewflip', function(e){
    var warm = !!(e.detail && e.detail.warm);
    var want = warm ? '#/gallery' : '#/';
    var cur = location.hash || '#/';
    if(cur.indexOf('#/history') === 0 && !warm){
      /* leaving gallery via flip while… history only exists on cool home */
    }
    if(cur !== want){
      fromFlip = true;
      history.replaceState(null, '', want);
    }
    setPages(warm ? 'gallery' : 'home');
    document.dispatchEvent(new CustomEvent('routechange', {detail:{route: warm ? 'gallery' : 'home'}}));
  });

  addEventListener('hashchange', route);

  document.querySelectorAll('a[data-route="home"]').forEach(function(a){
    a.addEventListener('click', function(){
      if((location.hash || '#/') === '#/') scrollTo({top:0, behavior: reduced ? 'auto' : 'smooth'});
    });
  });

  /* Section nav: first click always scrolls (same-hash re-click included). */
  document.querySelectorAll('a[data-nav]').forEach(function(a){
    a.addEventListener('click', function(e){
      var href = a.getAttribute('href') || '';
      if(href.charAt(0) !== '#') return;
      var id = decodeURIComponent(href.slice(1).split('?')[0]);
      if(!id || !document.getElementById(id)) return;
      e.preventDefault();
      var navKey = a.getAttribute('data-nav');
      if(navKey && window.setNavScope) window.setNavScope(navKey, 1000);
      if((location.hash || '') === href){
        applyWarmUI(false);
        setPages('home');
        scrollToId(id, true);
      } else {
        location.hash = href;
      }
    });
  });

  /* data-flip controls should navigate via hash so deep links stay honest */
  document.querySelectorAll('[data-flip]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      var warm = document.documentElement.classList.contains('warm');
      location.hash = warm ? '#/' : '#/gallery';
    });
  });

  route();
})();
