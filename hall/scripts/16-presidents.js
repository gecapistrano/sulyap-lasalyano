/* President profile — catalog-backed by ?id= / /presidents/:slug / #hash */
(function () {
  var FALLBACK = '/';
  var PHOTO_V = '3';
  var MEMORY_V = '2';
  var TILE_COUNT = 7;
  var CATALOG_LIMIT = 2000;

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
    'br-inigo': { display: 'Br. Inigo', file: 'br-inigo.jpg', years: '2024–present' },
    'br-andrew': { display: 'Br. Andrew', file: 'br-andrew.jpg', years: '1999–2001' },
    'br-armin': { display: 'Br. Armin', file: 'br-armin.jpg', years: '2008–2010' },
    'br-donato': { display: 'Br. Donato', file: 'br-donato.jpg', years: '1987–1994' },
    'br-gus': { display: 'Br. Gus', file: 'br-gus.jpg', years: '1994–1999' },
    'br-mawel': { display: 'Br. Mawel', file: 'br-mawel.jpg', years: '2016–2019' },
    'br-rolly': { display: 'Br. Rolly', file: 'br-rolly.jpg', years: '2001–2004' },
    'br-sockie': { display: 'Br. Sockie', file: 'br-sockie.jpg', years: '2019–2024' },
    'dr-quebengco': { display: 'Dr. Quebengco', file: 'dr-quebengco.jpg', years: '2010–2016' }
  };

  var CAMPUS_FILLERS = [
    { src: '/assets/aeairc-building.jpg', alt: 'AEAIRC campus building' },
    { src: '/assets/sulyap-mark.png', alt: 'Sulyap Lasalyano mark' },
    { src: '/assets/sulyap-logo.png', alt: 'Sulyap Lasalyano logo' },
    { src: '/assets/museum-gallery.svg', alt: 'Museum gallery illustration' }
  ];

  var SHAPE_CYCLE = ['tall', 'wide', 'portrait', 'landscape', 'square', 'short', 'portrait'];

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

  function assetUrl(src) {
    var sep = src.indexOf('?') >= 0 ? '&' : '?';
    return src + sep + 'v=' + MEMORY_V;
  }

  function remoteUrl(value) {
    var url = text(value);
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function artifactPhoto(row) {
    var hosted = remoteUrl(row && row.image_url);
    if (hosted) return hosted;
    var code = text(row && (row.id_code || row.rd_code));
    if (!code) return '';
    return catalogPrefix() + '/catalog/artifacts/id/' + encodeURIComponent(code) + '/photo';
  }

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function buildMemoryPool(currentId, currentPres) {
    var pool = [];
    Object.keys(PRESIDENTS).forEach(function (slug) {
      if (slug === currentId) return;
      var p = PRESIDENTS[slug];
      pool.push({
        src: photoUrl(p.file),
        alt: p.display
      });
    });
    CAMPUS_FILLERS.forEach(function (item) {
      pool.push({
        src: assetUrl(item.src),
        alt: item.alt
      });
    });
    var own = {
      src: currentPres.photo || photoUrl(currentPres.file || currentId + '.jpg'),
      alt: currentPres.display
    };
    var rand = mulberry32(hashSeed(currentId + ':memories'));
    var fillers = shuffle(pool, rand).slice(0, Math.max(0, TILE_COUNT - 1));
    var tiles = [own].concat(fillers);
    var lead = tiles[0];
    var rest = shuffle(tiles.slice(1), mulberry32(hashSeed(currentId + ':order')));
    return [lead].concat(rest);
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

  function openLightbox(src, alt) {
    var dlg = document.getElementById('presLightbox');
    var img = document.getElementById('presLightboxImg');
    var caption = document.getElementById('presLightboxCaption');
    var closeBtn = document.getElementById('presLightboxClose');
    if (!dlg || !img) return;
    if (lightboxClosing) finishLightboxClose(dlg);
    dlg.classList.remove('is-closing');
    lightboxLastFocus = document.activeElement;
    img.src = src;
    img.alt = alt || '';
    if (caption) {
      caption.textContent = alt || t(
        'pres.lightboxCaption',
        '[Short memory description — placeholder]'
      );
    }
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
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
      if (e.key === 'Escape') closeLightbox();
    });
    window.__slBackStack = window.__slBackStack || [];
    window.__slBackStack.push(function () {
      var dlg = document.getElementById('presLightbox');
      if (!dlg || !dlg.open) return false;
      closeLightbox();
      return true;
    });
  }

  function catalogTiles(artifacts) {
    var tiles = [];
    (artifacts || []).forEach(function (row) {
      var src = artifactPhoto(row);
      if (!src) return;
      tiles.push({
        src: src,
        alt: text(row.title) || text(row.id_code) || 'Artifact'
      });
    });
    return tiles;
  }

  function buildMasonry(id, pres, artifacts) {
    var grid = document.getElementById('presMasonry');
    if (!grid) return;
    grid.innerHTML = '';

    var tiles = catalogTiles(artifacts);
    if (!tiles.length) tiles = buildMemoryPool(id, pres);

    tiles.forEach(function (item, i) {
      var shape = SHAPE_CYCLE[i % SHAPE_CYCLE.length];
      var fig = document.createElement('figure');
      fig.className = 'pres-masonry-item pres-masonry-item--' + shape;
      fig.setAttribute('role', 'listitem');
      fig.tabIndex = 0;
      fig.setAttribute('aria-label', item.alt || t('pres.lightboxOpen', 'View photo'));

      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt || '';
      img.width = 640;
      img.height = shape === 'wide' || shape === 'landscape' || shape === 'short' ? 400 : 800;
      img.decoding = 'async';
      if (i === 0) img.fetchPriority = 'high';
      else img.loading = 'lazy';

      function openThis() {
        openLightbox(item.src, item.alt || '');
      }
      fig.addEventListener('click', openThis);
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openThis();
        }
      });

      fig.appendChild(img);
      if (item.alt) {
        var cap = document.createElement('figcaption');
        cap.className = 'pres-masonry-cap';
        cap.textContent = item.alt;
        fig.appendChild(cap);
      }
      grid.appendChild(fig);
    });
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
    el.textContent = next || el.textContent;
    if (hideEmpty) el.hidden = !next;
  }

  function showProfile(id, pres, artifacts) {
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
    if (display) display.textContent = pres.display;

    var yearsEl = document.getElementById('presYears');
    if (yearsEl) {
      yearsEl.textContent = pres.years || '';
      yearsEl.hidden = !pres.years;
    }

    var photo = document.getElementById('presPhoto');
    if (photo) {
      photo.src = pres.photo || photoUrl(pres.file || id + '.jpg');
      photo.alt = pres.display;
      photo.onerror = function () {
        photo.onerror = null;
        photo.src = photoUrl(pres.file || id + '.jpg');
      };
    }

    if (pres.realName) setText('presRealName', pres.realName);
    if (pres.biography) {
      var history = document.getElementById('presHistory');
      if (history) history.textContent = pres.biography;
    }

    document.title = pres.display + ' — Sulyap Lasalyano';

    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      var yearsBit = pres.years ? ' (' + pres.years + ')' : '';
      meta.setAttribute(
        'content',
        pres.display +
          yearsBit +
          ' — Presidents’ Memorabilia profile at Sulyap Lasalyano.'
      );
    }

    buildMasonry(id, pres, artifacts);
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
        file: fallback.file,
        years: fallback.years,
        photo: photoUrl(fallback.file),
        realName: '',
        biography: '',
        catalogId: null
      };
    }
    return {
      display: fallback.display,
      file: fallback.file,
      years: text(row.service) || fallback.years,
      photo: remoteUrl(row.photo_url) || photoUrl(fallback.file),
      realName: text(row.name),
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

  function loadCatalog(id) {
    var prefix = catalogPrefix();
    return Promise.all([
      getJson(prefix + '/catalog/presidents'),
      getJson(prefix + '/catalog/artifacts?limit=' + CATALOG_LIMIT + '&sort=id')
    ]).then(function (pair) {
      var presidents = Array.isArray(pair[0]) ? pair[0] : [];
      var artifacts = Array.isArray(pair[1]) ? pair[1] : [];
      var match = presidents.filter(function (row) {
        return slugifyPresident(row.name) === id;
      })[0] || null;
      return { president: match, artifacts: artifacts };
    });
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
    bindSpotlight();

    var backBtn = document.getElementById('presBack');
    if (backBtn) {
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goBack();
      });
    }

    var id = resolveId();
    window.setTimeout(function () {
      if (bootRevealed) return;
      revealPresBoot();
    }, 2800);

    if (!id) {
      showMissing();
      return;
    }

    if (PRESIDENTS[id]) {
      showProfile(id, mergePresident(id, null), []);
    }

    loadCatalog(id)
      .then(function (cat) {
        if (!cat.president && !PRESIDENTS[id]) {
          showMissing();
          return;
        }
        var pres = mergePresident(id, cat.president);
        showProfile(id, pres, artifactsFor(pres, cat.artifacts));
      })
      .catch(function () {
        if (PRESIDENTS[id]) {
          if (!profilePainted) showProfile(id, mergePresident(id, null), []);
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
