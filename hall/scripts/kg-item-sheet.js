/**
 * Knowledge Graph item overlay — Live Scan sheet layout over the constellation.
 * Opens on memorabilia (and president) click; closes without leaving the graph.
 */
import { createModelStage } from './scan/model-stage.js?v=14'
import { catalogModelSrc } from './catalog-models.js?v=2'

export function createItemSheet(opts) {
  var t = opts.t || function (_k, fallback) { return fallback; };
  var prefixOf = opts.prefixOf || function () { return ''; };
  var presidentOf = opts.presidentOf || function () { return null; };
  var onOpen = opts.onOpen || function () {};
  var onClose = opts.onClose || function () {};

  var overlay = document.getElementById('kgItemOverlay');
  var stageHost = document.getElementById('kgItemStage');
  var sheet = document.getElementById('kgItemSheet');
  var toggle = document.getElementById('kgItemToggle');
  var codeEl = document.getElementById('kgItemCode');
  var nameEl = document.getElementById('kgItemName');
  var photoEl = document.getElementById('kgItemPhoto');
  var presEl = document.getElementById('kgItemPresident');
  var yearEl = document.getElementById('kgItemYear');
  var descEl = document.getElementById('kgItemDesc');
  var histSection = document.getElementById('kgItemHistorySection');
  var histEl = document.getElementById('kgItemHistory');
  var backBtn = document.getElementById('kgBack');
  var titleCode = document.querySelector('.kg-title-code');
  var titleRest = document.querySelector('.kg-title-rest');
  if (!overlay || !sheet) {
    return { openArtifact: function () {}, openPresident: function () {}, close: function () {}, isOpen: function () { return false; } };
  }

  var open = false;
  var expanded = false;
  var loadGen = 0;
  var modelStage = null;
  var modelGen = 0;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (ev) {
    reduced = ev.matches;
  });

  function setText(el, value) {
    if (!el) return;
    el.textContent = value == null ? '' : String(value);
  }

  function peekHeight() {
    var cs = getComputedStyle(sheet);
    return parseFloat(cs.getPropertyValue('--sheet-peek')) || 82;
  }

  function openHeight() {
    var cs = getComputedStyle(sheet);
    var raw = cs.getPropertyValue('--sheet-open').trim();
    var parsed = parseFloat(raw);
    if (parsed) return parsed;
    return Math.min(window.innerHeight * 0.72, window.innerHeight - 148);
  }

  function setSheetHeight(px, dragging) {
    sheet.classList.toggle('is-dragging', !!dragging);
    if (px == null) sheet.style.removeProperty('--sheet-h');
    else sheet.style.setProperty('--sheet-h', Math.round(px) + 'px');
  }

  function syncToggle() {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      expanded ? t('scan.collapseDetails', 'Hide details') : t('scan.expandDetails', 'Show details')
    );
    toggle.setAttribute('data-i-label', expanded ? 'scan.collapseDetails' : 'scan.expandDetails');
  }

  function expand() {
    expanded = true;
    document.body.classList.add('is-item-sheet-open');
    setSheetHeight(null, false);
    syncToggle();
    if (modelStage) modelStage.setExpanded(true);
  }

  function collapse() {
    expanded = false;
    document.body.classList.remove('is-item-sheet-open');
    setSheetHeight(null, false);
    syncToggle();
    if (modelStage) modelStage.setExpanded(false);
  }

  function ensureStage() {
    if (modelStage || !stageHost) return modelStage;
    modelStage = createModelStage(stageHost);
    return modelStage;
  }

  function showModel(url) {
    var src = String(url || '').trim();
    var gen = (modelGen += 1);
    if (!src) {
      if (stageHost) stageHost.hidden = true;
      if (modelStage) modelStage.show({});
      return;
    }
    if (!stageHost) return;
    stageHost.hidden = false;
    ensureStage();
    if (modelStage && modelStage.setExpanded) modelStage.setExpanded(expanded);
    window.requestAnimationFrame(function () {
      if (gen !== modelGen || !modelStage) return;
      if (modelStage.resize) modelStage.resize();
      modelStage.show({ modelUrl: src });
    });
  }

  function setPhoto(src, alt) {
    if (!photoEl) return;
    var url = String(src || '').trim();
    if (!url) {
      photoEl.hidden = true;
      photoEl.removeAttribute('src');
      return;
    }
    photoEl.hidden = false;
    photoEl.alt = alt || '';
    photoEl.src = url;
  }

  function catalogPhotoSrc(code, image) {
    var c = String(code || '').trim();
    if (c) return prefixOf() + '/catalog/artifacts/id/' + encodeURIComponent(c) + '/photo';
    return String(image || '').trim();
  }

  function paint(fields) {
    var code = fields.code || '';
    var name = fields.name || t('scan.unknownItem', 'Unknown item');
    setText(codeEl, code);
    if (codeEl) codeEl.hidden = !code;
    setText(nameEl, name);
    setText(presEl, fields.president || '');
    if (presEl) presEl.hidden = !fields.president;
    setText(yearEl, fields.year || '');
    if (yearEl) yearEl.hidden = !fields.year;
    setText(descEl, fields.description || '');
    var hist = fields.history || '';
    setText(histEl, hist);
    if (histSection) histSection.hidden = !hist;
    setPhoto(fields.photo, name);
    if (titleCode) {
      titleCode.textContent = code ? '- ' + code : (fields.titleBit ? '- ' + fields.titleBit : '');
      titleCode.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (titleRest) titleRest.setAttribute('aria-hidden', open ? 'true' : 'false');
    if (backBtn) {
      backBtn.setAttribute('aria-label', open ? t('kg.closeItem', 'Close item') : t('kg.backLabel', 'Go back'));
      backBtn.setAttribute('data-i-label', open ? 'kg.closeItem' : 'kg.backLabel');
    }
  }

  function showOverlay() {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-item-open');
    collapse();
    overlay.classList.remove('is-out');
    void overlay.offsetWidth;
    overlay.classList.add('is-in');
    open = true;
    onOpen();
    syncToggle();
  }

  function hideOverlay() {
    if (!open) return;
    open = false;
    loadGen += 1;
    overlay.classList.remove('is-in');
    overlay.classList.add('is-out');
    document.body.classList.remove('is-item-sheet-open');
    collapse();
    if (titleCode) {
      titleCode.textContent = '';
      titleCode.setAttribute('aria-hidden', 'true');
    }
    if (titleRest) titleRest.setAttribute('aria-hidden', 'false');
    if (backBtn) {
      backBtn.setAttribute('aria-label', t('kg.backLabel', 'Go back'));
      backBtn.setAttribute('data-i-label', 'kg.backLabel');
    }
    onClose();
    window.setTimeout(function () {
      if (open) return;
      document.body.classList.remove('is-item-open');
      overlay.hidden = true;
      overlay.classList.remove('is-out');
      overlay.setAttribute('aria-hidden', 'true');
      setPhoto('', '');
      showModel('');
    }, reduced ? 0 : 320);
  }

  function getJson(url) {
    return fetch(url, { credentials: 'omit', mode: 'cors', cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    });
  }

  function openArtifact(node) {
    if (!node) return;
    var code = String(node.rdCode || '').trim();
    var pres = presidentOf(node.presidentId);
    var fields = {
      code: code,
      name: node.label || node.name || code,
      president: (pres && (pres.displayName || pres.label)) || '',
      year: node.year || '',
      description: node.description || t('scan.loadingCatalogDetails', 'Loading catalog details…'),
      history: '',
      photo: catalogPhotoSrc(code, node.image),
    };
    showOverlay();
    paint(fields);
    showModel(catalogModelSrc(node.modelFile || '', code));
    if (!code) return;
    var gen = (loadGen += 1);
    getJson(prefixOf() + '/catalog/artifacts/id/' + encodeURIComponent(code))
      .then(function (row) {
        if (gen !== loadGen || !open) return;
        var owner = (row && row.owner_name) || fields.president;
        paint({
          code: (row && row.id_code) || code,
          name: (row && row.title) || fields.name,
          president: owner,
          year: (row && (row.year_acquired || row.year)) || fields.year,
          description: (row && row.description) || '',
          history: '',
          photo: catalogPhotoSrc((row && row.id_code) || code, (row && row.image_url) || node.image),
        });
        showModel(catalogModelSrc((row && row.model_url) || node.modelFile || '', (row && row.id_code) || code));
      })
      .catch(function () {
        if (gen !== loadGen || !open) return;
        if (!node.description) {
          paint(Object.assign({}, fields, {
            description: t('scan.noCatalogFor', 'No published catalog record found for {code}.').replace('{code}', code),
          }));
        }
      });
  }

  function openPresident(node) {
    if (!node) return;
    var fields = {
      code: '',
      name: node.displayName || node.label || '',
      president: node.shortLabel || '',
      year: [node.termStart, node.termEnd].filter(Boolean).join(' – '),
      description: node.biography || t('scan.loadingCatalogDetails', 'Loading catalog details…'),
      history: '',
      photo: node.photo || '',
      titleBit: node.shortLabel || node.label || '',
    };
    showOverlay();
    paint(fields);
    showModel('');
    var gen = (loadGen += 1);
    getJson(prefixOf() + '/catalog/presidents')
      .then(function (rows) {
        if (gen !== loadGen || !open || !Array.isArray(rows)) return;
        var hit = rows.find(function (row) {
          return String(row.name || '') === String(node.displayName || node.label || '');
        });
        if (!hit) return;
        paint({
          code: '',
          name: hit.name || fields.name,
          president: node.shortLabel || '',
          year: hit.service || fields.year,
          description: hit.biography || '',
          history: '',
          photo: node.photo || hit.photo_url || '',
          titleBit: node.shortLabel || hit.name || '',
        });
      })
      .catch(function () {});
  }

  function close() {
    hideOverlay();
  }

  if (toggle) {
    toggle.addEventListener('click', function (e) {
      if (e.detail) return;
      if (!open) return;
      if (expanded) collapse();
      else expand();
    });
  }

  if (sheet) {
    var drag = null;
    var peekEl = sheet.querySelector('.kg-sheet__peek');
    function onStart(clientY) {
      if (!open) return;
      drag = {
        startY: clientY,
        lastY: clientY,
        fromOpen: expanded,
        peek: peekHeight(),
        open: openHeight(),
        moved: 0,
      };
      setSheetHeight(drag.fromOpen ? drag.open : drag.peek, true);
    }
    function onMove(clientY) {
      if (!drag) return;
      var dy = clientY - drag.startY;
      drag.moved = Math.max(drag.moved, Math.abs(dy));
      drag.lastY = clientY;
      var next = Math.min(drag.open, Math.max(drag.peek, (drag.fromOpen ? drag.open : drag.peek) - dy));
      setSheetHeight(next, true);
    }
    function onEnd() {
      if (!drag) return;
      var info = drag;
      drag = null;
      var current = parseFloat(sheet.style.getPropertyValue('--sheet-h')) || (info.fromOpen ? info.open : info.peek);
      var span = Math.max(80, info.open - info.peek);
      var progress = (current - info.peek) / span;
      var tap = info.moved < 12;
      if (tap) {
        setSheetHeight(null, false);
        if (info.fromOpen) collapse();
        else expand();
        return;
      }
      if (progress >= 0.42) expand();
      else collapse();
    }
    ;[toggle, peekEl].forEach(function (el) {
      if (!el) return;
      el.addEventListener('touchstart', function (e) {
        if (e.touches[0]) onStart(e.touches[0].clientY);
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        if (e.touches[0]) onMove(e.touches[0].clientY);
      }, { passive: true });
      el.addEventListener('touchend', function () { onEnd(); });
      el.addEventListener('mousedown', function (e) {
        onStart(e.clientY);
        var move = function (ev) { onMove(ev.clientY); };
        var up = function () {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          onEnd();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function (e) {
      if (!open) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }, true);
  }

  window.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    openArtifact: openArtifact,
    openPresident: openPresident,
    close: close,
    isOpen: function () { return open; },
  };
}
