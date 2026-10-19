/* EN/FIL dictionary, data-i / data-i-label, [bracket] placeholder styling. */
(function(){
  var store = {
    get: function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set: function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  };

  window.T = {
    en:{
      "skip":"Skip to content",
      "school":"De La Salle University Philippines",
      "school.short":"DLSU Dasmariñas",
      "nav.home":"Home","nav.history":"History","nav.gallery":"DLSU Presidents’ Memorabilia","nav.library":"AEA-IRC at DLSU-D","nav.soon":"Sulyap Lasalyano","nav.menu":"Menu","nav.close":"Close menu",
      "lang":"Language",
      "hero.title":"Presidents’ Memorabilia",
      "hero.title.line1":"Presidents’","hero.title.line2":"Memorabilia",
      "hero.alt":"Campus Collection",
      "hero.powered":"Powered by","hero.lead":"A quiet archive of medals, portraits, and ceremonial pieces from each presidency.",
      "flip.label":"About the system","flip.label.warm":"Back to home",
      "flip.switch":"Switch view",
      "cta.explore":"Browse the collection","cta.history":"View history",
      "cta.scan":"Scan artifacts now!","cta.kg":"View Knowledge Graph ->","cta.hint":"Are you onsite at the museum?",
      "ag.title":"About",
      "ag.copy":"The Presidents’ Memorabilia is a collection housed at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas. It preserves artifacts such as commemorative trophies, plaques, and travel souvenirs that embody the Lasallian values and leadership of the university’s former presidents. As a historical link between the DLSU-D community’s past and its future, the collection supports the university’s identity as a Heritage and Cultural Center.",
      "aea.title":"About Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.title.lead":"About",
      "aea.title.rest":"Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.info":"About Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.info.btn":"Info","aea.info.close":"Close","aea.info.hint":"click here",
      "aea.info.body":"The Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) is a replica of the Aguinaldo Shrine in Kawit, the home of the first Philippine President, General Emilio Aguinaldo, and its facade is a larger version of the shrine. The building was the brainchild of Br. Andrew Gonzales and was inaugurated on April 30, 1992. This makes the structure itself a piece of heritage, a fitting home for the Presidents’ Memorabilia.",
      "aea.info.body2":"It began in 1977 as a classroom-sized library with two staff members, when General Emilio Aguinaldo College Dasmariñas Campus was first established. Its growth into a landmark that forms part of a museum complex envisioned as a cultural zone reflects DLSU-D’s identity as a Heritage and Cultural Center.",
      "scroll.more":"Scroll","col.title":"Objects that carry the university’s story",
      "col.p1":"[Collection description: two or three sentences about what the collection holds, who it honors, and how the pieces were gathered.]",
      "col.p2":"Browse medals, portraits, ceremonial pieces, and documents from each presidency. Every item has a short note on where it came from and why it was kept.",
      "col.link":"Browse the museum",
      "bld.name":"[Building or person name]",
      "about.title":"About the developer",
      "about.body":"[Developer bio: who built this site, what the project set out to do, and how to get in touch.]",
      "about.photo":"Photo of the developer (placeholder)",
      "gal.title":"Museum","gal.intro":"Four pieces from the collection. Select one to see it larger.",
      "foot.enjoy":"Enjoy your visit!","foot.top":"Back to top",
      "foot.copy":"© 2026 De La Salle University–Dasmariñas",
      "lb.close":"Close","lb.prev":"Previous item","lb.next":"Next item",
      "nx.kick":"What’s next","nx.gallery":"Open the museum",
      "nx.gallery.p":"Four pieces from the collection: medals, portraits, and ceremonial objects.",
      "nx.home":"Return home","nx.home.p":"Back to the collection story and campus stage.",
      "nx.meta":"Hash route · deep-linkable",
      "nx.edu.kicker":"What is",
      "nx.edu.title":"Sulyap Lasalyano",
      "nx.edu.mark":"?",
      "nx.edu.cats.by":"By",
      "nx.edu.intro.p1":"Sulyap Lasalyano is a web-based augmented reality system that lets you explore the Presidents’ Memorabilia at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas.",
      "nx.edu.intro.p2":"Point your camera at an artifact and it identifies the item and shows its story on your screen. There is nothing to download or install. Just open it in your mobile browser.",
      "nx.edu.intro.why":"Why was it created?",
      "nx.edu.intro.p3":"The Presidents’ Memorabilia preserves the legacy and Lasallian values of DLSU-D’s former presidents, but traditional displays can only show so much. Static displays and printed labels struggle to hold the attention of a generation raised on digital and interactive experiences, which has led to low visitation and a fading awareness of the university’s own heritage.",
      "nx.edu.intro.p4":"Sulyap Lasalyano was built to close that gap. It turns a passive gallery visit into an active, immersive learning experience, helping students, faculty, staff, and visitors discover, understand, and appreciate DLSU-D’s institutional heritage. In support of UN Sustainable Development Goal 11.4, it also uses technology to protect and promote cultural heritage.",
      "nx.edu.features":"Core features",
      "nx.edu.scan.name":"Live Scan",
      "nx.edu.scan.body":"Live Scan is the heart of the system. It uses your phone’s camera and a custom-trained YOLOv8 object detection model, trained on images of the memorabilia, to recognize artifacts in real time.",
      "nx.edu.scan.s1":"Open Live Scan from the home page and allow camera access.",
      "nx.edu.scan.s2":"Point your camera at a memorabilia item inside the gallery.",
      "nx.edu.scan.s3":"Once the system is confident about the item, a 3D model of the artifact appears on your screen.",
      "nx.edu.scan.s4":"An information sheet slides up showing the artifact’s name, year, associated president, and description. Close it to scan another item.",
      "nx.edu.scan.tip":"If an item isn’t recognized, try a different angle. A dark mode is also available for dimly lit areas.",
      "nx.edu.scan.cta":"Try",
      "nx.edu.kg.name":"Knowledge Graph",
      "nx.edu.kg.body":"The Knowledge Graph shows how the collection fits together. Instead of viewing each artifact in isolation, you can see the connections between the AEA-IRC, DLSU-D, the university presidents, the years, and the artifacts. Circles represent each of these, and lines show which are related.",
      "nx.edu.kg.how":"To use it, open View Knowledge Graph from the home page, drag to pan around the graph, and use the plus and minus buttons to zoom. It helps you see the bigger story behind each item, such as which artifacts belong to which president and era.",
      "nx.edu.kg.cta":"View",
      "nx.edu.also.title":"Also in the system",
      "nx.edu.also.browse.label":"Browse:",
      "nx.edu.also.browse":"Prefer not to use the camera? Pick a DLSU-D president, view their memorabilia, and open any artifact to see a rotatable, zoomable 3D model with its details.",
      "nx.edu.also.lang.label":"Multilingual support:",
      "nx.edu.also.lang":"Read the content in English, Filipino, Spanish, French, Chinese, Korean, or Japanese.",
      "nx.edu.credit":"Sulyap Lasalyano is a thesis project by Lagajino, Ricafrente, and Capistrano, Bachelor of Science in Computer Science, Specializing in Intelligent Systems, under adviser Tita R. Herradura.",
      "skip.next":"Next section",
      "menu.title":"Navigate",
      "toast.lang":"Language","toast.lang.detail":"Switched to English",
      "toast.offline":"You are offline","toast.offline.detail":"Some links may not work until you reconnect.",
      "toast.online":"Back online","toast.online.detail":"Connection restored.",
      "img.fail":"Image unavailable",
      "nojs":"JavaScript is off. You can still read the pages via the links below.",
      "pre.name":"President’s Memorabilia","pre.loading":"Loading…","pre.ready":"Ready",
      "404.title":"Route not found","404.body":"This path is not part of the collection. Head home.",
      "404.home":"Back to home",
      "guide.title":"Pat Riotik",
      "guide.subtitle":"Pat · site guide",
      "guide.close":"Close guide",
      "guide.fab.open":"Open Pat · site guide",
      "guide.fab.close":"Close Pat · site guide",
      "guide.welcome":"Hi — I’m Pat. I can point you around this collection. What are you after?",
      "guide.placeholder":"Ask about the collection…",
      "guide.input.label":"Ask Pat",
      "guide.send":"Send message",
      "guide.chip.importance":"Why are these items important?",
      "guide.chip.visit":"Who can visit the museum?",
      "guide.chip.maintain":"Who keeps and maintains the collection?",
      "guide.reply.soon":"Thanks for asking. The live guide is offline for now — coming soon. Meanwhile, use the menu to explore the collection.",
      "guide.reply.importance":"These pieces preserve the legacy and Lasallian values of DLSU-D’s former presidents. They are a historical link between the community’s past and future, and they support the university’s identity as a Heritage and Cultural Center.",
      "guide.reply.visit":"Students, faculty, staff, and visitors are welcome to explore the Presidents’ Memorabilia at AEA-IRC on the DLSU-D campus—onsite at the museum or through this digital collection.",
      "guide.reply.maintain":"The collection is housed and cared for at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas, where archives, exhibitions, and research keep campus heritage alive.",
      items:[
        {t:"Inaugural medallion",d:"[Year]. Worn at the inauguration ceremony. [Short note about this piece.]"},
        {t:"Official portrait",d:"[Year]. Hung in the president’s hall. [Short note about this piece.]"},
        {t:"Ceremonial gavel",d:"[Year]. Used to open the first assembly. [Short note about this piece.]"},
        {t:"Signed charter",d:"[Year]. Signed and sealed on the day of appointment. [Short note about this piece.]"}
      ]
    },
    fil:{
      "skip":"Lumaktaw sa nilalaman",
      "school":"De La Salle University Philippines",
      "school.short":"DLSU Dasmariñas",
      "nav.home":"Home","nav.history":"Kasaysayan","nav.gallery":"Tungkol","nav.library":"Lokasyon","nav.soon":"Sulyap Lasalyano","nav.menu":"Menu","nav.close":"Isara ang menu",
      "lang":"Wika",
      "hero.title":"Mga Alaala ng mga Pangulo",
      "hero.title.line1":"Mga Alaala ng","hero.title.line2":"mga Pangulo",
      "hero.alt":"Koleksyon ng Kampus",
      "hero.powered":"Pinapagana ng","hero.lead":"Isang tahimik na archive ng mga medalya, larawan, at seremonyal na piraso mula sa bawat panunungkulan.",
      "flip.label":"Tingnan ang museo","flip.label.warm":"Bumalik sa tahanan",
      "flip.switch":"Palitan ang view",
      "cta.explore":"Tingnan ang koleksiyon","cta.history":"Tingnan ang kasaysayan",
      "cta.scan":"I-SCAN ANG MGA BAGAY AT MATUTO!","cta.kg":"Tingnan ang Knowledge Graph","cta.hint":"Nasa museo ka ba ngayon?",
      "ag.title":"Tungkol",
      "ag.copy":"Ang Presidents’ Memorabilia ay isang koleksyon na nasa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ng De La Salle University-Dasmariñas. Pinangangalagaan nito ang mga artifact gaya ng mga commemorative trophy, plaque, at mga souvenir sa paglalakbay na sumasalamin sa mga pagpapahalagang Lasalyano at pamumuno ng mga dating pangulo ng unibersidad. Bilang historikal na ugnayan sa pagitan ng nakaraan at kinabukasan ng komunidad ng DLSU-D, sinusuportahan ng koleksyon ang identidad ng unibersidad bilang Heritage and Cultural Center.",
      "aea.title":"Tungkol sa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.title.lead":"Tungkol sa",
      "aea.title.rest":"Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.info":"Tungkol sa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)",
      "aea.info.btn":"Info","aea.info.close":"Isara","aea.info.hint":"i-click dito",
      "aea.info.body":"Pinananatili ng AEAIRC ang buhay na memorya ng unibersidad: kung saan nagtatagpo ang mga archive, eksibisyon, at pananaliksik. Placeholder ang panel na ito: palitan ng opisyal na paglalarawan, oras ng pagbisita, at paano humiling ng materyales.",
      "aea.info.body2":"",
      "scroll.more":"Mag-scroll","col.title":"Mga bagay na nagdadala ng kuwento ng unibersidad",
      "col.p1":"[Paglalarawan ng koleksiyon: dalawa o tatlong pangungusap tungkol sa laman ng koleksiyon, sino ang pinararangalan, at paano nalikom ang mga piraso.]",
      "col.p2":"Silipin ang mga medalya, larawan, seremonyal na kagamitan, at dokumento mula sa bawat panunungkulan. May maikling tala ang bawat bagay kung saan ito galing at bakit ito iningatan.",
      "col.link":"Tingnan ang museo",
      "bld.name":"[Pangalan ng gusali o tao]",
      "about.title":"Tungkol sa developer",
      "about.body":"[Talambuhay ng developer: sino ang gumawa ng site, ano ang layunin ng proyekto, at paano makikipag-ugnayan.]",
      "about.photo":"Larawan ng developer (placeholder)",
      "gal.title":"Museo","gal.intro":"Apat na piraso mula sa koleksiyon. Pumili ng isa para makita nang mas malaki.",
      "foot.enjoy":"Magsaya sa inyong pagbisita!","foot.top":"Bumalik sa itaas",
      "foot.copy":"© 2026 De La Salle University–Dasmariñas",
      "lb.close":"Isara","lb.prev":"Naunang bagay","lb.next":"Susunod na bagay",
      "nx.kick":"Susunod","nx.gallery":"Buksan ang museo",
      "nx.gallery.p":"Apat na piraso mula sa koleksiyon: medalya, larawan, at seremonyal na bagay.",
      "nx.home":"Bumalik sa tahanan","nx.home.p":"Bumalik sa kuwento ng koleksiyon at entablado ng kampus.",
      "nx.meta":"Hash route · may deep link",
      "nx.edu.kicker":"Ano ang",
      "nx.edu.title":"Sulyap Lasalyano",
      "nx.edu.mark":"?",
      "nx.edu.cats.by":"Ni",
      "nx.edu.scan.name":"Live Scan",
      "nx.edu.kg.name":"Knowledge Graph",
      "skip.next":"Susunod na seksyon",
      "menu.title":"Mag-navigate",
      "toast.lang":"Wika","toast.lang.detail":"Lumipat sa Filipino",
      "toast.offline":"Walang koneksyon","toast.offline.detail":"Maaaring hindi gumana ang ilang link hanggang makabalik ang koneksyon.",
      "toast.online":"May koneksyon na","toast.online.detail":"Nabawi ang koneksyon.",
      "guide.title":"Pat Riotik",
      "guide.subtitle":"Pat · gabay sa site",
      "guide.close":"Isara ang gabay",
      "guide.fab.open":"Buksan si Pat · gabay sa site",
      "guide.fab.close":"Isara si Pat · gabay sa site",
      "guide.welcome":"Kumusta — ako si Pat. Matutulungan kitang maglibot sa koleksiyong ito. Ano ang hinahanap mo?",
      "guide.placeholder":"Magtanong tungkol sa koleksiyon…",
      "guide.input.label":"Magtanong kay Pat",
      "guide.send":"Ipadala ang mensahe",
      "guide.chip.importance":"Bakit mahalaga ang mga bagay na ito?",
      "guide.chip.visit":"Sino ang maaaring bumisita sa museo?",
      "guide.chip.maintain":"Sino ang nangangalaga at nagpapanatili ng koleksiyon?",
      "guide.reply.soon":"Salamat sa tanong. Offline muna ang live guide — malapit na. Samantala, gamitin ang menu para mag-explore.",
      "guide.reply.importance":"Pinangangalagaan ng mga pirasong ito ang pamana at mga pagpapahalagang Lasalyano ng mga dating pangulo ng DLSU-D. Sila ang historikal na ugnayan ng nakaraan at kinabukasan ng komunidad, at sinusuportahan nila ang identidad ng unibersidad bilang Heritage and Cultural Center.",
      "guide.reply.visit":"Malugod na tinatanggap ang mga estudyante, guro, kawani, at bisita na tuklasin ang Presidents’ Memorabilia sa AEA-IRC sa kampus ng DLSU-D—sa mismong museo o sa digital na koleksiyong ito.",
      "guide.reply.maintain":"Nasa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ng De La Salle University-Dasmariñas ang koleksiyon; doon inaalagaan ang mga archive, eksibisyon, at pananaliksik na nagpapanatiling buhay ang pamana ng kampus.",
      "img.fail":"Hindi available ang larawan",
      "nojs":"Naka-off ang JavaScript. Mabubasa pa rin ang pahina sa mga link sa ibaba.",
      "pre.name":"Mga Alaala ng mga Pangulo","pre.loading":"Naglo-load…","pre.ready":"Handa",
      "404.title":"Hindi nahanap ang route","404.body":"Hindi bahagi ng koleksiyon ang path na ito. Bumalik sa tahanan.",
      "404.home":"Bumalik sa tahanan",
      items:[
        {t:"Medalyon ng inagurasyon",d:"[Taon]. Isinuot sa seremonya ng inagurasyon. [Maikling tala tungkol sa piraso.]"},
        {t:"Opisyal na larawan",d:"[Taon]. Nakasabit sa bulwagan ng pangulo. [Maikling tala tungkol sa piraso.]"},
        {t:"Seremonyal na maso",d:"[Taon]. Ginamit sa pagbubukas ng unang pagpupulong. [Maikling tala tungkol sa piraso.]"},
        {t:"Nilagdaang charter",d:"[Taon]. Nilagdaan at tinatakan sa araw ng pagtatalaga. [Maikling tala tungkol sa piraso.]"}
      ]
    }
  };

  /* Frontend draft stubs — clone EN until real strings are wired from your other app. */
  var LANGS = ["en","fil","es","fr","zh","ko","ja"];
  var LANG_META = {
    en:{abbr:"EN", label:"English", toast:"Switched to English", html:"en"},
    fil:{abbr:"FIL", label:"Filipino", toast:"Lumipat sa Filipino", html:"fil"},
    es:{abbr:"ES", label:"Spanish", toast:"Cambiado a español", html:"es"},
    fr:{abbr:"FR", label:"French", toast:"Passé en français", html:"fr"},
    zh:{abbr:"ZH", label:"Chinese", toast:"已切换为中文", html:"zh-Hans"},
    ko:{abbr:"KO", label:"Korean", toast:"한국어로 전환됨", html:"ko"},
    ja:{abbr:"JA", label:"Japanese", toast:"日本語に切り替えました", html:"ja"}
  };
  function cloneDict(src){
    var out = {};
    Object.keys(src).forEach(function(k){
      if(k === "items") out.items = src.items.map(function(it){ return {t:it.t, d:it.d}; });
      else out[k] = src[k];
    });
    return out;
  }
  ["es","fr","zh","ko","ja"].forEach(function(code){
    if(window.T[code]) return;
    var d = cloneDict(window.T.en);
    d["toast.lang.detail"] = LANG_META[code].toast;
    window.T[code] = d;
  });

  var lang = "en";

  function dict(){ return window.T[lang] || window.T.en; }

  function esc(s){
    return String(s).replace(/[&<>]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];
    });
  }
  function fmt(s){
    return esc(s).replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>');
  }

  function flipLabel(){
    var warm = document.documentElement.classList.contains('warm');
    var key = warm ? 'flip.label.warm' : 'flip.label';
    var el = document.querySelector('#flip [data-i="flip.label"]');
    var D = dict();
    if(el && D[key]) el.textContent = D[key];
  }

  function syncLangUI(){
    var meta = LANG_META[lang] || LANG_META.en;
    document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
      var btn = dd.querySelector('.lang-dd-btn');
      var val = dd.querySelector('.lang-dd-val');
      /* Button always shows abbr (EN); list items keep full names */
      if(val) val.textContent = meta.abbr;
      var id = btn && btn.getAttribute('aria-controls');
      var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
      if(menu){
        menu.querySelectorAll('[role="option"]').forEach(function(opt){
          var on = opt.getAttribute('data-value') === lang;
          opt.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }
    });
  }

  function applyLang(l, quiet){
    lang = LANGS.indexOf(l) >= 0 ? l : "en";
    store.set("pm-lang", lang);
    document.documentElement.lang = (LANG_META[lang] && LANG_META[lang].html) || lang;
    document.documentElement.setAttribute("data-lang", lang);
    var D = dict();
    document.querySelectorAll('[data-i]').forEach(function(el){
      if(el.dataset.i === 'flip.label') return;
      var v = D[el.dataset.i];
      if(v !== undefined) el.innerHTML = fmt(v);
    });
    document.querySelectorAll('[data-i-label]').forEach(function(el){
      var v = D[el.dataset.iLabel];
      if(v) el.setAttribute('aria-label', v);
    });
    flipLabel();
    syncLangUI();
    document.querySelectorAll('[data-fail]').forEach(function(el){
      el.setAttribute('data-fail', D['img.fail'] || 'Image unavailable');
    });
    document.dispatchEvent(new CustomEvent('langchange', {detail:{lang:lang}}));
    if(!quiet && window.toast){
      window.toast('ok', D['toast.lang'] || 'Language', D['toast.lang.detail'] || (LANG_META[lang] && LANG_META[lang].toast) || lang);
    }
  }

  function reduceMotion(){
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function closeAllLang(immediate){
    langOpen = false;
    document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
      var btn = dd.querySelector('.lang-dd-btn');
      if(btn) btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.lang-dd-menu').forEach(function(menu){
      if(menu.hidden){
        menu.classList.remove('is-closing');
        return;
      }
      if(immediate || reduceMotion()){
        menu.classList.remove('is-closing');
        menu.hidden = true;
        return;
      }
      if(menu.classList.contains('is-closing')) return;
      menu.classList.add('is-closing');
      var done = function(e){
        if(e && e.target !== menu) return;
        menu.removeEventListener('animationend', done);
        clearTimeout(menu._closeT);
        menu.classList.remove('is-closing');
        menu.hidden = true;
      };
      menu.addEventListener('animationend', done);
      menu._closeT = setTimeout(done, 260);
    });
    syncLangUI();
  }

  function placeMenu(btn, menu){
    var r = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.right = 'auto';
    menu.style.minWidth = Math.max(Math.round(r.width), 188) + 'px';
    menu.style.zIndex = '120';
    requestAnimationFrame(function(){
      var mr = menu.getBoundingClientRect();
      if(mr.right > innerWidth - 8){
        menu.style.left = Math.max(8, Math.round(innerWidth - mr.width - 8)) + 'px';
      }
      if(mr.bottom > innerHeight - 8){
        menu.style.top = Math.max(8, Math.round(r.top - mr.height - 8)) + 'px';
      }
    });
  }

  var langOpen = false;
  var langIgnoreScroll = 0;

  function openLang(dd){
    closeAllLang(true);
    var btn = dd.querySelector('.lang-dd-btn');
    var id = btn && btn.getAttribute('aria-controls');
    var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
    if(!menu || !btn) return;
    /* Park on body so header overflow / sheet scroll never clips or auto-closes it */
    if(menu.parentElement !== document.body){
      document.body.appendChild(menu);
      menu._langDd = dd;
    }
    menu.classList.remove('is-closing');
    menu.hidden = false;
    placeMenu(btn, menu);
    /* re-trigger same enter as Menu sheet (msheet-in) */
    menu.style.animation = 'none';
    void menu.offsetWidth;
    menu.style.animation = '';
    btn.setAttribute('aria-expanded', 'true');
    langOpen = true;
    langIgnoreScroll = Date.now() + 400;
    syncLangUI();
  }

  function toggleLang(dd){
    var btn = dd.querySelector('.lang-dd-btn');
    var id = btn && btn.getAttribute('aria-controls');
    var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
    if(!menu) return;
    if(menu.hidden) openLang(dd); else closeAllLang();
  }

  window.applyLang = applyLang;
  window.pmFmt = fmt;
  window.pmEsc = esc;
  window.pmLang = function(){ return lang; };

  document.addEventListener('viewflip', flipLabel);
  document.addEventListener('routechange', flipLabel);

  function bindMenuOptions(menu){
    menu.querySelectorAll('[role="option"]').forEach(function(opt){
      if(opt._langBound) return;
      opt._langBound = true;
      opt.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        applyLang(opt.getAttribute('data-value'));
        closeAllLang();
      });
    });
  }

  document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
    var btn = dd.querySelector('.lang-dd-btn');
    var menu = dd.querySelector('.lang-dd-menu');
    if(menu) bindMenuOptions(menu);
    if(btn) btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      toggleLang(dd);
    });
  });

  document.addEventListener('click', function(e){
    if(e.target.closest && (e.target.closest('.lang-dd-menu') || e.target.closest('[data-lang-dd]'))) return;
    closeAllLang();
  });
  addEventListener('resize', closeAllLang);
  addEventListener('scroll', function(){
    if(!langOpen || Date.now() < langIgnoreScroll) return;
    closeAllLang();
  }, {passive:true});
  addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeAllLang();
  });

  applyLang(store.get("pm-lang") || "en", true);
})();
