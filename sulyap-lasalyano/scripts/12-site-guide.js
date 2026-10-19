/* Floating site guide — Pat Riotik (frontend stub, no AI / API). */
(function(){
  var root = document.getElementById('siteGuide');
  if(!root) return;

  var panel = document.getElementById('sgPanel');
  var fab = document.getElementById('sgFab');
  var closeBtn = document.getElementById('sgClose');
  var form = document.getElementById('sgForm');
  var input = document.getElementById('sgInput');
  var messages = document.getElementById('sgMessages');
  var chips = root.querySelectorAll('[data-sg-chip]');

  var open = false;
  var closing = false;
  var lastFocus = null;
  var entered = false;
  var FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

  function t(key, fallback){
    var L = window.pmLang ? window.pmLang() : 'en';
    var D = window.T && (window.T[L] || window.T.en);
    return (D && D[key]) || fallback;
  }

  function reduceMotion(){
    return document.documentElement.classList.contains('reduce')
      || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function focusables(){
    if(!panel) return [];
    return Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE))
      .filter(function(el){ return el.offsetParent !== null || el === input; });
  }

  function setExpanded(on){
    if(fab) fab.setAttribute('aria-expanded', on ? 'true' : 'false');
    if(fab) fab.setAttribute('aria-label', on
      ? t('guide.fab.close', 'Close Pat · site guide')
      : t('guide.fab.open', 'Open Pat · site guide'));
    if(root) root.classList.toggle('is-open', !!on);
  }

  function appendBubble(kind, text){
    if(!messages || !text) return;
    var b = document.createElement('div');
    b.className = 'sg-bubble sg-bubble--' + (kind === 'user' ? 'user' : 'bot');
    b.textContent = text;
    messages.appendChild(b);
    messages.scrollTop = messages.scrollHeight;
    return b;
  }

  function stubReply(topic){
    var map = {
      importance: 'guide.reply.importance',
      visit: 'guide.reply.visit',
      maintain: 'guide.reply.maintain'
    };
    var key = map[topic] || 'guide.reply.soon';
    return t(key, t('guide.reply.soon',
      'Thanks for asking. The live guide is offline for now — coming soon. Meanwhile, use the menu to explore the collection.'));
  }

  function handleSend(text, topic){
    var q = (text || '').replace(/\s+/g, ' ').trim();
    if(!q) return;
    appendBubble('user', q);
    appendBubble('bot', stubReply(topic));
    if(input) input.value = '';
  }

  function openPanel(){
    if(open || closing || !panel) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    panel.classList.remove('is-closing');
    open = true;
    setExpanded(true);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(function(){
      if(input) input.focus();
      else if(closeBtn) closeBtn.focus();
    });
  }

  function closePanel(immediate){
    if(!open || !panel) return;
    open = false;
    setExpanded(false);
    document.removeEventListener('keydown', onKey, true);

    function finish(){
      panel.hidden = true;
      panel.classList.remove('is-closing');
      closing = false;
      if(lastFocus && typeof lastFocus.focus === 'function'){
        try{ lastFocus.focus(); }catch(e){}
      }else if(fab) fab.focus();
      lastFocus = null;
    }

    if(immediate || reduceMotion()){
      finish();
      return;
    }
    closing = true;
    panel.classList.add('is-closing');
    setTimeout(finish, 200);
  }

  function toggle(){
    if(open) closePanel();
    else openPanel();
  }

  function onKey(e){
    if(!open) return;
    if(e.key === 'Escape'){
      e.preventDefault();
      closePanel();
      return;
    }
    if(e.key !== 'Tab') return;
    var list = focusables();
    if(!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    }else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    }
  }

  /* Entrance hop after splash hides the FAB (pre-gone), or immediately if already visible */
  function markReady(){
    if(!fab || entered) return;
    entered = true;
    fab.classList.remove('is-entering');
    fab.classList.add('is-ready');
  }

  function playEntrance(){
    if(!fab || entered) return;
    if(reduceMotion()){
      markReady();
      return;
    }
    fab.classList.add('is-entering');
    var finished = false;
    function end(){
      if(finished) return;
      finished = true;
      fab.removeEventListener('animationend', onAnimEnd);
      markReady();
    }
    function onAnimEnd(e){
      if(e.target !== fab) return;
      if(e.animationName && e.animationName.indexOf('sg-fab-enter') === -1) return;
      end();
    }
    fab.addEventListener('animationend', onAnimEnd);
    setTimeout(end, 950); /* safety if animationend missed */
  }

  function whenFabVisible(cb){
    var html = document.documentElement;
    /* Without .js splash gate, FAB is already visible */
    if(!html.classList.contains('js') || html.classList.contains('pre-gone')){
      requestAnimationFrame(function(){ requestAnimationFrame(cb); });
      return;
    }
    var mo = new MutationObserver(function(){
      if(html.classList.contains('pre-gone')){
        mo.disconnect();
        requestAnimationFrame(function(){ requestAnimationFrame(cb); });
      }
    });
    mo.observe(html, { attributes:true, attributeFilter:['class'] });
  }

  if(fab) fab.addEventListener('click', toggle);
  if(closeBtn) closeBtn.addEventListener('click', function(){ closePanel(); });

  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      handleSend(input && input.value, null);
    });
  }

  chips.forEach(function(chip){
    chip.addEventListener('click', function(){
      var topic = chip.getAttribute('data-sg-chip') || '';
      var label = chip.textContent.replace(/\s+/g, ' ').trim();
      handleSend(label, topic);
    });
  });

  function syncPlaceholder(){
    if(input){
      input.setAttribute('placeholder', t('guide.placeholder', 'Ask about the collection…'));
    }
  }

  document.addEventListener('langchange', function(){
    setExpanded(open);
    syncPlaceholder();
  });

  setExpanded(false);
  syncPlaceholder();
  whenFabVisible(playEntrance);

  window.pmSiteGuide = {
    open: openPanel,
    close: function(){ closePanel(true); },
    toggle: toggle,
    isOpen: function(){ return open; }
  };
})();
