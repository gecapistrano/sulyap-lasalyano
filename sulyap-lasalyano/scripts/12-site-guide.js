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
    if(typeof window.pmLookup === 'function'){
      var v = window.pmLookup(key);
      if(v !== undefined) return v;
    }
    var L = window.pmLang ? window.pmLang() : 'en';
    var D = window.T && (window.T[L] || window.T.en);
    return (D && D[key]) || (window.T && window.T.en && window.T.en[key]) || fallback;
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

  /* Answers only from home-page facts (cool view copy). Unknown → limited-info reply. */
  var HOME_FACTS = [
    {
      id: 'hello',
      keys: [
        'hi','hello','hey','howdy','yo','sup','hiya','hiyaa',
        'good morning','good afternoon','good evening','good day',
        'greetings','salutations','hola','hallo','helo','helu',
        'bonjour','salut','bonsoir','buenas','buen dia','buenas dias',
        '안녕하세요','안녕','こんにちは','こんばんは','你好','您好',
        'kumusta','musta','magandang umaga','magandang hapon','magandang gabi',
        "what's up",'whats up','wassup','hey there','hi there','hello there'
      ],
      reply: 'guide.reply.hello',
      /* Greetings — match whole-ish phrases, not substrings of longer questions */
      whole: true
    },
    {
      id: 'ack',
      keys: [
        'ok','okay','okie','okey','alright','all right',
        'got it','gotcha','cool','nice','sure',
        'yep','yeah','yes','yup','noted','sige','oo','kk','k',
        'daccord','d\'accord','vale','de acuerdo','oui','si','sí',
        '알겠어요','네','はい','わかった','好的','嗯'
      ],
      reply: 'guide.reply.ack',
      whole: true
    },
    {
      id: 'thanks',
      keys: [
        'thanks','thank you','thank u','ty','thx',
        'salamat','maraming salamat','thanks pat','thank you pat',
        'gracias','merci','감사합니다','ありがとう','谢谢','多谢'
      ],
      reply: 'guide.reply.thanks',
      whole: true
    },
    {
      id: 'bye',
      keys: [
        'bye','goodbye','good bye','see you','see ya','cya',
        'farewell','paalam','babay','bye bye','bye pat',
        'adios','adiós','au revoir','hasta luego','안녕히','さようなら','再见'
      ],
      reply: 'guide.reply.bye',
      whole: true
    },
    {
      id: 'importance',
      keys: ['important','importance','legacy','heritage','lasallian','memorabilia','collection','preserve','why keep','ano ang koleksiyon','mahalaga','importante','なぜ','왜','为什么','重要'],
      reply: 'guide.reply.importance'
    },
    {
      id: 'visit',
      keys: ['visit','visitor','who can','welcome','student','faculty','staff','onsite','museum','bumisita','sino ang maaaring','visitar','visiter','방문','参观','訪れる'],
      reply: 'guide.reply.visit'
    },
    {
      id: 'maintain',
      keys: ['maintain','keeps','cared','housed','where','aea-irc','aeairc','aklatang','library','location','nangangalaga','nasaan','mantener','entretenir','관리','维护','どこ'],
      reply: 'guide.reply.maintain'
    },
    {
      id: 'what',
      keys: ['what is sulyap','sulyap lasalyano','what is this','ano ang sulyap','augmented reality','ar system','mobile browser','nothing to download','qué es','qu\'est-ce','무엇','什么是','とは'],
      reply: 'guide.reply.what'
    },
    {
      id: 'why',
      keys: ['why was it created','why create','why built','sdg','11.4','passive gallery','low visitation','bakit ginawa','bakit nilikha','por qué','pourquoi','왜','为什么','なぜ'],
      reply: 'guide.reply.why'
    },
    {
      id: 'scan',
      keys: ['live scan','scan','camera','yolo','yolov8','3d model','recognize','recognition','i-scan','artifact','escanear','scanner','스캔','扫描','スキャン'],
      reply: 'guide.reply.scan'
    },
    {
      id: 'kg',
      keys: ['knowledge graph','graph','connections','pan','zoom','circles','lines','related','grafo','graphe','그래프','图谱','グラフ'],
      reply: 'guide.reply.kg'
    },
    {
      id: 'browse',
      keys: ['browse','without camera','prefer not','rotatable','zoomable','3d','president','explorar','parcourir','둘러보기','浏览','閲覧'],
      reply: 'guide.reply.browse'
    },
    {
      id: 'lang',
      keys: ['language','multilingual','filipino','spanish','french','chinese','korean','japanese','wika','idioma','langue','언어','语言','言語'],
      reply: 'guide.reply.lang'
    },
    {
      id: 'aeairc',
      keys: ['aguinaldo shrine','br. andrew','andrew gonzales','1992','april 30','kawit','facade','classroom-sized','1977'],
      reply: 'guide.reply.aeairc'
    },
    {
      id: 'team',
      keys: ['who made','who built','thesis','lagajino','ricafrente','capistrano','herradura','developer','creator','team','adviser'],
      reply: 'guide.reply.team'
    },
    {
      id: 'presidents',
      keys: ['br. inigo','br. andrew','br. armin','br. donato','br. gus','br. mawel','br. rolly','br. sockie','quebengco','former presidents','pangulo'],
      reply: 'guide.reply.presidents'
    }
  ];

  var TOPIC_TO_ID = {
    importance: 'importance',
    visit: 'visit',
    maintain: 'maintain'
  };

  function limitedReply(){
    return t('guide.reply.limited',
      'Hmmm.. I might be able to respond to your input soon. For now, there\'s not much I can say about that. But don\'t worry! You can learn more by browsing deeper into the website and scanning more artifacts. Have fun exploring! 💚');
  }

  function norm(s){
    return String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[!?.,]+$/g, '').replace(/\s+/g, ' ').trim();
  }

  function isWholePhrase(q, keys){
    /* Whole-phrase intents: "hi", "okay pat" — not "ok how do I scan" */
    var stripped = String(q || '').replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if(!stripped || stripped.length > 40) return false;
    var j, k, tail;
    for(j = 0; j < keys.length; j++){
      k = keys[j];
      if(stripped === k) return true;
      /* Short keys (<4): exact only so "ok" / "k" / "yes" don't hijack;
         length ≥4 (e.g. "okay") may allow a short name tail */
      if(k.length < 4) continue;
      if(stripped.indexOf(k) === 0){
        tail = stripped.slice(k.length).trim();
        /* Allow a short name/tail: "hello pat", "okay pat" */
        if(tail.length <= 12 && !/[?]/.test(tail)) return true;
      }
    }
    return false;
  }

  function scoreFact(q, fact){
    var score = 0;
    var i, k;
    if(fact.whole){
      if(isWholePhrase(q, fact.keys)) return 10;
      return 0;
    }
    for(i = 0; i < fact.keys.length; i++){
      k = fact.keys[i];
      if(q.indexOf(k) !== -1) score += (k.length > 8 ? 3 : 2);
    }
    return score;
  }

  function answerFromHome(text, topic){
    var id = topic && TOPIC_TO_ID[topic];
    var fact, i, best, bestScore, q, sc;

    if(id){
      for(i = 0; i < HOME_FACTS.length; i++){
        if(HOME_FACTS[i].id === id){
          return t(HOME_FACTS[i].reply, limitedReply());
        }
      }
    }

    q = norm(text);
    if(!q) return limitedReply();

    best = null;
    bestScore = 0;
    for(i = 0; i < HOME_FACTS.length; i++){
      sc = scoreFact(q, HOME_FACTS[i]);
      if(sc > bestScore){
        bestScore = sc;
        best = HOME_FACTS[i];
      }
    }

    /* Need a clear hit so random chat doesn't invent answers */
    if(best && bestScore >= 2){
      return t(best.reply, limitedReply());
    }
    return limitedReply();
  }

  function handleSend(text, topic){
    var q = (text || '').replace(/\s+/g, ' ').trim();
    if(!q) return;
    appendBubble('user', q);
    appendBubble('bot', answerFromHome(q, topic));
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

  /* Home return / bfcache: replay FAB hop with plaque enter. */
  function replayEntrance(){
    if(!fab) return;
    entered = false;
    fab.classList.remove('is-ready', 'is-entering');
    /* Retrigger enter keyframes after clearing ready/entering. */
    void fab.offsetWidth;
    whenFabVisible(playEntrance);
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
  /* Skip-splash / bfcache return: 01-hero playHomeEnter calls replayEntrance. */
  if(!window.__homeEnter){
    whenFabVisible(playEntrance);
  }

  window.pmSiteGuide = {
    open: openPanel,
    close: function(){ closePanel(true); },
    toggle: toggle,
    isOpen: function(){ return open; },
    replayEntrance: replayEntrance
  };
})();
