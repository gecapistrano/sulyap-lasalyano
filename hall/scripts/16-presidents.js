/* President profile — catalog-backed by ?id= / /presidents/:slug / #hash */
import { createModelStage } from './scan/model-stage.js?v=18';
import { catalogModelSrc, hasVendoredCatalogModel } from './catalog-models.js?v=5';
import { relatedGroups, paintOwnerYear, renderRelatedSection } from './related-panel.js?v=2';

(function () {
  var FALLBACK = '/';
  var PHOTO_V = '3';
  var CATALOG_LIMIT = 2000;
  var MAX_LIVE_STAGES = 6;
  var TRANSLATE_LANG = {
    en: 'en',
    fil: 'tl',
    es: 'es',
    fr: 'fr',
    zh: 'zh-CN',
    ko: 'ko',
    ja: 'ja'
  };

  var KNOWN_SLUGS = {
    'br. rafael s. donato, fsc': 'br-donato',
    'br. gus boquer, fsc': 'br-gus',
    'br. andrew b. gonzalez, fsc': 'br-andrew',
    'br. andrew b. gonzales, fsc': 'br-andrew',
    'br. rolando v. dizon, fsc': 'br-rolly',
    'br. armin a. luistro, fsc': 'br-armin',
    'dr. carmelita r. quebengco': 'dr-quebengco',
    'br. geminiano m. buenaventura, fsc': 'br-mawel',
    'br. francisco "sockie" dela rosa vi, fsc': 'br-sockie',
    'br. francisco sockie dela rosa vi, fsc': 'br-sockie',
    'br. iñigo riola, fsc': 'br-inigo',
    'br. inigo riola, fsc': 'br-inigo'
  };

  /**
   * Hall fallbacks when the catalog is offline.
   * Slugs match assets/presidents/<slug>.jpg and catalog-graph.mjs.
   */
  var PRESIDENTS = {
    'br-inigo': {
      display: 'Br. Inigo',
      fullName: 'Br. Iñigo Riola, FSC',
      nickname: 'Inigo',
      file: 'br-inigo.jpg',
      years: '2024–present'
    },
    'br-andrew': {
      display: 'Br. Andrew',
      fullName: 'Br. Andrew B. Gonzalez, FSC',
      nickname: 'Andrew',
      file: 'br-andrew.jpg',
      years: '1999–2001'
    },
    'br-armin': {
      display: 'Br. Armin',
      fullName: 'Br. Armin A. Luistro, FSC',
      nickname: 'Armin',
      file: 'br-armin.jpg',
      years: '2008–2010'
    },
    'br-donato': {
      display: 'Br. Donato',
      fullName: 'Br. Rafael S. Donato, FSC',
      nickname: 'Donato',
      file: 'br-donato.jpg',
      years: '1987–1994'
    },
    'br-gus': {
      display: 'Br. Gus',
      fullName: 'Br. Gus Boquer, FSC',
      nickname: 'Gus',
      file: 'br-gus.jpg',
      years: '1994–1999'
    },
    'br-mawel': {
      display: 'Br. Mawel',
      fullName: 'Br. Geminiano M. Buenaventura, FSC',
      nickname: 'Mawel',
      file: 'br-mawel.jpg',
      years: '2016–2019'
    },
    'br-rolly': {
      display: 'Br. Rolly',
      fullName: 'Br. Rolando V. Dizon, FSC',
      nickname: 'Rolly',
      file: 'br-rolly.jpg',
      years: '2001–2004'
    },
    'br-sockie': {
      display: 'Br. Sockie',
      fullName: 'Br. Francisco "Sockie" dela Rosa VI, FSC',
      nickname: 'Sockie',
      file: 'br-sockie.jpg',
      years: '2019–2024'
    },
    'dr-quebengco': {
      display: 'Dr. Quebengco',
      fullName: 'Dr. Carmelita R. Quebengco',
      nickname: 'Quebengco',
      file: 'dr-quebengco.jpg',
      years: '2010–2016'
    }
  };

  function t(key, fallback) {
    if (typeof window.pmLookup === 'function') {
      var v = window.pmLookup(key);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return fallback;
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function catalogPrefix() {
    var cfg = window.SL_SCAN_CONFIG || window.SL_KG_CONFIG || {};
    var base = text(cfg.apiBaseUrl).replace(/\/+$/, '');
    if (!base || base.indexOf('api.example.com') !== -1) return '';
    try {
      var u = new URL(base);
      if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
        return '';
      }
      return base;
    } catch (err) {
      return '';
    }
  }

  function normalizeName(value) {
    return text(value)
      .toLowerCase()
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\s+/g, ' ');
  }

  function asciiSlugPart(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function slugifyPresident(name) {
    var known = KNOWN_SLUGS[normalizeName(name)];
    if (known) return known;
    var raw = text(name);
    var isDr = /^(Dr\.)/i.test(raw);
    var cleaned = raw.replace(/,?\s*FSC\.?$/i, '').replace(/^(Br\.|Bro\.|Brother|Dr\.)\s+/i, '');
    var bits = cleaned.split(/\s+/).filter(Boolean);
    var last = asciiSlugPart(bits[bits.length - 1] || cleaned || 'president') || 'president';
    return (isDr ? 'dr' : 'br') + '-' + last;
  }

  function resolveId() {
    try {
      var params = new URLSearchParams(location.search);
      var q = (params.get('id') || params.get('slug') || '').trim().toLowerCase();
      if (q) return q.replace(/\.html?$/, '');
    } catch (e) {}
    try {
      var path = location.pathname || '';
      var m = path.match(/\/presidents\/([^/]+)\/?$/i);
      if (m) return decodeURIComponent(m[1]).replace(/\.html?$/i, '').toLowerCase();
    } catch (e) {}
    try {
      var hash = (location.hash || '').replace(/^#/, '').trim().toLowerCase();
      if (hash) return hash.replace(/\.html?$/, '');
    } catch (e) {}
    return '';
  }

  function photoUrl(file) {
    return '/assets/presidents/' + file + '?v=' + PHOTO_V;
  }

  function remoteUrl(value) {
    var url = text(value);
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function currentLang() {
    return (typeof window.pmLang === 'function' && window.pmLang()) || 'en';
  }

  function hashText(value) {
    var h = 2166136261;
    var src = String(value || '');
    for (var i = 0; i < src.length; i++) {
      h ^= src.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function translateCacheKey(target, value) {
    return 'sl_tr_' + target + '_' + hashText(value);
  }

  var translateInFlight = 0;
  var translateWaiters = [];
  var TRANSLATE_CONCURRENCY = 2;

  function isUsableTranslation(source, translated) {
    var src = text(source);
    var out = text(translated);
    if (!out) return false;
    if (/MYMEMORY|QUERY LENGTH|USAGE LIMIT|PLEASE SELECT TWO DISTINCT/i.test(out)) return false;
    if (/https?:\/\/|\bwww\./i.test(out) && !/https?:\/\/|\bwww\./i.test(src)) return false;
    if (/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/.test(out) && !/@/.test(src)) return false;
    if (/\+\d{1,3}[\s.-]?\(?\d/.test(out) && !/\+\d/.test(src)) return false;
    return true;
  }

  function cachedCatalogTranslation(value) {
    var source = text(value);
    if (!source) return '';
    var target = TRANSLATE_LANG[currentLang()] || 'en';
    if (target === 'en') return source;
    try {
      var cached = sessionStorage.getItem(translateCacheKey(target, source));
      if (cached && isUsableTranslation(source, cached)) return cached;
      if (cached) sessionStorage.removeItem(translateCacheKey(target, source));
      return null;
    } catch (err) {
      return null;
    }
  }

  function runTranslateQueue() {
    while (translateInFlight < TRANSLATE_CONCURRENCY && translateWaiters.length) {
      var job = translateWaiters.shift();
      translateInFlight += 1;
      job.start()
        .then(job.resolve, job.reject)
        .then(function () {
          translateInFlight -= 1;
          runTranslateQueue();
        });
    }
  }

  function enqueueTranslate(start) {
    return new Promise(function (resolve, reject) {
      translateWaiters.push({ start: start, resolve: resolve, reject: reject });
      runTranslateQueue();
    });
  }

  function translateCatalogText(value) {
    var source = text(value);
    if (!source) return Promise.resolve('');
    var target = TRANSLATE_LANG[currentLang()] || 'en';
    if (target === 'en') return Promise.resolve(source);
    var cached = cachedCatalogTranslation(source);
    if (cached) return Promise.resolve(cached);
    var chunk = source.slice(0, 900);
    var url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(chunk) +
      '&langpair=en|' +
      encodeURIComponent(target);
    return enqueueTranslate(function () {
      return fetch(url, { credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) return source;
          return res.json();
        })
        .then(function (data) {
          if (typeof data === 'string') return data;
          var translated = data && data.responseData && data.responseData.translatedText;
          if (!isUsableTranslation(source, translated)) return source;
          var out = source.length > 900 ? translated + '…' : translated;
          try {
            sessionStorage.setItem(translateCacheKey(target, source), out);
          } catch (err) {}
          return out;
        })
        .catch(function () {
          return source;
        });
    });
  }

  function localizePresidentName(name) {
    var s = text(name);
    if (!s) return s;
    var rules = {
      es: [[/^Br\.\s+/i, 'Hno. '], [/^Brother\s+/i, 'Hermano ']],
      fr: [[/^Br\.\s+/i, 'F. '], [/^Brother\s+/i, 'Frère ']],
      fil: [[/^Brother\s+/i, 'Kapatid na ']],
      zh: [[/^Br\.\s+/i, '修士 '], [/^Brother\s+/i, '修士 '], [/^Dr\.\s+/i, '博士 ']],
      ko: [[/^Br\.\s+/i, '수사 '], [/^Brother\s+/i, '수사 '], [/^Dr\.\s+/i, '박사 ']],
      ja: [[/^Br\.\s+/i, 'ブラザー '], [/^Brother\s+/i, 'ブラザー '], [/^Dr\.\s+/i, '博士 ']]
    }[currentLang()];
    if (!rules) return s;
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(s)) return s.replace(rules[i][0], rules[i][1]);
    }
    return s;
  }

  function goBack() {
    try {
      sessionStorage.setItem('sl_home_ready', '1');
    } catch (e) {}
    try {
      if (window.history.length > 1 && document.referrer) {
        var sameOrigin = false;
        try {
          sameOrigin = new URL(document.referrer).origin === location.origin;
        } catch (err) {}
        if (sameOrigin) {
          history.back();
          return;
        }
      }
    } catch (e) {}
    location.href = FALLBACK;
  }

  var lightboxLastFocus = null;
  var lightboxClosing = false;
  var lightboxStage = null;
  var lightboxItem = null;
  var itemTiles = [];
  var itemObserver = null;
  var currentArtifacts = [];
  var currentPresident = null;
  var currentId = '';
  var catalogCache = null;
  var catalogPromise = null;
  var orderedIds = [];
  var navLock = false;
  var copyGen = 0;
  var searchQuery = '';
  var searchOpen = false;
  var searchTimer = 0;
  var filterGen = 0;

  function prefersReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function finishLightboxClose(dlg) {
    lightboxClosing = false;
    if (dlg) dlg.classList.remove('is-closing');
    if (dlg && dlg.open) {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }
    if (lightboxStage) {
      lightboxStage.pause();
      lightboxStage.show({ modelUrl: '' });
    }
    lightboxItem = null;
    if (lightboxLastFocus && typeof lightboxLastFocus.focus === 'function') {
      try { lightboxLastFocus.focus(); } catch (e) {}
    }
    lightboxLastFocus = null;
  }

  function closeLightbox() {
    var dlg = document.getElementById('presLightbox');
    if (!dlg || !dlg.open || lightboxClosing) return;
    if (prefersReducedMotion()) {
      finishLightboxClose(dlg);
      return;
    }
    lightboxClosing = true;
    dlg.classList.add('is-closing');
    var done = false;
    function end() {
      if (done) return;
      done = true;
      dlg.removeEventListener('animationend', onEnd);
      finishLightboxClose(dlg);
    }
    function onEnd(e) {
      if (e && e.target !== dlg) return;
      end();
    }
    dlg.addEventListener('animationend', onEnd);
    setTimeout(end, 320);
  }

  function ensureLightboxStage() {
    var host = document.getElementById('presLightboxStage');
    if (!host) return null;
    if (!lightboxStage) lightboxStage = createModelStage(host);
    return lightboxStage;
  }

  function findArtifactRow(code) {
    var needle = text(code).toUpperCase();
    var rows = catalogCache && catalogCache.artifacts;
    if (!needle || !Array.isArray(rows)) return null;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (text(rows[i] && (rows[i].id_code || rows[i].rd_code)).toUpperCase() === needle) return rows[i];
    }
    return null;
  }

  function paintLightboxCaption(item) {
    var copy = document.getElementById('presLightboxCopy');
    var relatedHost = document.getElementById('presLightboxRelated');
    if (!copy || !item) return;
    copy.replaceChildren();
    paintOwnerYear({
      t: t,
      owner: item.owner,
      year: item.year,
      title: item.title,
      description: item.description,
      presEl: document.getElementById('presLightboxPresident'),
      yearEl: document.getElementById('presLightboxYear'),
      photoEl: document.getElementById('presLightboxPhoto'),
      wrapEl: document.getElementById('presLightboxOwner')
    });
    var code = document.createElement('strong');
    code.className = 'pres-item-code';
    code.textContent = item.code || '';
    copy.appendChild(code);
    var sameCopy = item.title && item.description && item.description.indexOf(item.title) === 0;
    if (item.title && !sameCopy) {
      var title = document.createElement('span');
      title.className = 'pres-lightbox-title';
      title.textContent = item.title;
      copy.appendChild(title);
    }
    if (item.description) {
      var desc = document.createElement('span');
      desc.className = 'pres-lightbox-desc';
      desc.textContent = item.description;
      copy.appendChild(desc);
    }
    renderRelatedSection(relatedHost, {
      t: t,
      code: item.code,
      groups: relatedGroups({
        code: item.code,
        title: item.title,
        owner: item.owner,
        year: item.year,
        tags: item.tagObjs || item.tags,
        type: item.type,
        country: item.country,
        subtitle: item.subtitle
      }, catalogCache && catalogCache.artifacts, t),
      onOpen: function (nextCode) {
        var row = findArtifactRow(nextCode);
        if (row) openLightbox(artifactItem(row));
      }
    });
  }

  function openLightbox(item) {
    var dlg = document.getElementById('presLightbox');
    var closeBtn = document.getElementById('presLightboxClose');
    var stage = ensureLightboxStage();
    if (!dlg || !item) return;
    if (lightboxClosing) finishLightboxClose(dlg);
    dlg.classList.remove('is-closing');
    lightboxLastFocus = document.activeElement;
    lightboxItem = item;
    paintLightboxCaption(item);
    if (!dlg.open) {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    if (stage) {
      stage.resume();
      stage.resize();
      if (item.modelUrl) stage.show({ modelUrl: item.modelUrl });
      else stage.show({ modelUrl: '' });
    }
    if (closeBtn) closeBtn.focus();
  }

  function bindLightboxChrome() {
    var dlg = document.getElementById('presLightbox');
    var closeBtn = document.getElementById('presLightboxClose');
    var figure = dlg && dlg.querySelector('.pres-lightbox-figure');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeLightbox();
      });
    }
    if (figure) {
      figure.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
    if (dlg) {
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) closeLightbox();
      });
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        closeLightbox();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var dlg = document.getElementById('presLightbox');
      if (dlg && dlg.open) {
        closeLightbox();
        return;
      }
      if (searchQuery) {
        clearSearch(true);
        return;
      }
      if (searchOpen) setSearchOpen(false);
    });
    window.__slBackStack = window.__slBackStack || [];
    window.__slBackStack.push(function () {
      var dlg = document.getElementById('presLightbox');
      if (!dlg || !dlg.open) return false;
      closeLightbox();
      return true;
    });
  }

  function tagLabels(row) {
    var tags = row && row.tags;
    if (!Array.isArray(tags)) return [];
    return tags.map(function (tag) {
      if (!tag) return '';
      if (typeof tag === 'string') return tag;
      return text(tag.label || tag.slug || tag.name);
    }).filter(Boolean);
  }

  function normalizeSearch(value) {
    return text(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/["'`“”‘’]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function artifactItem(row) {
    var code = text(row && (row.id_code || row.rd_code)).toUpperCase();
    var title = text(row && row.title) || text(row && row.subtitle) || code;
    var description = text(row && row.description);
    var tags = tagLabels(row);
    return {
      code: code,
      title: title,
      description: description,
      tags: tags,
      tagObjs: row && row.tags,
      owner: text(row && row.owner_name),
      type: text(row && row.artifact_type),
      country: text(row && row.country_of_origin),
      subtitle: text(row && row.subtitle),
      modelUrl: hasVendoredCatalogModel(code) ? catalogModelSrc(row && row.model_url, code) : '',
      year: text(row && row.year_acquired),
      searchText: normalizeSearch([
        code,
        title,
        description,
        tags.join(' '),
        text(row && row.subtitle),
        text(row && row.artifact_type),
        text(row && row.country_of_origin),
        text(row && row.year_acquired)
      ].join(' '))
    };
  }

  function disposeItemTiles() {
    if (itemObserver) {
      itemObserver.disconnect();
      itemObserver = null;
    }
    itemTiles.forEach(function (tile) {
      if (tile.stage) {
        tile.stage.dispose();
        tile.stage = null;
      }
    });
    itemTiles = [];
  }

  function liveStageCount() {
    return itemTiles.filter(function (tile) { return tile.stage; }).length;
  }

  function releaseOldestStage() {
    var i;
    for (i = 0; i < itemTiles.length; i++) {
      if (itemTiles[i].stage && !itemTiles[i].inView) {
        itemTiles[i].stage.dispose();
        itemTiles[i].stage = null;
        return true;
      }
    }
    return false;
  }

  function ensureTileStage(tile) {
    if (!tile || !tile.modelUrl || !tile.stageEl) return;
    if (tile.stage) {
      tile.stage.resume();
      tile.stage.resize();
      return;
    }
    while (liveStageCount() >= MAX_LIVE_STAGES && releaseOldestStage()) {}
    if (liveStageCount() >= MAX_LIVE_STAGES) return;
    tile.stage = createModelStage(tile.stageEl, { sparkles: false });
    tile.stage.show({ modelUrl: tile.modelUrl });
  }

  function observeTiles() {
    if (itemObserver) itemObserver.disconnect();
    if (typeof IntersectionObserver !== 'function') {
      itemTiles.forEach(function (tile) {
        tile.inView = true;
        ensureTileStage(tile);
      });
      return;
    }
    itemObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var tile = itemTiles.filter(function (item) { return item.article === entry.target; })[0];
        if (!tile) return;
        tile.inView = entry.isIntersecting;
        if (entry.isIntersecting) ensureTileStage(tile);
        else if (tile.stage) {
          tile.stage.dispose();
          tile.stage = null;
        }
      });
    }, { rootMargin: '120px 0px', threshold: 0.12 });
    itemTiles.forEach(function (tile) { itemObserver.observe(tile.article); });
  }

  function tileHaystack(tile) {
    var hay = (tile.item && tile.item.searchText) || '';
    if (tile.titleEl) hay += ' ' + normalizeSearch(tile.titleEl.textContent);
    if (tile.descEl) hay += ' ' + normalizeSearch(tile.descEl.textContent);
    return hay;
  }

  function tileMatches(tile, query) {
    if (!query) return true;
    var tokens = query.split(' ').filter(Boolean);
    var hay = tileHaystack(tile);
    var i;
    for (i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) === -1) return false;
    }
    return true;
  }

  function captureRects() {
    var map = new Map();
    itemTiles.forEach(function (tile) {
      if (tile.article.hidden) return;
      map.set(tile, tile.article.getBoundingClientRect());
    });
    return map;
  }

  function playFlip(first) {
    itemTiles.forEach(function (tile) {
      var el = tile.article;
      if (el.hidden) return;
      var from = first.get(tile);
      if (!from) {
        el.classList.add('is-search-in');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.classList.remove('is-search-in');
          });
        });
        return;
      }
      var to = el.getBoundingClientRect();
      var dx = from.left - to.left;
      var dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.classList.add('is-flipping');
      el.style.transition = 'none';
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () {
        el.style.transition = '';
        el.style.transform = '';
      });
      var done = function () {
        el.classList.remove('is-flipping');
        el.style.transform = '';
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done);
      setTimeout(done, 520);
    });
  }

  function paintSearchEmpty(noMatches) {
    var empty = document.getElementById('presEmpty');
    var grid = document.getElementById('presMasonry');
    if (!empty) return;
    if (noMatches) {
      empty.hidden = false;
      empty.setAttribute('data-i', 'pres.searchNone');
      empty.textContent = t('pres.searchNone', 'No memorabilia match this search.');
      if (grid) grid.hidden = true;
      return;
    }
    if (empty.getAttribute('data-i') === 'pres.searchNone') {
      empty.hidden = true;
    }
    if (grid && itemTiles.length) grid.hidden = false;
  }

  function applySearch(raw, animate) {
    var query = normalizeSearch(raw);
    searchQuery = text(raw);
    var clearBtn = document.getElementById('presSearchClear');
    if (clearBtn) clearBtn.hidden = !searchQuery;
    var input = document.getElementById('presSearchInput');
    if (input && input.getAttribute('aria-label') !== t('pres.searchLabel', 'Search memorabilia')) {
      input.setAttribute('aria-label', t('pres.searchLabel', 'Search memorabilia'));
      input.placeholder = t('pres.searchPh', 'Search code, title, description, or tags');
    }

    if (!itemTiles.length) {
      paintSearchEmpty(false);
      return;
    }

    var matches = [];
    var hide = [];
    itemTiles.forEach(function (tile) {
      if (tileMatches(tile, query)) matches.push(tile);
      else hide.push(tile);
    });

    var gen = ++filterGen;
    var reduced = !animate || prefersReducedMotion();
    var first = reduced ? null : captureRects();

    matches.forEach(function (tile) {
      tile.article.classList.remove('is-search-out');
    });

    function commit() {
      if (gen !== filterGen) return;
      hide.forEach(function (tile) {
        tile.article.hidden = true;
        tile.article.classList.remove('is-search-out', 'is-flipping', 'is-search-in');
        tile.article.style.transform = '';
        tile.article.style.transition = '';
        if (tile.stage) {
          tile.stage.dispose();
          tile.stage = null;
        }
      });
      matches.forEach(function (tile) {
        tile.article.hidden = false;
        tile.article.classList.remove('is-search-out');
      });
      paintSearchEmpty(!!query && !matches.length);
      if (first) playFlip(first);
      observeTiles();
    }

    if (reduced) {
      commit();
      return;
    }

    hide.forEach(function (tile) {
      if (!tile.article.hidden) tile.article.classList.add('is-search-out');
    });
    setTimeout(commit, hide.length ? 220 : 0);
  }

  function setSearchOpen(open) {
    var panel = document.getElementById('presSearch');
    var btn = document.getElementById('presSearchToggle');
    var input = document.getElementById('presSearchInput');
    searchOpen = !!open;
    if (panel) {
      panel.hidden = !searchOpen;
      panel.classList.toggle('is-open', searchOpen);
    }
    if (btn) btn.setAttribute('aria-expanded', searchOpen ? 'true' : 'false');
    if (searchOpen && input) {
      input.setAttribute('aria-label', t('pres.searchLabel', 'Search memorabilia'));
      input.placeholder = t('pres.searchPh', 'Search code, title, description, or tags');
      requestAnimationFrame(function () { input.focus(); });
    }
  }

  function setSearchAvailable(on) {
    var toggle = document.getElementById('presSearchToggle');
    if (toggle) toggle.hidden = !on;
    if (!on) {
      setSearchOpen(false);
      searchQuery = '';
      var input = document.getElementById('presSearchInput');
      if (input) input.value = '';
      var clearBtn = document.getElementById('presSearchClear');
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function clearSearch(animate) {
    var input = document.getElementById('presSearchInput');
    if (input) input.value = '';
    applySearch('', animate);
    if (searchOpen && input) input.focus();
  }

  function scheduleSearch(value) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      applySearch(value, true);
    }, 140);
  }

  function bindSearch() {
    var toggle = document.getElementById('presSearchToggle');
    var form = document.getElementById('presSearch');
    var input = document.getElementById('presSearchInput');
    var clearBtn = document.getElementById('presSearchClear');
    if (toggle) {
      toggle.addEventListener('click', function () {
        setSearchOpen(!searchOpen);
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearTimeout(searchTimer);
        applySearch(input ? input.value : '', true);
      });
    }
    if (input) {
      input.addEventListener('input', function () {
        scheduleSearch(input.value);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearSearch(true);
      });
    }
  }

  function paintItemCopy(tile, title, description) {
    var shownTitle = title || (tile.item && tile.item.title) || '';
    var shownDesc = description || (tile.item && tile.item.description) || '';
    var sameCopy = shownTitle && shownDesc && shownDesc.indexOf(shownTitle) === 0;
    if (tile.titleEl) {
      tile.titleEl.textContent = shownTitle;
      tile.titleEl.hidden = !shownTitle || sameCopy;
    }
    if (tile.descEl) {
      tile.descEl.textContent = shownDesc;
      tile.descEl.hidden = !shownDesc;
    }
  }

  function translateItemTile(tile) {
    var lang = currentLang();
    var title = tile.item.title;
    var desc = tile.item.description;
    if (lang === 'en') {
      paintItemCopy(tile, title, desc);
      return;
    }
    var cachedTitle = title ? cachedCatalogTranslation(title) : '';
    var cachedDesc = desc ? cachedCatalogTranslation(desc) : '';
    paintItemCopy(tile, cachedTitle || title, cachedDesc || desc);
    Promise.all([
      title ? translateCatalogText(title) : Promise.resolve(''),
      desc ? translateCatalogText(desc) : Promise.resolve('')
    ]).then(function (pair) {
      if (currentLang() !== lang) return;
      paintItemCopy(tile, pair[0] || title, pair[1] || desc);
      if (lightboxItem && lightboxItem.code === tile.item.code) {
        lightboxItem = Object.assign({}, tile.item, {
          title: pair[0] || title,
          description: pair[1] || desc
        });
        paintLightboxCaption(lightboxItem);
      }
    });
  }

  function buildMasonry(id, pres, artifacts, pending) {
    var grid = document.getElementById('presMasonry');
    var empty = document.getElementById('presEmpty');
    if (!grid) return;
    disposeItemTiles();
    grid.innerHTML = '';
    grid.hidden = false;

    if (pending) {
      setSearchAvailable(false);
      if (empty) {
        empty.hidden = false;
        empty.setAttribute('data-i', 'pres.memoriesLoading');
        empty.textContent = t('pres.memoriesLoading', 'Loading memorabilia…');
      }
      grid.hidden = true;
      return;
    }

    var items = (artifacts || []).map(artifactItem).filter(function (item) {
      return item.code;
    });
    items.sort(function (a, b) { return a.code.localeCompare(b.code); });

    if (!items.length) {
      setSearchAvailable(false);
      grid.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.setAttribute('data-i', 'pres.memoriesEmpty');
        empty.textContent = t(
          'pres.memoriesEmpty',
          'There are no registered memorabilia for this president yet.'
        );
      }
      return;
    }

    if (empty) empty.hidden = true;
    setSearchAvailable(true);

    items.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'pres-masonry-item pres-item';
      article.setAttribute('role', 'listitem');
      article.tabIndex = 0;
      article.setAttribute(
        'aria-label',
        (item.code ? item.code + '. ' : '') + (item.title || t('pres.itemOpen', 'View 3D model'))
      );

      var stageEl = document.createElement('div');
      stageEl.className = 'pres-item-stage';
      stageEl.setAttribute('aria-hidden', 'true');

      var copy = document.createElement('div');
      copy.className = 'pres-item-copy';

      var codeEl = document.createElement('p');
      codeEl.className = 'pres-item-code';
      var codeStrong = document.createElement('strong');
      codeStrong.textContent = item.code;
      codeEl.appendChild(codeStrong);

      var titleEl = document.createElement('h4');
      titleEl.className = 'pres-item-title';
      titleEl.textContent = item.title;

      var descEl = document.createElement('p');
      descEl.className = 'pres-item-desc';
      descEl.textContent = item.description;
      var sameCopy = item.title && item.description && item.description.indexOf(item.title) === 0;
      titleEl.hidden = !item.title || sameCopy;
      descEl.hidden = !item.description;

      copy.appendChild(codeEl);
      copy.appendChild(titleEl);
      copy.appendChild(descEl);
      if (item.modelUrl) {
        article.appendChild(stageEl);
      } else {
        article.classList.add('pres-item--copy');
        article.removeAttribute('tabIndex');
      }
      article.appendChild(copy);

      if (item.modelUrl) {
        function openThis() {
          openLightbox(item);
        }
        article.addEventListener('click', openThis);
        article.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openThis();
          }
        });
      } else {
        article.style.cursor = 'default';
      }

      grid.appendChild(article);
      var tile = {
        article: article,
        stageEl: stageEl,
        titleEl: titleEl,
        descEl: descEl,
        item: item,
        modelUrl: item.modelUrl,
        stage: null,
        inView: false
      };
      itemTiles.push(tile);
      translateItemTile(tile);
    });

    observeTiles();
    if (searchQuery) {
      var input = document.getElementById('presSearchInput');
      if (input && !input.value) input.value = searchQuery;
      setSearchOpen(true);
      applySearch(searchQuery, false);
    }
  }

  function afterPageTx(cb) {
    var called = false;
    function run() {
      if (called) return;
      called = true;
      document.removeEventListener('sl-page-tx-in', run);
      cb();
    }
    var root = document.documentElement;
    var waiting = root.classList.contains('pres-booting') ||
      (root.classList.contains('page-tx-from') && !root.classList.contains('page-tx-in'));
    if (waiting) {
      document.addEventListener('sl-page-tx-in', run);
      setTimeout(run, 9000);
      return;
    }
    run();
  }

  var bootAt = (window.performance && performance.now) ? performance.now() : Date.now();
  var bootRevealed = false;
  var profilePainted = false;

  function clearPresBoot() {
    var root = document.documentElement;
    var overlay = document.getElementById('slNavLoad');
    root.classList.remove('pres-booting', 'page-tx-from', 'page-tx-leave');
    if (document.body) document.body.classList.remove('is-booting');
    if (overlay) {
      overlay.classList.add('is-out');
      overlay.classList.remove('is-on');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function waitForImage(img, ms) {
    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      if (!img || !img.getAttribute('src')) {
        done();
        return;
      }
      if (img.complete && img.naturalWidth) {
        done();
        return;
      }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, ms || 2200);
    });
  }

  function revealPresBoot() {
    if (bootRevealed) {
      clearPresBoot();
      return;
    }
    bootRevealed = true;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var wait = prefersReducedMotion() ? 0 : Math.max(0, 420 - (now - bootAt));
    window.setTimeout(function () {
      window.__presReady = true;
      clearPresBoot();
      if (typeof window.slRevealPage === 'function') window.slRevealPage();
      else {
        try { document.dispatchEvent(new CustomEvent('sl-pres-ready')); } catch (e) {}
      }
    }, wait);
  }

  function playProfileEnter() {
    var profile = document.getElementById('presProfile');
    if (!profile || profile.hidden) return;
    profile.classList.remove('is-in', 'is-leaving');
    void profile.offsetWidth;
    profile.classList.remove('is-pending');
    profile.classList.add('is-in');
  }

  function showMissing() {
    var missing = document.getElementById('presMissing');
    var profile = document.getElementById('presProfile');
    if (missing) missing.hidden = false;
    if (profile) profile.hidden = true;
    document.title = t('pres.missing', 'President not found.') + ' — Sulyap Lasalyano';
    revealPresBoot();
  }

  function setText(id, value, hideEmpty) {
    var el = document.getElementById(id);
    if (!el) return;
    var next = text(value);
    if (next) {
      el.textContent = next;
      el.removeAttribute('data-i');
    }
    if (hideEmpty) el.hidden = !next;
  }

  function headingName(pres) {
    return localizePresidentName(pres.fullName || pres.realName || pres.display);
  }

  function paintHistory(bio) {
    var el = document.getElementById('presHistory');
    if (!el) return;
    var source = text(bio);
    if (!source) {
      el.setAttribute('data-i', 'pres.historyBody');
      el.textContent = t(
        'pres.historyBody',
        'A short biography and bibliography will appear here. [Placeholder pending curatorial research.]'
      );
      return;
    }
    el.removeAttribute('data-i');
    var lang = currentLang();
    if (lang === 'en') {
      el.textContent = source;
      return;
    }
    var cached = cachedCatalogTranslation(source);
    var gen = (copyGen += 1);
    el.textContent = cached || t('scan.translating', 'Translating…');
    translateCatalogText(source).then(function (out) {
      if (gen !== copyGen) return;
      if (currentLang() !== lang) return;
      el.textContent = out || source;
    });
  }

  function termStartYear(value) {
    var m = String(value || '').match(/(\d{4})/);
    return m ? Number(m[1]) : 0;
  }

  function buildOrderedIds(rows) {
    var byId = {};
    Object.keys(PRESIDENTS).forEach(function (id) {
      byId[id] = termStartYear(PRESIDENTS[id].years);
    });
    (rows || []).forEach(function (row) {
      var id = slugifyPresident(row && row.name);
      if (!id) return;
      var year = termStartYear(row.service);
      if (year) byId[id] = year;
      else if (byId[id] == null) byId[id] = 9999;
    });
    orderedIds = Object.keys(byId).sort(function (a, b) {
      var diff = (byId[a] || 0) - (byId[b] || 0);
      return diff || a.localeCompare(b);
    });
  }

  function neighborId(delta) {
    var i = orderedIds.indexOf(currentId);
    if (i < 0) return '';
    return orderedIds[i + delta] || '';
  }

  function findCatalogPresident(id) {
    if (!catalogCache) return null;
    return (catalogCache.presidents || []).filter(function (row) {
      return slugifyPresident(row.name) === id;
    })[0] || null;
  }

  function updateNavChrome() {
    var prev = document.getElementById('presPrev');
    var next = document.getElementById('presNext');
    var prevId = neighborId(-1);
    var nextId = neighborId(1);
    if (prev) {
      prev.disabled = !prevId;
      prev.setAttribute('aria-label', t('pres.prev', 'Previous president'));
    }
    if (next) {
      next.disabled = !nextId;
      next.setAttribute('aria-label', t('pres.next', 'Next president'));
    }
  }

  function playSlide(dir) {
    var profile = document.getElementById('presProfile');
    if (!profile || prefersReducedMotion() || !dir) return;
    profile.classList.remove('is-slide-prev', 'is-slide-next');
    void profile.offsetWidth;
    profile.classList.add(dir < 0 ? 'is-slide-prev' : 'is-slide-next');
  }

  function resetSearchUi() {
    searchQuery = '';
    var input = document.getElementById('presSearchInput');
    if (input) input.value = '';
    var clearBtn = document.getElementById('presSearchClear');
    if (clearBtn) clearBtn.hidden = true;
    setSearchOpen(false);
  }

  function presidentHref(id) {
    return '/president.html?id=' + encodeURIComponent(id);
  }

  function goToPresident(id, dir, fromPop) {
    if (!id || id === currentId || navLock) return;
    var dlg = document.getElementById('presLightbox');
    if (dlg && dlg.open) closeLightbox();
    navLock = true;
    window.setTimeout(function () { navLock = false; }, 420);
    resetSearchUi();
    currentId = id;
    if (!fromPop) {
      try { history.pushState({ pres: id }, '', presidentHref(id)); } catch (err) {}
    }
    var row = findCatalogPresident(id);
    var artifacts = catalogCache ? artifactsFor(mergePresident(id, row), catalogCache.artifacts) : [];
    showProfile(id, mergePresident(id, row), artifacts, !catalogCache, dir);
    try {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } catch (err) {
      window.scrollTo(0, 0);
    }
    if (!catalogCache) {
      loadCatalog(id).then(function (cat) {
        if (currentId !== id) return;
        if (!cat.president && !PRESIDENTS[id]) return;
        showProfile(id, mergePresident(id, cat.president), artifactsFor(mergePresident(id, cat.president), cat.artifacts), false, 0);
      }).catch(function () {});
    }
  }

  function bindPresidentNav() {
    var prev = document.getElementById('presPrev');
    var next = document.getElementById('presNext');
    if (prev) {
      prev.addEventListener('click', function () {
        goToPresident(neighborId(-1), -1, false);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        goToPresident(neighborId(1), 1, false);
      });
    }

    var startX = 0;
    var startY = 0;
    var tracking = false;
    var shell = document.querySelector('.pres-shell');
    function ignoreSwipe(target) {
      return !!(target && target.closest && target.closest('input, textarea, select, .pres-search, .pres-lightbox, .pres-nav, .pres-lang, a, button'));
    }
    if (shell) {
      shell.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (ignoreSwipe(e.target)) return;
        var dlg = document.getElementById('presLightbox');
        if (dlg && dlg.open) return;
        tracking = true;
        startX = e.clientX;
        startY = e.clientY;
      });
      shell.addEventListener('pointerup', function (e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx < 0) goToPresident(neighborId(1), 1, false);
        else goToPresident(neighborId(-1), -1, false);
      });
      shell.addEventListener('pointercancel', function () { tracking = false; });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      var dlg = document.getElementById('presLightbox');
      if (dlg && dlg.open) return;
      if (e.key === 'ArrowLeft') goToPresident(neighborId(-1), -1, false);
      if (e.key === 'ArrowRight') goToPresident(neighborId(1), 1, false);
    });

    window.addEventListener('popstate', function () {
      var id = resolveId();
      if (!id) return;
      var i = orderedIds.indexOf(id);
      var cur = orderedIds.indexOf(currentId);
      var dir = 0;
      if (i >= 0 && cur >= 0) dir = i > cur ? 1 : i < cur ? -1 : 0;
      goToPresident(id, dir, true);
    });
  }

  function showProfile(id, pres, artifacts, pending, dir) {
    var firstPaint = !profilePainted;
    var missing = document.getElementById('presMissing');
    var profile = document.getElementById('presProfile');
    if (missing) missing.hidden = true;
    if (profile) {
      if (firstPaint) {
        profile.classList.add('is-pending');
        profile.classList.remove('is-in');
      }
      profile.hidden = false;
    }
    profilePainted = true;

    var display = document.getElementById('presDisplay');
    if (display) display.textContent = headingName(pres);

    var yearsEl = document.getElementById('presYears');
    if (yearsEl) {
      yearsEl.textContent = pres.years || '';
      yearsEl.hidden = !pres.years;
    }

    var photo = document.getElementById('presPhoto');
    if (photo) {
      photo.src = pres.photo || photoUrl(pres.file || id + '.jpg');
      photo.alt = headingName(pres);
      photo.onerror = function () {
        photo.onerror = null;
        photo.src = photoUrl(pres.file || id + '.jpg');
      };
    }

    currentId = id;
    currentPresident = pres;
    currentArtifacts = artifacts || [];
    setText('presRealName', headingName(pres));
    setText('presNickname', pres.nickname);
    paintHistory(pres.biography);
    updateNavChrome();
    if (!firstPaint) playSlide(dir);

    document.title = headingName(pres) + ' — Sulyap Lasalyano';

    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      var yearsBit = pres.years ? ' (' + pres.years + ')' : '';
      meta.setAttribute(
        'content',
        headingName(pres) +
          yearsBit +
          ' — Presidents’ Memorabilia profile at Sulyap Lasalyano.'
      );
    }

    buildMasonry(id, pres, artifacts, pending);
    revealPresBoot();
    if (!firstPaint) return;
    afterPageTx(function () {
      if (prefersReducedMotion()) {
        var ready = document.getElementById('presProfile');
        if (ready) {
          ready.classList.remove('is-pending');
          ready.classList.add('is-in');
        }
        return;
      }
      requestAnimationFrame(playProfileEnter);
    });
  }

  function mergePresident(id, row) {
    var fallback = PRESIDENTS[id] || {
      display: text(row && row.name) || id,
      file: id + '.jpg',
      years: ''
    };
    if (!row) {
      return {
        display: fallback.display,
        fullName: fallback.fullName || fallback.display,
        nickname: fallback.nickname || '',
        file: fallback.file,
        years: fallback.years,
        photo: photoUrl(fallback.file),
        realName: fallback.fullName || '',
        biography: '',
        catalogId: null
      };
    }
    return {
      display: fallback.display,
      fullName: text(row.name) || fallback.fullName || fallback.display,
      nickname: fallback.nickname || '',
      file: fallback.file,
      years: text(row.service) || fallback.years,
      photo: remoteUrl(row.photo_url) || photoUrl(fallback.file),
      realName: text(row.name) || fallback.fullName || '',
      biography: text(row.biography),
      catalogId: row.id
    };
  }

  function artifactsFor(pres, rows) {
    var owner = normalizeName(pres.realName);
    return (rows || []).filter(function (row) {
      if (pres.catalogId != null && row.president_id === pres.catalogId) return true;
      return owner && normalizeName(row.owner_name) === owner;
    });
  }

  function getJson(url) {
    return fetch(url, { credentials: 'omit', mode: 'cors', cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    });
  }

  function catalogPayload(id) {
    return {
      president: findCatalogPresident(id),
      presidents: catalogCache.presidents,
      artifacts: catalogCache.artifacts
    };
  }

  function loadCatalog(id) {
    if (catalogCache) return Promise.resolve(catalogPayload(id));
    if (catalogPromise) {
      return catalogPromise.then(function () { return catalogPayload(id); });
    }
    var prefix = catalogPrefix();
    catalogPromise = Promise.all([
      getJson(prefix + '/catalog/presidents'),
      getJson(prefix + '/catalog/artifacts?limit=' + CATALOG_LIMIT + '&sort=id')
    ]).then(function (pair) {
      var presidents = Array.isArray(pair[0]) ? pair[0] : [];
      var artifacts = Array.isArray(pair[1]) ? pair[1] : [];
      catalogCache = { presidents: presidents, artifacts: artifacts };
      buildOrderedIds(presidents);
      return catalogCache;
    }).catch(function (err) {
      catalogPromise = null;
      throw err;
    });
    return catalogPromise.then(function () { return catalogPayload(id); });
  }

  function bindSpotlight() {
    var shell = document.querySelector('.pres-shell');
    var spot = shell && shell.querySelector('.pres-spotlight');
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePtr = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!shell || !spot || !finePtr || reduced) return;

    var sx = 50, sy = 42, spotRaf = 0;
    function paintSpot() {
      spotRaf = 0;
      spot.style.setProperty('--sx', sx.toFixed(2) + '%');
      spot.style.setProperty('--sy', sy.toFixed(2) + '%');
    }
    shell.addEventListener('pointermove', function (e) {
      var r = shell.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      sx = ((e.clientX - r.left) / r.width) * 100;
      sy = ((e.clientY - r.top) / r.height) * 100;
      if (!spotRaf) spotRaf = requestAnimationFrame(paintSpot);
    }, { passive: true });
    shell.addEventListener('pointerenter', function () { shell.classList.add('is-lit'); });
    shell.addEventListener('pointerleave', function () { shell.classList.remove('is-lit'); });
  }

  function init() {
    bindLightboxChrome();
    bindSearch();
    bindPresidentNav();
    bindSpotlight();
    buildOrderedIds([]);

    var backBtn = document.getElementById('presBack');
    if (backBtn) {
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goBack();
      });
    }

    var id = resolveId();
    currentId = id;
    try { history.replaceState({ pres: id }, '', location.href); } catch (err) {}
    window.setTimeout(function () {
      if (bootRevealed) return;
      revealPresBoot();
    }, 2800);

    document.addEventListener('langchange', function () {
      if (!currentPresident) return;
      var display = document.getElementById('presDisplay');
      if (display) display.textContent = headingName(currentPresident);
      setText('presRealName', headingName(currentPresident));
      setText('presNickname', currentPresident.nickname);
      paintHistory(currentPresident.biography);
      itemTiles.forEach(translateItemTile);
      var empty = document.getElementById('presEmpty');
      if (empty && !empty.hidden) {
        var emptyKey = empty.getAttribute('data-i');
        if (emptyKey) empty.textContent = t(emptyKey, empty.textContent);
      }
      var searchInput = document.getElementById('presSearchInput');
      if (searchInput) {
        searchInput.setAttribute('aria-label', t('pres.searchLabel', 'Search memorabilia'));
        searchInput.placeholder = t('pres.searchPh', 'Search code, title, description, or tags');
      }
      if (searchQuery) applySearch(searchQuery, false);
      updateNavChrome();
    });

    if (!id) {
      showMissing();
      return;
    }

    if (PRESIDENTS[id]) {
      showProfile(id, mergePresident(id, null), [], true);
    }

    loadCatalog(id)
      .then(function (cat) {
        if (!cat.president && !PRESIDENTS[id]) {
          showMissing();
          return;
        }
        var pres = mergePresident(id, cat.president);
        showProfile(id, pres, artifactsFor(pres, cat.artifacts), false);
      })
      .catch(function () {
        if (PRESIDENTS[id]) {
          showProfile(id, mergePresident(id, null), [], false);
          return;
        }
        showMissing();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
