/* Black-fade loading screen between hall pages (home, presidents, scan, KG). */
(function(){
  var KEY = 'sl_page_tx';
  var LEAVE_MS = 320;
  var ENTER_HOLD_MS = 480;
  var ENTER_FADE_MS = 400;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var leaving = false;
  var entered = false;
  var MARKUP = (
    '<img class="sl-navload-icon" src="/icon-192.png" alt="" width="192" height="192" decoding="async">' +
    '<p class="sl-navload-brand">Sulyap Lasalyano</p>' +
    '<p class="sl-navload-label">Loading</p>' +
    '<div class="sl-loadbar" role="progressbar" aria-hidden="true"><i class="sl-loadbar-fill"></i></div>'
  );

  function finishLoadbar(scope){
    var root = scope && scope.querySelectorAll ? scope : document;
    var bars = root.querySelectorAll('.sl-loadbar');
    var i, bar, fill, transform;
    for(i = 0; i < bars.length; i++){
      bar = bars[i];
      if(bar.classList.contains('is-complete')) continue;
      fill = bar.querySelector('.sl-loadbar-fill');
      if(!fill) continue;
      transform = getComputedStyle(fill).transform;
      fill.style.animation = 'none';
      fill.style.transform = (!transform || transform === 'none') ? 'scaleX(.9)' : transform;
      void fill.offsetWidth;
      bar.classList.add('is-complete');
      fill.style.transition = reduced ? 'none' : 'transform .36s cubic-bezier(.32,.72,0,1)';
      fill.style.transform = 'scaleX(1)';
    }
  }
  window.slFinishLoadbar = finishLoadbar;

  function resetLoadbar(scope){
    var root = scope && scope.querySelectorAll ? scope : document;
    var bars = root.querySelectorAll('.sl-loadbar');
    var i, bar, fill;
    for(i = 0; i < bars.length; i++){
      bar = bars[i];
      fill = bar.querySelector('.sl-loadbar-fill');
      bar.classList.remove('is-complete');
      if(!fill) continue;
      fill.style.animation = 'none';
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(.04)';
      void fill.offsetWidth;
      fill.style.animation = '';
      fill.style.transition = '';
      fill.style.transform = '';
    }
  }

  function pageKind(path){
    var value = path || location.pathname;
    if(/\/scan(\.html)?$/.test(value)) return 'scan';
    if(/\/knowledge-graph(\.html)?$/.test(value)) return 'kg';
    if(/\/president(\.html)?$/.test(value)) return 'president';
    return 'home';
  }

  function kindFromUrl(url){
    var path = url.pathname.replace(/\/+$/, '') || '/';
    if(/\/scan(\.html)?$/.test(path)) return 'scan';
    if(/\/knowledge-graph(\.html)?$/.test(path)) return 'kg';
    if(/\/president(\.html)?$/.test(path)) return 'president';
    if(path === '/' || path === '' || /\/index(\.html)?$/.test(path)) return 'home';
    return '';
  }

  function hasOwnBoot(kind){
    /* Live Scan and Knowledge Graph already show their own boot screens. */
    return kind === 'scan' || kind === 'kg';
  }

  function destHasOwnBoot(kind){
    /* President pages also boot themselves — skip the home leave overlay
       so the visitor only sees the destination loading bar. */
    return hasOwnBoot(kind) || kind === 'president';
  }

  function shouldTransition(url){
    if(!url || url.origin !== location.origin) return false;
    var destKind = kindFromUrl(url);
    if(destKind === '') return false;
    if(destHasOwnBoot(destKind) || hasOwnBoot(pageKind())) return false;
    var herePath = location.pathname.replace(/\/+$/, '') || '/';
    var destPath = url.pathname.replace(/\/+$/, '') || '/';
    if(herePath === destPath && url.search === location.search) return false;
    return true;
  }

  function setNavloadLabel(overlay, mode){
    var el = overlay && overlay.querySelector('.sl-navload-label');
    var text, key, lookup;
    if(!el) return;
    if(mode === 'president'){
      key = 'pres.loading';
      text = 'Loading president';
      if(typeof window.pmLookup === 'function'){
        lookup = window.pmLookup(key);
        if(lookup) text = lookup;
      }
      el.setAttribute('data-i', key);
    } else {
      text = 'Loading';
      el.removeAttribute('data-i');
    }
    el.textContent = text;
  }

  function ensureOverlay(){
    var el = document.getElementById('slNavLoad');
    if(el) return el;
    el = document.createElement('div');
    el.id = 'slNavLoad';
    el.className = 'sl-navload';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MARKUP;
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function clearOverlay(){
    var root = document.documentElement;
    root.classList.remove('page-tx-from', 'page-tx-in', 'page-tx-leave');
    var overlay = document.getElementById('slNavLoad');
    if(overlay) overlay.classList.remove('is-on', 'is-out');
    try{ sessionStorage.removeItem(KEY); }catch(e){}
  }

  function fadeOverlayOut(overlay){
    var root = document.documentElement;
    var layer = overlay || document.getElementById('slNavLoad');
    finishLoadbar(layer);
    if(layer) layer.classList.add('is-out');
    root.classList.add('page-tx-in');
    root.classList.remove('pres-booting', 'page-tx-from', 'page-tx-leave');
    if(document.body) document.body.classList.remove('is-booting');
    try{ document.dispatchEvent(new CustomEvent('sl-page-tx-in')); }catch(e){}
    setTimeout(function(){
      if(layer) layer.classList.remove('is-on', 'is-out');
      root.classList.remove('page-tx-in');
    }, reduced ? 0 : ENTER_FADE_MS);
  }

  function holdPresidentBoot(){
    var root = document.documentElement;
    entered = true;
    if(window.__pageTxSafety){
      clearTimeout(window.__pageTxSafety);
      window.__pageTxSafety = 0;
    }
    try{ sessionStorage.removeItem(KEY); }catch(e){}
    root.classList.add('pres-booting');
    var overlay = ensureOverlay();
    setNavloadLabel(overlay, 'president');
    overlay.classList.add('is-on');
    overlay.classList.remove('is-out');
    root.classList.remove('page-tx-leave');
  }

  function playEnter(){
    var root = document.documentElement;
    if(hasOwnBoot(pageKind())){
      entered = true;
      if(window.__pageTxSafety){
        clearTimeout(window.__pageTxSafety);
        window.__pageTxSafety = 0;
      }
      clearOverlay();
      return;
    }
    if(pageKind() === 'president'){
      if(window.__presReady){
        entered = true;
        window.slRevealPage();
        return;
      }
      holdPresidentBoot();
      return;
    }
    if(entered || !root.classList.contains('page-tx-from')) return;
    entered = true;
    if(window.__pageTxSafety){
      clearTimeout(window.__pageTxSafety);
      window.__pageTxSafety = 0;
    }
    try{ sessionStorage.removeItem(KEY); }catch(e){}
    var overlay = ensureOverlay();
    setNavloadLabel(overlay, 'generic');
    resetLoadbar(overlay);
    overlay.classList.add('is-on');
    overlay.classList.remove('is-out');
    root.classList.remove('page-tx-leave');
    function fadeOut(){
      fadeOverlayOut(overlay);
    }
    if(reduced){
      fadeOut();
      return;
    }
    setTimeout(fadeOut, ENTER_HOLD_MS);
  }

  var presRevealed = false;
  window.slRevealPage = function(){
    if(pageKind() !== 'president') return;
    if(presRevealed){
      var root = document.documentElement;
      root.classList.remove('pres-booting', 'page-tx-from', 'page-tx-leave', 'page-tx-in');
      if(document.body) document.body.classList.remove('is-booting');
      var overlay = document.getElementById('slNavLoad');
      if(overlay) overlay.classList.remove('is-on', 'is-out');
      return;
    }
    presRevealed = true;
    fadeOverlayOut(document.getElementById('slNavLoad'));
  };
  document.addEventListener('sl-pres-ready', function(){
    window.__presReady = true;
    window.slRevealPage();
  });
  if(window.__presReady) window.slRevealPage();

  function leaveThen(go, destKind){
    if(leaving) return false;
    leaving = true;
    if(hasOwnBoot(pageKind()) || destHasOwnBoot(destKind)){
      try{ sessionStorage.removeItem(KEY); }catch(e){}
      if(destKind === 'home'){
        try{ sessionStorage.setItem('sl_home_ready', '1'); }catch(e){}
      }
      go();
      return true;
    }
    /* Home already skips its splash via sl_home_ready. Do not also replay
       the shared overlay there — the leave screen is the one loading beat. */
    if(pageKind() === 'president' && destKind === 'home'){
      try{ sessionStorage.removeItem(KEY); }catch(e){}
    } else {
      try{ sessionStorage.setItem(KEY, destKind); }catch(e){}
    }
    if(destKind === 'home'){
      try{ sessionStorage.setItem('sl_home_ready', '1'); }catch(e){}
    }
    if(reduced){
      go();
      return true;
    }
    var root = document.documentElement;
    if(pageKind() === 'president') root.classList.add('pres-leaving');
    var overlay = ensureOverlay();
    var done = false;
    function finish(){
      if(done) return;
      done = true;
      go();
    }
    setNavloadLabel(overlay, 'generic');
    overlay.classList.remove('is-out');
    resetLoadbar(overlay);
    void overlay.offsetWidth;
    overlay.classList.add('is-on');
    root.classList.add('page-tx-leave');
    setTimeout(finish, LEAVE_MS);
    return true;
  }

  function goHome(){
    var fallback = hasOwnBoot(pageKind()) ? 'index.html#hero' : 'index.html';
    var useBack = false;
    try{
      if(window.history.length > 1 && document.referrer){
        useBack = new URL(document.referrer).origin === location.origin;
      }
    }catch(e){}
    leaveThen(function(){
      if(useBack) history.back();
      else location.href = fallback;
    }, 'home');
  }

  window.slPageLeave = leaveThen;

  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button !== 0) return;
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var back = e.target.closest && e.target.closest('#scanBackHome, #kgBack, #presBack');
    if(back){
      /* Item result view: header X closes the 3D stage, not the scan page. */
      if(back.id === 'scanBackHome' && document.querySelector('.scan-shell.is-result, .scan-shell.is-leaving-result')){
        return;
      }
      /* KG memorabilia sheet: header X closes the overlay, not the graph. */
      if(back.id === 'kgBack'){
        var kgOverlay = document.getElementById('kgItemOverlay');
        if(document.body.classList.contains('is-item-open')
          || document.body.classList.contains('is-item-leaving')
          || (kgOverlay && !kgOverlay.hidden)){
          e.preventDefault();
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      goHome();
      return;
    }
    var link = e.target.closest && e.target.closest('a[href]');
    if(!link || (link.target && link.target !== '_self')) return;
    if(link.hasAttribute('download')) return;
    var url;
    try{ url = new URL(link.href, location.href); }catch(err){ return; }
    if(!shouldTransition(url)) return;
    /* A bfcache restore can leave this lock on. Do not swallow the click. */
    if(leaving) return;
    e.preventDefault();
    leaveThen(function(){ location.href = url.href; }, kindFromUrl(url));
  }, true);

  addEventListener('pageshow', function(e){
    var root = document.documentElement;
    leaving = false;
    if(e.persisted) entered = false;
    if(e.persisted && !hasOwnBoot(pageKind())){
      var flag = '';
      try{ flag = sessionStorage.getItem(KEY) || ''; }catch(err){}
      if(flag === pageKind() || root.classList.contains('page-tx-leave') || root.classList.contains('page-tx-from')){
        root.classList.remove('page-tx-leave', 'page-tx-in');
        root.classList.add('page-tx-from');
      }
    }
    playEnter();
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      ensureOverlay();
      playEnter();
    });
  }else{
    ensureOverlay();
    playEnter();
  }
})();
