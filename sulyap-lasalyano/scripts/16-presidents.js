/* President profile — data-driven by ?id= / /presidents/:slug / #hash */
(function () {
  var FALLBACK = '/';
  var PHOTO_V = '3';
  var MEMORY_V = '2';
  var TILE_COUNT = 7;

  /**
   * Slugs match assets/presidents/<slug>.jpg filenames.
   * years: presidential terms from backend catalog_seed / supabase seed
   * (en-dash ranges). br-mawel maps to the 2004–2008 catalog slot
   * (legal name there: Br. Narciso S. Erguiza, FSC).
   */
  var PRESIDENTS = {
    'br-inigo': { display: 'Br. Inigo', file: 'br-inigo.jpg', years: '2024–present' },
    'br-andrew': { display: 'Br. Andrew', file: 'br-andrew.jpg', years: '1999–2001' },
    'br-armin': { display: 'Br. Armin', file: 'br-armin.jpg', years: '2008–2010' },
    'br-donato': { display: 'Br. Donato', file: 'br-donato.jpg', years: '1987–1994' },
    'br-gus': { display: 'Br. Gus', file: 'br-gus.jpg', years: '1994–1999' },
    'br-mawel': { display: 'Br. Mawel', file: 'br-mawel.jpg', years: '2004–2008' },
    'br-rolly': { display: 'Br. Rolly', file: 'br-rolly.jpg', years: '2001–2004' },
    'br-sockie': { display: 'Br. Sockie', file: 'br-sockie.jpg', years: '2019–2024' },
    'dr-quebengco': { display: 'Dr. Quebengco', file: 'dr-quebengco.jpg', years: '2010–2016' }
  };

  /** Shared filler pool — local campus + memorabilia-style assets (not Unsplash). */
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
    /* Own portrait once, then distinct fillers — never repeat the same src. */
    var own = {
      src: photoUrl(currentPres.file),
      alt: currentPres.display
    };
    var rand = mulberry32(hashSeed(currentId + ':memories'));
    var fillers = shuffle(pool, rand).slice(0, Math.max(0, TILE_COUNT - 1));
    var tiles = [own].concat(fillers);
    /* Stable per-president order of remaining tiles after the lead portrait. */
    var lead = tiles[0];
    var rest = shuffle(tiles.slice(1), mulberry32(hashSeed(currentId + ':order')));
    return [lead].concat(rest);
  }

  function goBack() {
    /* Skip splash curtain; home plays in-anim on return / bfcache. */
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

  function closeLightbox() {
    var dlg = document.getElementById('presLightbox');
    if (!dlg || !dlg.open) return;
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    if (lightboxLastFocus && typeof lightboxLastFocus.focus === 'function') {
      try { lightboxLastFocus.focus(); } catch (e) {}
    }
    lightboxLastFocus = null;
  }

  function openLightbox(src, alt) {
    var dlg = document.getElementById('presLightbox');
    var img = document.getElementById('presLightboxImg');
    var caption = document.getElementById('presLightboxCaption');
    var closeBtn = document.getElementById('presLightboxClose');
    if (!dlg || !img) return;
    lightboxLastFocus = document.activeElement;
    img.src = src;
    img.alt = alt || '';
    if (caption) {
      caption.textContent = t(
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
    /* Magpantay: dimmed stage is zoom-out; photo chrome stays interactive. */
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
  }

  function buildMasonry(id, pres) {
    var grid = document.getElementById('presMasonry');
    if (!grid) return;
    grid.innerHTML = '';

    var tiles = buildMemoryPool(id, pres);

    tiles.forEach(function (item, i) {
      var shape = SHAPE_CYCLE[i % SHAPE_CYCLE.length];
      var fig = document.createElement('figure');
      fig.className = 'pres-masonry-item pres-masonry-item--' + shape;
      fig.setAttribute('role', 'listitem');
      fig.tabIndex = 0;
      fig.setAttribute('aria-label', t('pres.lightboxOpen', 'View photo'));

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
      grid.appendChild(fig);
    });
  }

  function showMissing() {
    var missing = document.getElementById('presMissing');
    var profile = document.getElementById('presProfile');
    if (missing) missing.hidden = false;
    if (profile) profile.hidden = true;
    document.title = t('pres.missing', 'President not found.') + ' — Sulyap Lasalyano';
  }

  function showProfile(id, pres) {
    var missing = document.getElementById('presMissing');
    var profile = document.getElementById('presProfile');
    if (missing) missing.hidden = true;
    if (profile) profile.hidden = false;

    var display = document.getElementById('presDisplay');
    if (display) display.textContent = pres.display;

    var yearsEl = document.getElementById('presYears');
    if (yearsEl) {
      yearsEl.textContent = pres.years || '';
      yearsEl.hidden = !pres.years;
    }

    var photo = document.getElementById('presPhoto');
    if (photo) {
      photo.src = photoUrl(pres.file);
      photo.alt = pres.display;
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

    buildMasonry(id, pres);
  }

  function init() {
    bindLightboxChrome();

    var backBtn = document.getElementById('presBack');
    if (backBtn) {
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goBack();
      });
    }

    var id = resolveId();
    var pres = id && PRESIDENTS[id];
    if (!pres) {
      showMissing();
      return;
    }
    showProfile(id, pres);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
