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
    '<p class="sl-navload-label">Loading</p>'
  );

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

  function shouldTransition(url){
    if(!url || url.origin !== location.origin) return false;
    var destKind = kindFromUrl(url);
    if(destKind === '') return false;
    if(hasOwnBoot(destKind) || hasOwnBoot(pageKind())) return false;
    var herePath = location.pathname.replace(/\/+$/, '') || '/';
    var destPath = url.pathname.replace(/\/+$/, '') || '/';
    if(herePath === destPath && url.search === location.search) return false;
    return true;
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
    if(entered || !root.classList.contains('page-tx-from')) return;
    entered = true;
    if(window.__pageTxSafety){
      clearTimeout(window.__pageTxSafety);
      window.__pageTxSafety = 0;
    }
    try{ sessionStorage.removeItem(KEY); }catch(e){}
    var overlay = ensureOverlay();
    overlay.classList.add('is-on');
    overlay.classList.remove('is-out');
    root.classList.remove('page-tx-leave');
    function fadeOut(){
      overlay.classList.add('is-out');
      root.classList.add('page-tx-in');
      try{ document.dispatchEvent(new CustomEvent('sl-page-tx-in')); }catch(e){}
      setTimeout(function(){
        overlay.classList.remove('is-on', 'is-out');
        root.classList.remove('page-tx-from', 'page-tx-in');
      }, reduced ? 0 : ENTER_FADE_MS);
    }
    if(reduced){
      fadeOut();
      return;
    }
    setTimeout(fadeOut, ENTER_HOLD_MS);
  }

  function leaveThen(go, destKind){
    if(leaving) return;
    leaving = true;
    if(hasOwnBoot(pageKind()) || hasOwnBoot(destKind)){
      try{ sessionStorage.removeItem(KEY); }catch(e){}
      if(destKind === 'home'){
        try{ sessionStorage.setItem('sl_home_ready', '1'); }catch(e){}
      }
      go();
      return;
    }
    try{ sessionStorage.setItem(KEY, destKind); }catch(e){}
    if(destKind === 'home'){
      try{ sessionStorage.setItem('sl_home_ready', '1'); }catch(e){}
    }
    if(reduced){
      go();
      return;
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
    overlay.classList.remove('is-out');
    void overlay.offsetWidth;
    overlay.classList.add('is-on');
    root.classList.add('page-tx-leave');
    setTimeout(finish, LEAVE_MS);
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
      if(back.id === 'scanBackHome' && document.querySelector('.scan-shell.is-result')){
        return;
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
    e.preventDefault();
    leaveThen(function(){ location.href = url.href; }, kindFromUrl(url));
  }, true);

  addEventListener('pageshow', function(e){
    var root = document.documentElement;
    if(e.persisted) entered = false;
    if(e.persisted && !hasOwnBoot(pageKind()) && (root.classList.contains('page-tx-leave') || root.classList.contains('page-tx-from'))){
      var flag = '';
      try{ flag = sessionStorage.getItem(KEY) || ''; }catch(err){}
      if(flag === pageKind() || root.classList.contains('page-tx-leave')){
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
