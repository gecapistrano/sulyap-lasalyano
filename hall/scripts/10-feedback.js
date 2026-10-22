/* Toasts, copyText, loading rail, offline notice. */
(function(){
  var host = document.getElementById('toasts');
  var LIFE = 3000, MAX = 3;

  window.toast = function(kind, title, detail){
    if(!host) return;
    while(host.children.length >= MAX) drop(host.firstElementChild);
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    var dot = document.createElement('i'); dot.className = 'toast-dot';
    var body = document.createElement('div');
    var b = document.createElement('b'); b.textContent = title;
    body.appendChild(b);
    if(detail){
      var d = document.createElement('span'); d.textContent = detail;
      body.appendChild(d);
    }
    t.appendChild(dot); t.appendChild(body);
    t.addEventListener('click', function(){ drop(t); });
    host.appendChild(t);
    setTimeout(function(){ drop(t); }, LIFE);
    return t;
  };
  function drop(t){
    if(!t || t.dataset.going) return;
    t.dataset.going = '1';
    t.classList.add('out');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 260);
  }

  window.copyText = function(text, done){
    done = done || function(){};
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text)
        .then(function(){ done(true); })
        .catch(function(){ done(legacy(text)); });
      return;
    }
    done(legacy(text));
  };
  function legacy(text){
    try{
      var a = document.createElement('textarea');
      a.value = text;
      a.setAttribute('readonly','');
      a.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(a);
      a.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(a);
      return !!ok;
    }catch(e){ return false; }
  }
})();

(function(){
  var fill = document.getElementById('pre-fill');
  var meta = document.getElementById('pre-meta');
  if(!fill) return;
  var pre = window.__pre || {t0:Date.now(), min:0};
  var shown = 0, live = true;

  function land(){
    live = false;
    fill.style.setProperty('--lp', '1');
    if(meta){
      var L = window.pmLang ? window.pmLang() : 'en';
      meta.textContent = (window.T && window.T[L] && window.T[L]['pre.ready']) || 'Ready';
    }
  }
  function frame(){
    if(!live) return;
    var floor = pre.min > 0 ? (Date.now() - pre.t0) / pre.min : 1;
    shown = Math.max(shown, Math.min(floor, 0.985));
    fill.style.setProperty('--lp', shown.toFixed(3));
    if(meta) meta.textContent = Math.round(shown * 100) + '%';
    requestAnimationFrame(frame);
  }
  document.addEventListener('preready', land);
  if(window.__preDone) land();
  else requestAnimationFrame(frame);
})();

(function(){
  function t(key, fallback){
    var L = window.pmLang ? window.pmLang() : 'en';
    return (window.T && window.T[L] && window.T[L][key]) || fallback;
  }
  addEventListener('offline', function(){
    if(window.toast) window.toast('err', t('toast.offline','You are offline'), t('toast.offline.detail',''));
  });
  addEventListener('online', function(){
    if(window.toast) window.toast('ok', t('toast.online','Back online'), t('toast.online.detail',''));
  });
})();
