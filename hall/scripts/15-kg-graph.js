/* Knowledge Graph — 3D constellation (orbit / pan / zoom / select / layouts). */
import * as THREE from 'three';
import { buildCatalogGraph } from './catalog-graph.mjs?v=4';
import { createItemSheet } from './kg-item-sheet.js?v=11';
import { catalogModelSrc } from './catalog-models.js?v=4';
import { CATALOG_GLB_CODES } from './catalog-glb-ids.js?v=2';
import { loadCatalogGlb, prepareCatalogMaterials } from './scan/model-stage.js?v=17';

(function () {
  var GRAPH_URL = '/public/data/graph.json';
  var CATALOG_LIMIT = 2000;
  var DARK_KEY = 'sl_darkMode';
  var WIDE_MQ = '(min-width:720px)';
  var ARTIFACT_LABEL_DIST = 110;
  var ZOOM_STEP = 1.28;
  var MIN_DIST = 55;
  var MAX_DIST = 3200;
  var FONT_BODY = 'Instrument Sans, ui-sans-serif, system-ui, sans-serif';
  var FONT_MONO = 'IBM Plex Mono, ui-monospace, Menlo, monospace';
  var FONT_SERIF = 'Cormorant Garamond, Georgia, serif';
  var SHORT_NAME = {
    'br-inigo': 'Br. Iñigo',
    'br-andrew': 'Br. Andrew',
    'br-armin': 'Br. Armin',
    'br-donato': 'Br. Donato',
    'br-gus': 'Br. Gus',
    'br-mawel': 'Br. Mawel',
    'br-rolly': 'Br. Rolly',
    'br-sockie': 'Br. Sockie',
    'dr-quebengco': 'Dr. Quebengco'
  };
  var PREFIX_COLOR = {
    AG: '#86efac',
    XAG: '#bbf7d0',
    RD: '#e8d48a',
    RDI: '#7dc0a0',
    AB: '#e8a0a8',
    FDR: '#c4a484',
    IR: '#9ad7c2'
  };
  var PILL = {
    category: { stroke: '#7dc0a0', fillDark: '#0e281c', fillLight: '#e8f2ec' },
    era: { stroke: '#e8d48a', fillDark: '#281e0e', fillLight: '#f7f4ef' },
    event: { stroke: '#c45b6a', fillDark: '#280e14', fillLight: '#f7ecec' },
    place: { stroke: '#c4a484', fillDark: '#281e18', fillLight: '#f7f4ef' }
  };

  var el = document.getElementById('kgGraph');
  var statusEl = document.getElementById('kgStatus');
  if (!el) return;

  capDevicePixelRatio(2);

  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var wideMQ = matchMedia(WIDE_MQ);
  var reduced = reducedMQ.matches;
  var layout = 'web';
  var Graph = null;
  var nodes = [];
  var links = [];
  var byId = {};
  var photos = {};
  var artTextures = {};
  var artCounts = {};
  var hoverId = null;
  var selectedId = null;
  var didFit = false;
  var PRES_KEEP = 34;
  var PRES_KEEP_TIMELINE = 50;
  var yearFitTimer = 0;
  var yearPlayTimer = 0;
  var yearOutTimer = 0;
  var yearRailRaf = 0;
  var fitGen = 0;
  var revealTimer = 0;
  var yearRailUserArmed = false;
  var yearRailDismissed = false;
  var yearRailMovedEarly = false;
  var yearRailSide = 'right';
  var yearControlsBound = false;
  var itemSheet = null;
  var camSnap = null;
  var graphControlsOn = true;
  var glbScenes = {};
  var glbFailed = {};
  var glbLoading = {};
  var glbQueue = [];
  var glbActive = 0;
  var glbPaused = false;
  var glbAttached = 0;
  var GLB_CONCURRENCY = 2;
  var GLB_SIZE_RANK = {};
  (Array.isArray(CATALOG_GLB_CODES) ? CATALOG_GLB_CODES : []).forEach(function (code, i) {
    GLB_SIZE_RANK[String(code || '').trim().toUpperCase()] = i;
  });

  function t(key, fallback) {
    if (typeof window.pmLookup === 'function') {
      var v = window.pmLookup(key);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return fallback;
  }

  function setStatus(key) {
    if (!statusEl) return;
    statusEl.dataset.i = key;
    statusEl.textContent = t(key, key);
    statusEl.hidden = key === 'kg.status';
  }

  function hideBoot() {
    var boot = document.getElementById('kgBoot');
    if (typeof window.slFinishLoadbar === 'function') window.slFinishLoadbar(boot);
    document.body.classList.remove('is-booting');
    if (!boot || boot.classList.contains('is-done')) return;
    boot.classList.add('is-done');
    window.setTimeout(function () {
      boot.hidden = true;
    }, reduced ? 0 : 560);
  }

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function isDark() {
    return !isLight();
  }

  function capDevicePixelRatio(max) {
    try {
      var desc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      var read = function () {
        if (desc && typeof desc.get === 'function') return desc.get.call(window);
        return Number(desc && desc.value) || 1;
      };
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        enumerable: true,
        get: function () { return Math.min(read() || 1, max); }
      });
    } catch (e) { /* ignore */ }
  }

  function relationOf(link) {
    return link && link.relation ? link.relation : '';
  }

  function isSuccession(link) {
    return relationOf(link) === 'succeeded by';
  }

  function slugOf(node) {
    return String(node && node.id || '').replace(/^pres:/, '');
  }

  function shortName(node) {
    return node.shortLabel || SHORT_NAME[slugOf(node)] || (node.displayName || node.label || '').split(',')[0];
  }

  function rdPrefix(node) {
    return String(node.rdCode || '').replace(/[0-9]+$/g, '') || '';
  }

  function hashHue(str) {
    var h = 0, i;
    for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  function artifactColor(node) {
    var cat = String(node.category || '').trim();
    if (cat) {
      var hue = 90 + (hashHue(cat.toLowerCase()) % 80);
      return 'hsl(' + hue + ', 42%, 62%)';
    }
    return PREFIX_COLOR[rdPrefix(node)] || '#c4a484';
  }

  function hexToRgb(color) {
    if (color.charAt(0) === '#') {
      return [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16)
      ];
    }
    var m = color.match(/hsl\((\d+)/);
    if (m) {
      var h = Number(m[1]) / 360, s = 0.42, l = 0.62;
      var a = s * Math.min(l, 1 - l);
      var f = function (n) {
        var k = (n + h * 12) % 12;
        return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
      };
      return [f(0), f(8), f(4)];
    }
    return [196, 164, 132];
  }

  function loadPhoto(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var img = new Image();
      img.decoding = 'async';
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function drawCover(ctx, img, cx, cy, r) {
    var iw = img.naturalWidth || img.width || 1;
    var ih = img.naturalHeight || img.height || 1;
    var s = Math.max((r * 2) / iw, (r * 2) / ih);
    ctx.drawImage(img, cx - (iw * s) / 2, cy - (ih * s) / 2, iw * s, ih * s);
  }

  function canvasTexture(canvas) {
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function spriteFromTexture(tex, w, h, opts) {
    opts = opts || {};
    var mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest !== false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(w, h, 1);
    sprite.renderOrder = opts.renderOrder || 0;
    if (opts.centerY != null) sprite.center.set(0.5, opts.centerY);
    return sprite;
  }

  function presidentCanvas(node, focused) {
    var size = 256;
    var labelH = 52;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size + labelH;
    var ctx = c.getContext('2d');
    var cx = size / 2;
    var cy = size / 2;
    var r = size / 2 - 10;
    var img = photos[node.id];
    var gold = '#C4A484';

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      drawCover(ctx, img, cx, cy, r);
    } else {
      ctx.fillStyle = isDark() ? '#163024' : '#dce8e0';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = gold;
      ctx.font = '600 72px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName(node).replace(/^(Br\.|Dr\.)\s+/i, '').slice(0, 2).toUpperCase(), cx, cy);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = focused ? 10 : 6;
    ctx.stroke();
    if (focused) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(196,164,132,.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '600 28px ' + FONT_BODY;
    ctx.fillStyle = isDark() ? 'rgba(247,244,239,.94)' : 'rgba(18,32,24,.9)';
    ctx.fillText(shortName(node), cx, size - 4);
    return c;
  }

  function artifactTexture(color, focused) {
    var key = color + (focused ? ':f' : '') + (isDark() ? ':d' : ':l');
    if (artTextures[key]) return artTextures[key];
    var s = 64;
    var c = document.createElement('canvas');
    c.width = c.height = s;
    var ctx = c.getContext('2d');
    var rgb = hexToRgb(color);
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,' + (focused ? 0.95 : 0.7) + ')');
    g.addColorStop(0.22, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)');
    g.addColorStop(0.55, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.35)');
    g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    artTextures[key] = canvasTexture(c);
    return artTextures[key];
  }

  function pillCanvas(node) {
    var spec = PILL[node.type] || PILL.category;
    var text = node.label || node.name || node.id;
    if (text.length > 22) text = text.slice(0, 20) + '…';
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    ctx.font = '600 28px ' + FONT_MONO;
    var w = Math.ceil(ctx.measureText(text).width) + 48;
    var h = 56;
    c.width = w;
    c.height = h;
    ctx.font = '600 28px ' + FONT_MONO;
    roundRectPath(ctx, 1.5, 1.5, w - 3, h - 3, h / 2);
    ctx.fillStyle = isDark() ? spec.fillDark : spec.fillLight;
    ctx.fill();
    ctx.strokeStyle = spec.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isDark() ? 'rgba(247,244,239,.9)' : 'rgba(18,32,24,.88)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    return c;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function textSprite(text, font, color, scaleW) {
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    ctx.font = font;
    var w = Math.ceil(ctx.measureText(text).width) + 16;
    c.width = w;
    c.height = 40;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 20);
    var sprite = spriteFromTexture(canvasTexture(c), scaleW || (w * 0.08), 3.2);
    sprite.center.set(0.5, 1);
    sprite.position.set(0, -2.2, 0);
    return sprite;
  }

  var artHitGeomWeb = null;
  var artHitGeomTl = null;
  var artHitMat = null;
  function artifactHitMesh() {
    if (!artHitMat) {
      artHitMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
        depthTest: false,
      });
    }
    if (layout === 'timeline') {
      if (!artHitGeomTl) artHitGeomTl = new THREE.SphereGeometry(14, 10, 8);
    } else if (!artHitGeomWeb) {
      artHitGeomWeb = new THREE.SphereGeometry(11, 10, 8);
    }
    var hit = new THREE.Mesh(layout === 'timeline' ? artHitGeomTl : artHitGeomWeb, artHitMat);
    hit.userData.kgHit = true;
    return hit;
  }

  function artifactVisual(node, focused) {
    var size = layout === 'timeline'
      ? (focused ? 10 : 7.2)
      : (focused ? 8 : 5.4);
    var sprite = spriteFromTexture(artifactTexture(artifactColor(node), focused), size, size, {
      renderOrder: 2,
      depthTest: true
    });
    sprite.userData.kgSprite = true;
    return sprite;
  }

  function artifactGlbUrl(node) {
    if (!node || node.type !== 'artifact') return '';
    return catalogModelSrc(node.modelFile || '', node.rdCode);
  }

  function artifactGlbSize(focused) {
    if (layout === 'timeline') return focused ? 11 : 8.4;
    return focused ? 8.2 : 6.2;
  }

  function fitNodeModel(object, target) {
    var box = new THREE.Box3().setFromObject(object);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    object.scale.multiplyScalar(target / maxDim);
    object.position.sub(center.multiplyScalar(target / maxDim));
  }

  function fittedGlbClone(template, size) {
    var obj = template.clone(true);
    obj.userData.catalogAlbedoCanvases = template.userData && template.userData.catalogAlbedoCanvases;
    prepareCatalogMaterials(obj);
    obj.traverse(function (child) {
      if (child.isLight) child.visible = false;
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    fitNodeModel(obj, size);
    obj.userData.kgGlb = true;
    return obj;
  }

  function stripArtifactVisuals(group) {
    if (!group || !group.children) return;
    var i;
    var child;
    for (i = group.children.length - 1; i >= 0; i--) {
      child = group.children[i];
      if (child.userData && child.userData.kgHit) continue;
      group.remove(child);
    }
  }

  var glbRefreshTimer = 0;
  function scheduleGlbRefresh() {
    window.clearTimeout(glbRefreshTimer);
    glbRefreshTimer = window.setTimeout(function () {
      if (Graph && typeof Graph.nodeThreeObject === 'function') Graph.nodeThreeObject(buildNode);
    }, 160);
  }

  function attachGlbToNode(node, url) {
    var template = glbScenes[url];
    var group = node && node.__threeObj;
    if (!template) return false;
    if (!group) {
      scheduleGlbRefresh();
      return false;
    }
    var focused = node.id === hoverId || node.id === selectedId;
    stripArtifactVisuals(group);
    group.add(fittedGlbClone(template, artifactGlbSize(focused)));
    if (!node.__glbReady) {
      node.__glbReady = true;
      glbAttached += 1;
    }
    return true;
  }

  function maxGraphGlbs() {
    /* Do not auto-load all 58 HQ files. Overlay still loads the clicked item in full. */
    return wideMQ.matches ? 28 : 16;
  }

  function pumpGlbQueue() {
    if (glbPaused) return;
    while (glbActive < GLB_CONCURRENCY && glbQueue.length && glbAttached < maxGraphGlbs()) {
      loadNextGlb(glbQueue.shift());
    }
  }

  function loadNextGlb(job) {
    if (!job || !job.url) return;
    if (glbScenes[job.url]) {
      attachGlbToNode(job.node, job.url);
      pumpGlbQueue();
      return;
    }
    if (glbFailed[job.url]) {
      pumpGlbQueue();
      return;
    }
    glbActive += 1;
    glbLoading[job.url] = true;
    loadCatalogGlb(job.url).then(function (scene) {
      glbActive = Math.max(0, glbActive - 1);
      delete glbLoading[job.url];
      if (!scene) {
        glbFailed[job.url] = true;
        pumpGlbQueue();
        return;
      }
      glbScenes[job.url] = scene;
      nodes.forEach(function (n) {
        if (artifactGlbUrl(n) === job.url) attachGlbToNode(n, job.url);
      });
      pumpGlbQueue();
    }).catch(function () {
      glbActive = Math.max(0, glbActive - 1);
      delete glbLoading[job.url];
      glbFailed[job.url] = true;
      pumpGlbQueue();
    });
  }

  function queueArtifactModels() {
    var pending = [];
    nodes.forEach(function (n) {
      var url = artifactGlbUrl(n);
      if (!url || glbFailed[url] || n.__glbReady) return;
      pending.push({
        node: n,
        url: url,
        rank: GLB_SIZE_RANK[String(n.rdCode || '').trim().toUpperCase()],
      });
    });
    pending.sort(function (a, b) {
      var ar = a.rank == null ? 1000 : a.rank;
      var br = b.rank == null ? 1000 : b.rank;
      return ar - br;
    });
    pending.forEach(function (job) {
      if (glbScenes[job.url]) {
        attachGlbToNode(job.node, job.url);
        return;
      }
      if (glbLoading[job.url]) return;
      var queued = glbQueue.some(function (item) { return item.url === job.url; });
      if (!queued) glbQueue.push(job);
    });
    pumpGlbQueue();
  }

  function buildNode(node) {
    var focused = node.id === hoverId || node.id === selectedId;
    var group = new THREE.Group();
    var sprite;

    if (node.type === 'president') {
      var pc = presidentCanvas(node, focused);
      var presW = layout === 'timeline' ? 64 : 42;
      sprite = spriteFromTexture(canvasTexture(pc), presW, presW * (pc.height / pc.width), {
        renderOrder: 40,
        depthTest: false,
        centerY: 1 - (128 / pc.height)
      });
      group.renderOrder = 40;
      group.add(sprite);
    } else if (node.type === 'artifact') {
      var glbUrl = artifactGlbUrl(node);
      var glbTemplate = glbUrl ? glbScenes[glbUrl] : null;
      if (glbTemplate) {
        group.add(fittedGlbClone(glbTemplate, artifactGlbSize(focused)));
        node.__glbReady = true;
      } else {
        group.add(artifactVisual(node, focused));
      }
      group.add(artifactHitMesh());
      node.__label = null;
    } else if (node.type === 'collection') {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var ctx = c.getContext('2d');
      ctx.beginPath();
      ctx.arc(64, 64, 44, 0, Math.PI * 2);
      ctx.fillStyle = isDark() ? 'rgba(14,40,28,.4)' : 'rgba(0,112,60,.12)';
      ctx.fill();
      ctx.strokeStyle = isDark() ? 'rgba(196,164,132,.45)' : 'rgba(111,78,55,.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      sprite = spriteFromTexture(canvasTexture(c), 22, 22, { renderOrder: 5, depthTest: true });
      group.add(sprite);
      var label = textSprite(
        node.place || 'AEA-IRC',
        'italic 500 28px ' + FONT_SERIF,
        isDark() ? 'rgba(201,184,164,.7)' : 'rgba(61,46,34,.7)',
        14
      );
      label.position.set(0, -12, 0);
      group.add(label);
    } else {
      var pill = pillCanvas(node);
      sprite = spriteFromTexture(canvasTexture(pill), 28, 28 * (pill.height / pill.width), {
        renderOrder: 8,
        depthTest: false
      });
      group.add(sprite);
    }

    node.__threeRoot = group;
    return group;
  }

  function ensureArtifactLabel(node) {
    if (node.__label || !node.__threeRoot) return;
    var text = node.rdCode || node.label || '';
    if (text.length > 28) text = text.slice(0, 26) + '…';
    var label = textSprite(
      text,
      '500 24px ' + FONT_BODY,
      isDark() ? 'rgba(232,244,236,.9)' : 'rgba(18,32,24,.86)',
      Math.min(22, 6 + text.length * 0.55)
    );
    label.position.set(0, -4.2, 0);
    node.__threeRoot.add(label);
    node.__label = label;
  }

  var labelRaf = 0;
  function updateArtifactLabels() {
    if (labelRaf) return;
    labelRaf = requestAnimationFrame(paintArtifactLabels);
  }

  function paintArtifactLabels() {
    labelRaf = 0;
    if (!Graph) return;
    var cam = Graph.camera();
    if (!cam) return;
    var cp = cam.position;
    var i, n, d, show;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.type !== 'artifact') continue;
      d = Math.hypot(cp.x - n.x, cp.y - n.y, cp.z - (n.z || 0));
      show = n.id === hoverId || n.id === selectedId || d < ARTIFACT_LABEL_DIST;
      if (show) {
        ensureArtifactLabel(n);
        if (n.__label) n.__label.visible = true;
      } else if (n.__label) {
        n.__label.visible = false;
      }
    }
  }

  function isReceived(link) {
    return relationOf(link) === 'received';
  }

  function linkColor(link) {
    if (isSuccession(link)) return isDark() ? 'rgba(196,164,132,.9)' : 'rgba(146,112,72,.85)';
    if (isReceived(link)) return isDark() ? 'rgba(125,192,160,.42)' : 'rgba(0,112,60,.38)';
    if (relationOf(link) === 'houses') return isDark() ? 'rgba(46,155,95,.18)' : 'rgba(0,112,60,.22)';
    return 'rgba(0,0,0,0)';
  }

  function linkWidth(link) {
    if (isSuccession(link)) return 1.35;
    if (isReceived(link)) return 0.55;
    return 0.4;
  }

  function linkVisible(link) {
    var rel = relationOf(link);
    return rel === 'succeeded by' || rel === 'received' || rel === 'houses';
  }

  function nodeOf(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return byId[ref] || null;
    if (ref.id && byId[ref.id]) return byId[ref.id];
    return ref;
  }

  function nodeIdOf(ref) {
    if (!ref) return '';
    if (typeof ref === 'string') return ref;
    return ref.id || '';
  }

  function isPresNode(node) {
    if (!node) return false;
    if (node.type === 'president') return true;
    return String(nodeIdOf(node)).indexOf('pres:') === 0;
  }

  function presKeep() {
    return layout === 'timeline' ? PRES_KEEP_TIMELINE : PRES_KEEP;
  }

  function isFocusedNode(node) {
    return !!(node && (node.id === hoverId || node.id === selectedId));
  }

  function presDiscKeepout() {
    var w = layout === 'timeline' ? 64 : 42;
    // Portrait circle is 118px in a 256px canvas, plus the gold stroke.
    return w * (121 / 256) + 0.35;
  }

  function artifactKeepout(node) {
    var focused = isFocusedNode(node);
    if (node && node.__glbReady) return artifactGlbSize(focused) * 0.48 + 0.2;
    var size = layout === 'timeline'
      ? (focused ? 10 : 7.2)
      : (focused ? 8 : 5.4);
    return size * 0.46 + 0.12;
  }

  function linkKeepout(node) {
    if (!node) return 1.1;
    if (isPresNode(node)) return presDiscKeepout();
    if (node.type === 'collection' || String(nodeIdOf(node)).indexOf('col:') === 0) return 11.2;
    if (node.type === 'artifact' || String(nodeIdOf(node)).indexOf('art:') === 0) return artifactKeepout(node);
    return 6;
  }

  function trimLinkCoords(coords, link) {
    var src = nodeOf(link.source);
    var tgt = nodeOf(link.target);
    var ax = coords.start.x, ay = coords.start.y || 0, az = coords.start.z || 0;
    var bx = coords.end.x, by = coords.end.y || 0, bz = coords.end.z || 0;
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    var len = Math.hypot(dx, dy, dz) || 1;
    var a = linkKeepout(src);
    var b = linkKeepout(tgt);
    var need = a + b;
    if (need + 1.2 >= len) {
      var scale = Math.max(0, (len - 1.2) / Math.max(need, 0.001));
      a *= scale;
      b *= scale;
    }
    coords.start.x = ax + dx * (a / len);
    coords.start.y = ay + dy * (a / len);
    coords.start.z = az + dz * (a / len);
    coords.end.x = bx - dx * (b / len);
    coords.end.y = by - dy * (b / len);
    coords.end.z = bz - dz * (b / len);
    return coords;
  }

  function writeLineEndpoints(line, coords) {
    var geo = line && line.geometry;
    var attr = geo && geo.getAttribute && geo.getAttribute('position');
    if (!attr || !attr.array || attr.array.length < 6) return;
    attr.array[0] = coords.start.x;
    attr.array[1] = coords.start.y || 0;
    attr.array[2] = coords.start.z || 0;
    attr.array[3] = coords.end.x;
    attr.array[4] = coords.end.y || 0;
    attr.array[5] = coords.end.z || 0;
    attr.needsUpdate = true;
  }

  function buildLink(link) {
    if (!linkVisible(link)) {
      var empty = new THREE.Group();
      empty.visible = false;
      return empty;
    }
    var succession = isSuccession(link);
    var received = isReceived(link);
    var mat = new THREE.LineBasicMaterial({
      color: succession ? 0xc4a484 : 0x7dc0a0,
      transparent: true,
      opacity: succession
        ? (isDark() ? 0.9 : 0.82)
        : received
          ? (isDark() ? 0.38 : 0.42)
          : (isDark() ? 0.22 : 0.28),
      depthTest: true,
      depthWrite: false
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    var line = new THREE.Line(geo, mat);
    line.renderOrder = 1;
    line.frustumCulled = false;
    return line;
  }

  function findLine(obj) {
    if (!obj) return null;
    if (obj.type === 'Line') return obj;
    if (obj.geometry && obj.geometry.getAttribute) return obj;
    if (obj.children && obj.children.length) {
      var i, found;
      for (i = 0; i < obj.children.length; i++) {
        found = findLine(obj.children[i]);
        if (found) return found;
      }
    }
    return obj;
  }

  function positionTrimmedLink(obj, coords, link) {
    trimLinkCoords(coords, link);
    if (obj) {
      if (obj.position) obj.position.set(0, 0, 0);
      if (obj.rotation) obj.rotation.set(0, 0, 0);
      if (obj.scale) obj.scale.set(1, 1, 1);
    }
    writeLineEndpoints(findLine(obj), coords);
    return true;
  }

  function rebuildArtCounts() {
    artCounts = {};
    nodes.forEach(function (n) {
      if (n.type === 'artifact' && n.presidentId) {
        artCounts[n.presidentId] = (artCounts[n.presidentId] || 0) + 1;
      }
    });
  }

  function shellRadius(presId) {
    var n = artCounts[presId] || 1;
    var inner = presKeep() + 16;
    var grow = layout === 'timeline' ? 4.2 : 2.6;
    var cap = layout === 'timeline' ? 118 : 68;
    return Math.min(cap, inner + Math.sqrt(n) * grow);
  }

  function seedArtifacts() {
    var buckets = {};
    var group, p, i, n, R, inner, t, ang, rad, px, py, pz, zAmp;
    var golden = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach(function (node) {
      if (node.type !== 'artifact' || !node.presidentId) return;
      (buckets[node.presidentId] = buckets[node.presidentId] || []).push(node);
    });
    Object.keys(buckets).forEach(function (id) {
      p = byId[id];
      if (!p) return;
      group = buckets[id];
      R = shellRadius(id);
      inner = presKeep() + 16;
      px = p.fx != null ? p.fx : p.x || 0;
      py = p.fy != null ? p.fy : p.y || 0;
      pz = p.fz != null ? p.fz : p.z || 0;
      zAmp = layout === 'timeline' ? R * 0.42 : R * 0.22;
      for (i = 0; i < group.length; i++) {
        n = group[i];
        t = (i + 0.5) / group.length;
        ang = golden * i;
        rad = inner + (R - inner) * Math.sqrt(t);
        n.x = px + Math.cos(ang) * rad;
        n.y = py + Math.sin(ang) * rad;
        n.z = pz + Math.sin(ang * 1.7 + t * 4) * zAmp;
        if (layout === 'timeline') {
          n.fx = n.x;
          n.fy = n.y;
          n.fz = n.z;
        }
        n.vx = 0;
        n.vy = 0;
        n.vz = 0;
      }
    });
  }

  function seedWeb() {
    var presidents = nodes.filter(function (n) { return n.type === 'president'; })
      .sort(function (a, b) { return Number(a.termStart) - Number(b.termStart); });
    var i, p, ang;
    var count = Math.max(presidents.length, 1);
    for (i = 0; i < presidents.length; i++) {
      p = presidents[i];
      ang = (i / count) * Math.PI * 2 - Math.PI / 2;
      p.x = p.fx = Math.cos(ang) * 320;
      p.y = p.fy = Math.sin(ang) * 220;
      p.z = p.fz = Math.sin(ang * 1.35 + 0.4) * 140;
    }
    nodes.forEach(function (n) {
      if (n.type === 'collection') {
        n.x = 0; n.y = 0; n.z = 0;
      }
    });
    seedArtifacts();
  }

  function clearPins() {
    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.fx = undefined;
      n.fy = undefined;
      n.fz = undefined;
    }
  }

  function pinAt(n, x, y, z) {
    n.x = n.fx = x;
    n.y = n.fy = y;
    n.z = n.fz = z;
    n.vx = 0;
    n.vy = 0;
    n.vz = 0;
  }

  function holdGraph(on) {
    if (!el) return;
    el.classList.toggle('is-layout-hold', !!on);
    if (on) el.classList.remove('is-enter');
  }

  function revealHeldGraph() {
    setStatus('kg.status');
    if (!el) {
      hideBoot();
      return;
    }
    if (reduced) {
      el.classList.remove('is-layout-hold', 'is-enter');
      hideBoot();
      return;
    }
    el.classList.remove('is-enter');
    el.classList.add('is-layout-hold');
    void el.offsetWidth;
    el.classList.add('is-enter');
    el.classList.remove('is-layout-hold');
    hideBoot();
  }

  function scheduleReveal(after) {
    window.clearTimeout(revealTimer);
    function go() {
      revealHeldGraph();
      if (typeof after === 'function') after();
    }
    if (reduced) {
      go();
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        revealTimer = window.setTimeout(go, 32);
      });
    });
  }

  function applyLayout(next) {
    if (itemSheet && itemSheet.isOpen()) itemSheet.close();
    layout = next;
    var wide = wideMQ.matches;
    var presidents = nodes.filter(function (n) { return n.type === 'president'; })
      .sort(function (a, b) { return Number(a.termStart) - Number(b.termStart); });
    var col = nodes.find(function (n) { return n.type === 'collection'; });
    var span = Math.max(presidents.length - 1, 1);
    var spread = wide ? 1680 : 1120;
    var i, p, tpos;
    var toTimeline = layout === 'timeline';

    holdGraph(true);
    clearPins();
    if (col) pinAt(col, 0, 0, 0);

    if (toTimeline) {
      for (i = 0; i < presidents.length; i++) {
        p = presidents[i];
        tpos = i / span - 0.5;
        if (wide) pinAt(p, tpos * spread, 40, 0);
        else pinAt(p, 0, tpos * spread, 0);
      }
      if (col) {
        if (wide) pinAt(col, 0, -180, -50);
        else pinAt(col, -160, 0, -50);
      }
      seedArtifacts();
    } else {
      seedWeb();
    }

    syncLayoutButtons();
    clearYearTimers();
    yearRailUserArmed = false;
    yearRailDismissed = false;
    yearRailMovedEarly = false;
    yearRailSide = 'right';
    if (!toTimeline) hideYearRail();
    if (Graph) {
      Graph.nodeThreeObject(buildNode);
      Graph.linkThreeObject(buildLink);
      didFit = true;
      if (toTimeline) {
        if (typeof Graph.d3AlphaTarget === 'function') Graph.d3AlphaTarget(0);
      } else if (typeof Graph.d3ReheatSimulation === 'function') {
        Graph.d3ReheatSimulation();
      }
      fitAll(false, true);
      scheduleReveal(function () {
        if (layout === 'timeline') {
          yearPlayTimer = window.setTimeout(playYearRail, reduced ? 0 : 620);
        }
      });
    } else {
      revealHeldGraph();
    }
  }

  function syncLayoutButtons() {
    var webBtn = document.getElementById('kgLayoutWeb');
    var timeBtn = document.getElementById('kgLayoutTimeline');
    if (webBtn) webBtn.setAttribute('aria-pressed', layout === 'web' ? 'true' : 'false');
    if (timeBtn) timeBtn.setAttribute('aria-pressed', layout === 'timeline' ? 'true' : 'false');
  }

  function clusterForce(alpha) {
    var i, n, p, k, dx, dy, dist, R, inner, f, ux, uy, px, py, pz;
    k = (layout === 'timeline' ? 0.38 : 0.28) * alpha;
    inner = presKeep() + 16;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.type !== 'artifact' || !n.presidentId) continue;
      p = byId[n.presidentId];
      if (!p) continue;
      px = p.x || 0;
      py = p.y || 0;
      pz = p.z || 0;
      dx = n.x - px;
      dy = n.y - py;
      dist = Math.hypot(dx, dy);
      if (dist < 0.001) {
        n.x = px + inner;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      ux = dx / dist;
      uy = dy / dist;
      R = shellRadius(n.presidentId);
      f = (dist - R) * k;
      n.vx -= ux * f;
      n.vy -= uy * f;
      if (dist < inner) {
        f = (inner - dist) * k * 5;
        n.vx += ux * f;
        n.vy += uy * f;
      }
      n.vz += (pz - (n.z || 0)) * k * 0.4;
    }
  }

  function clearYearTimers() {
    if (yearFitTimer) {
      clearTimeout(yearFitTimer);
      yearFitTimer = 0;
    }
    if (yearPlayTimer) {
      clearTimeout(yearPlayTimer);
      yearPlayTimer = 0;
    }
    if (yearOutTimer) {
      clearTimeout(yearOutTimer);
      yearOutTimer = 0;
    }
    if (yearRailRaf) {
      cancelAnimationFrame(yearRailRaf);
      yearRailRaf = 0;
    }
  }

  function startYear(node) {
    return String(node && node.termStart || '').replace(/[^\d]/g, '').slice(0, 4);
  }

  function hideYearRail() {
    clearYearTimers();
    var rail = document.getElementById('kgYearRail');
    if (!rail) return;
    rail.classList.remove('is-on', 'is-out');
    rail.hidden = true;
    rail.innerHTML = '';
  }

  function dissolveYearRail() {
    if (layout !== 'timeline') return;
    if (!yearRailUserArmed) {
      yearRailMovedEarly = true;
      return;
    }
    if (yearRailDismissed) return;
    yearRailDismissed = true;
    yearRailUserArmed = false;
    var rail = document.getElementById('kgYearRail');
    if (!rail || rail.hidden) return;
    var items = rail.querySelectorAll('li');
    var under = rail.classList.contains('kg-year-rail--under');
    var left = rail.classList.contains('kg-year-rail--left');
    var outName = under ? 'kg-year-out-under' : (left ? 'kg-year-out-left' : 'kg-year-out');
    var i, cs;
    for (i = 0; i < items.length; i++) {
      cs = window.getComputedStyle(items[i]);
      items[i].style.animation = 'none';
      items[i].style.animationDelay = '0s';
      items[i].style.opacity = cs.opacity;
      items[i].style.transform = cs.transform;
    }
    rail.classList.remove('is-on');
    void rail.offsetWidth;
    for (i = 0; i < items.length; i++) {
      items[i].style.opacity = '';
      items[i].style.transform = '';
      items[i].style.animation = outName + ' .6s ease-out both';
      items[i].style.animationDelay = '0s';
    }
    rail.classList.add('is-out');
    if (yearRailRaf) {
      cancelAnimationFrame(yearRailRaf);
      yearRailRaf = 0;
    }
    if (reduced) {
      hideYearRail();
      return;
    }
    yearOutTimer = window.setTimeout(function () {
      yearOutTimer = 0;
      hideYearRail();
    }, 720);
  }

  function yearChromeBox(sel) {
    var el = document.querySelector(sel);
    var box = el ? el.getBoundingClientRect() : null;
    if (!box || box.width < 8 || box.height < 8) return null;
    return box;
  }

  function yearColumnHits(colLeft, yearW, pts, box) {
    var colRight, i, y;
    if (!box) return false;
    colRight = colLeft + yearW;
    if (colRight < box.left - 8 || colLeft > box.right + 8) return false;
    for (i = 0; i < pts.length; i++) {
      if (!pts[i]) continue;
      y = pts[i].y;
      if (y > box.top - 10 && y < box.bottom + 10) return true;
    }
    return false;
  }

  function positionYearRail() {
    var rail = document.getElementById('kgYearRail');
    if (!Graph || layout !== 'timeline' || !rail || rail.hidden) return;
    if (typeof Graph.graph2ScreenCoords !== 'function') return;
    var wide = wideMQ.matches;
    var items = rail.querySelectorAll('li');
    var i, node, pt, edge, under, yearW, vw, columnLeft, spineLeft, spineRight, radius, gap;
    var rightCol, leftCol, side, pts, toolsBox, legendBox;
    rail.classList.toggle('kg-year-rail--under', wide);
    pts = [];
    spineLeft = Infinity;
    spineRight = 0;
    yearW = 0;
    for (i = 0; i < items.length; i++) {
      yearW = Math.max(yearW, items[i].offsetWidth || 44);
      node = byId[items[i].dataset.nodeId];
      if (!node) continue;
      pt = Graph.graph2ScreenCoords(node.x || 0, node.y || 0, node.z || 0);
      if (!pt || !isFinite(pt.y) || !isFinite(pt.x)) continue;
      pts[i] = pt;
      edge = Graph.graph2ScreenCoords((node.x || 0) + 32, node.y || 0, node.z || 0);
      radius = (edge && isFinite(edge.x)) ? Math.abs(edge.x - pt.x) : 36;
      if (!isFinite(radius) || radius < 22) radius = 36;
      radius = Math.min(80, radius);
      spineLeft = Math.min(spineLeft, pt.x - radius);
      spineRight = Math.max(spineRight, pt.x + radius);
    }
    if (wide) {
      rail.classList.remove('kg-year-rail--left');
      yearRailSide = 'right';
      for (i = 0; i < items.length; i++) {
        if (!pts[i]) continue;
        node = byId[items[i].dataset.nodeId];
        under = node
          ? Graph.graph2ScreenCoords(node.x || 0, (node.y || 0) - 46, node.z || 0)
          : null;
        items[i].style.left = Math.round(pts[i].x) + 'px';
        items[i].style.top = Math.round((under && isFinite(under.y) ? under.y : pts[i].y + 52)) + 'px';
        items[i].style.right = 'auto';
      }
      return;
    }
    if (!isFinite(spineLeft)) spineLeft = 0;
    vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth || 0;
    gap = 14;
    rightCol = spineRight + gap;
    leftCol = spineLeft - yearW - gap;
    toolsBox = yearChromeBox('.kg-tools');
    legendBox = yearChromeBox('.kg-legend');
    side = yearRailSide === 'left' ? 'left' : 'right';
    if (side === 'right' && (
      yearColumnHits(rightCol, yearW, pts, toolsBox) ||
      yearColumnHits(rightCol, yearW, pts, legendBox)
    )) {
      side = 'left';
    } else if (side === 'left' &&
      !yearColumnHits(rightCol, yearW, pts, toolsBox) &&
      !yearColumnHits(rightCol, yearW, pts, legendBox)
    ) {
      side = 'right';
    }
    columnLeft = side === 'left' ? leftCol : rightCol;
    columnLeft = Math.max(8, Math.min(columnLeft, vw - yearW - 8));
    yearRailSide = side;
    rail.classList.toggle('kg-year-rail--left', side === 'left');
    for (i = 0; i < items.length; i++) {
      if (!pts[i]) continue;
      items[i].style.top = Math.round(pts[i].y) + 'px';
      items[i].style.left = Math.round(columnLeft) + 'px';
      items[i].style.right = 'auto';
    }
  }

  function tickYearRail() {
    if (layout !== 'timeline' || yearRailDismissed) {
      yearRailRaf = 0;
      return;
    }
    positionYearRail();
    yearRailRaf = requestAnimationFrame(tickYearRail);
  }

  function playYearRail() {
    if (layout !== 'timeline' || yearRailMovedEarly || yearRailDismissed) return;
    yearRailUserArmed = true;
    var rail = document.getElementById('kgYearRail');
    if (!rail) return;
    var list = nodes.filter(function (n) { return n.type === 'president'; })
      .sort(function (a, b) { return Number(a.termStart) - Number(b.termStart); });
    var html = '';
    var i, n, year, delay;
    var last = Math.max(list.length - 1, 1);
    for (i = 0; i < list.length; i++) {
      n = list[i];
      year = startYear(n);
      if (!year) continue;
      delay = reduced ? 0 : (i / last) * 2.2;
      html += '<li data-node-id="' + n.id + '" style="animation-delay:' + delay.toFixed(2) + 's">' + year + '</li>';
    }
    rail.innerHTML = html;
    rail.hidden = false;
    rail.style.opacity = '';
    yearRailSide = 'right';
    rail.classList.remove('kg-year-rail--left');
    rail.classList.toggle('kg-year-rail--under', wideMQ.matches);
    positionYearRail();
    rail.classList.remove('is-on', 'is-out');
    void rail.offsetWidth;
    rail.classList.add('is-on');
    if (!yearRailRaf) yearRailRaf = requestAnimationFrame(tickYearRail);
  }

  function nodeCoord(n) {
    return {
      x: n.fx != null ? n.fx : (n.x || 0),
      y: n.fy != null ? n.fy : (n.y || 0),
      z: n.fz != null ? n.fz : (n.z || 0)
    };
  }

  function chromePads(forTimeline) {
    var wide = wideMQ.matches;
    var header = document.querySelector('.kg-chrome');
    var headerH = header ? header.getBoundingClientRect().height : (wide ? 56 : 64);
    if (forTimeline) {
      return {
        padT: Math.ceil(headerH) + (wide ? 48 : 36),
        padB: wide ? 132 : 96,
        padL: wide ? 96 : 40,
        padR: wide ? 120 : 64
      };
    }
    return {
      padT: Math.ceil(headerH) + (wide ? 56 : 40),
      padB: wide ? 72 : 64,
      padL: wide ? 28 : 18,
      padR: wide ? 76 : 52
    };
  }

  function boundsFor(filter, halo) {
    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;
    var minZ = Infinity, maxZ = -Infinity;
    var count = 0, i, n, c;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (filter && !filter(n)) continue;
      c = nodeCoord(n);
      if (!isFinite(c.x) || !isFinite(c.y) || !isFinite(c.z)) continue;
      count += 1;
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    if (!count) return null;
    halo = halo || 0;
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      cz: (minZ + maxZ) / 2,
      dx: (maxX - minX) + halo * 2,
      dy: (maxY - minY) + halo * 2,
      dz: (maxZ - minZ) + halo * 2
    };
  }

  function copyVec(src, fallback) {
    if (src && isFinite(src.x) && isFinite(src.y) && isFinite(src.z)) {
      return { x: src.x, y: src.y, z: src.z };
    }
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }

  function lerpNum(a, b, t) {
    return a + (b - a) * t;
  }

  function snapCamera(pos, look) {
    var camObj = Graph.camera && Graph.camera();
    var controls = Graph.controls && Graph.controls();
    if (camObj) {
      camObj.position.set(pos.x, pos.y, pos.z);
      camObj.up.set(0, 1, 0);
      camObj.lookAt(look.x, look.y, look.z);
    }
    if (controls && controls.target) {
      controls.target.set(look.x, look.y, look.z);
      if (typeof controls.update === 'function') controls.update();
    }
  }

  function stopLibCameraTween(pos, look) {
    if (!Graph || typeof Graph.cameraPosition !== 'function') return;
    try {
      Graph.cameraPosition(pos, look, 0);
    } catch (err) { /* ignore */ }
  }

  function tweenFit(pos, look, ms) {
    var camObj = Graph.camera && Graph.camera();
    var controls = Graph.controls && Graph.controls();
    var gen = (fitGen += 1);
    var fromPos = copyVec(camObj && camObj.position, pos);
    var fromTarget = copyVec(controls && controls.target, look);
    stopLibCameraTween(fromPos, fromTarget);
    if (!camObj || ms <= 0 || reduced) {
      snapCamera(pos, look);
      return;
    }
    var damping = controls && controls.enableDamping;
    var enabled = controls && controls.enabled;
    if (controls) {
      controls.enableDamping = false;
      if ('enabled' in controls) controls.enabled = false;
    }
    var t0 = performance.now();
    function step(now) {
      if (gen !== fitGen) return;
      var t = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - t, 3);
      camObj.position.set(
        lerpNum(fromPos.x, pos.x, e),
        lerpNum(fromPos.y, pos.y, e),
        lerpNum(fromPos.z, pos.z, e)
      );
      camObj.up.set(0, 1, 0);
      var lx = lerpNum(fromTarget.x, look.x, e);
      var ly = lerpNum(fromTarget.y, look.y, e);
      var lz = lerpNum(fromTarget.z, look.z, e);
      if (controls && controls.target) controls.target.set(lx, ly, lz);
      camObj.lookAt(lx, ly, lz);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      snapCamera(pos, look);
      if (controls) {
        if (damping && !reduced) controls.enableDamping = true;
        if ('enabled' in controls) controls.enabled = enabled !== false;
      }
    }
    requestAnimationFrame(step);
  }

  function fitAll(fromUser, instant) {
    if (fromUser) dissolveYearRail();
    if (!Graph) return;
    var wide = wideMQ.matches;
    var cam = Graph.camera && Graph.camera();
    var w = el.clientWidth || 1;
    var h = el.clientHeight || 1;
    var timeline = layout === 'timeline';
    var halo = timeline ? (wide ? 160 : 120) : 70;
    var b = boundsFor(function (n) {
      if (!n || n.type === 'collection') return false;
      return n.type === 'president' || n.type === 'artifact';
    }, halo);
    if (!b) {
      if (typeof Graph.zoomToFit === 'function') {
        Graph.zoomToFit(reduced || instant ? 0 : (fromUser ? 780 : 0), wide ? 24 : 36);
      }
      return;
    }

    var fov = (((cam && cam.fov) || 50) * Math.PI) / 180;
    var vHalf = Math.tan(fov / 2);
    var hHalf = vHalf * (w / Math.max(h, 1));
    var pads = chromePads(timeline);
    var usableW = Math.max(160, w - pads.padL - pads.padR);
    /* Web: 2× top pad keeps the constellation below the header.
       Timeline: extra camera distance leaves a margin around the row. */
    var usableH = timeline
      ? Math.max(160, h - pads.padT - pads.padB)
      : Math.max(160, h - 2 * pads.padT);
    var distW = (b.dx / 2) / Math.max(1e-6, hHalf) * (w / usableW);
    var distH = (b.dy / 2) / Math.max(1e-6, vHalf) * (h / usableH);
    var dist = timeline
      ? (wide ? distW : distH)
      : Math.max(distW, distH);
    dist = Math.max(dist, MIN_DIST);
    if (timeline) dist *= wide ? 1.18 : 1.14;
    dist = Math.min(MAX_DIST, Math.max(MIN_DIST, dist));

    var look = { x: b.cx, y: b.cy, z: b.cz };
    var xBiasPx = (pads.padL - pads.padR) / 2;
    var yBiasPx = (pads.padT - pads.padB) / 2;
    look.x -= dist * hHalf * (xBiasPx / Math.max(w / 2, 1));
    look.y += dist * vHalf * (yBiasPx / Math.max(h / 2, 1));

    var pos = { x: look.x, y: look.y, z: look.z + dist };
    var ms = reduced || instant ? 0 : (fromUser ? 900 : 0);
    tweenFit(pos, look, ms);
  }

  function zoomBy(factor) {
    dissolveYearRail();
    if (!Graph || typeof Graph.cameraPosition !== 'function') return;
    var pos = Graph.cameraPosition();
    var dist = Math.hypot(pos.x, pos.y, pos.z) || 1;
    var next = Math.min(MAX_DIST, Math.max(MIN_DIST, dist / factor));
    var s = next / dist;
    Graph.cameraPosition(
      { x: pos.x * s, y: pos.y * s, z: pos.z * s },
      undefined,
      reduced ? 0 : 280
    );
  }

  function sizeGraph() {
    if (!Graph) return;
    Graph.width(el.clientWidth).height(el.clientHeight);
    var renderer = Graph.renderer && Graph.renderer();
    if (renderer && renderer.setPixelRatio) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
  }

  function configureRenderer() {
    var renderer = Graph.renderer && Graph.renderer();
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ('toneMapping' in renderer) renderer.toneMapping = THREE.NoToneMapping;
    var scene = Graph.scene && Graph.scene();
    if (scene && !scene.userData.kgModelLights) {
      scene.userData.kgModelLights = true;
      scene.add(new THREE.HemisphereLight(0xf4efe6, 0x1c241c, 0.7));
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      var key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(4, 6, 8);
      scene.add(key);
      var fill = new THREE.DirectionalLight(0xc4a484, 0.5);
      fill.position.set(-5, 1.2, -3);
      scene.add(fill);
    }
  }

  function configureControls() {
    var controls = Graph.controls && Graph.controls();
    if (!controls) return;
    if ('enableDamping' in controls) controls.enableDamping = !reduced;
    if ('dampingFactor' in controls) controls.dampingFactor = 0.08;
    if ('screenSpacePanning' in controls) controls.screenSpacePanning = true;
    if ('minDistance' in controls) controls.minDistance = MIN_DIST;
    if ('maxDistance' in controls) controls.maxDistance = MAX_DIST;
    if ('rotateSpeed' in controls) controls.rotateSpeed = 0.65;
    if ('zoomSpeed' in controls) controls.zoomSpeed = 0.85;
    if ('panSpeed' in controls) controls.panSpeed = 0.7;
    if ('enablePan' in controls) controls.enablePan = true;
    if ('enableRotate' in controls) controls.enableRotate = true;
    if ('enableZoom' in controls) controls.enableZoom = true;
    if ('enabled' in controls) controls.enabled = graphControlsOn;
    if (!yearControlsBound && typeof controls.addEventListener === 'function') {
      yearControlsBound = true;
      controls.addEventListener('start', dissolveYearRail);
    }
  }

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem(DARK_KEY, dark ? 'true' : 'false'); } catch (e) {}
    var meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', dark ? '#0a140f' : '#e8f2ec');
    var btn = document.getElementById('kgTheme');
    if (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('data-i-label', dark ? 'kg.themeLight' : 'kg.themeDark');
      btn.setAttribute('aria-label', t(dark ? 'kg.themeLight' : 'kg.themeDark', dark ? 'Switch to light mode' : 'Switch to dark mode'));
    }
    document.dispatchEvent(new CustomEvent('kg-theme', { detail: { dark: dark } }));
    artTextures = {};
    if (Graph) {
      Graph.nodeThreeObject(buildNode);
      Graph.linkThreeObject(buildLink);
      Graph.linkColor(linkColor);
    }
  }

  function bindChrome() {
    var themeBtn = document.getElementById('kgTheme');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        applyTheme(!isDark());
      });
      applyTheme(isDark());
    }
    var webBtn = document.getElementById('kgLayoutWeb');
    var timeBtn = document.getElementById('kgLayoutTimeline');
    if (webBtn) webBtn.addEventListener('click', function () { applyLayout('web'); });
    if (timeBtn) timeBtn.addEventListener('click', function () { applyLayout('timeline'); });
    var zin = document.getElementById('kgZoomIn');
    var zout = document.getElementById('kgZoomOut');
    var fit = document.getElementById('kgFit');
    if (zin) zin.addEventListener('click', function () { zoomBy(ZOOM_STEP); });
    if (zout) zout.addEventListener('click', function () { zoomBy(1 / ZOOM_STEP); });
    if (fit) fit.addEventListener('click', function () { fitAll(true); });
    el.addEventListener('pointerdown', dissolveYearRail);
    el.addEventListener('wheel', dissolveYearRail, { passive: true });
    var legend = document.getElementById('kgLegend');
    if (legend && wideMQ.matches) legend.setAttribute('open', '');
    itemSheet = createItemSheet({
      t: t,
      prefixOf: resolveApiBase,
      presidentOf: function (id) { return byId[id] || null; },
      onOpen: function () {
        camSnap = snapshotCamera();
        setGraphInteractive(false);
      },
      onClose: function () {
        setGraphInteractive(true);
        restoreCamera(camSnap);
      },
    });
  }

  function snapshotCamera() {
    if (!Graph) return null;
    var cam = typeof Graph.camera === 'function' ? Graph.camera() : null;
    var controls = typeof Graph.controls === 'function' ? Graph.controls() : null;
    if (!cam || !cam.position) return null;
    var look = controls && controls.target ? controls.target : null;
    return {
      x: cam.position.x,
      y: cam.position.y,
      z: cam.position.z,
      tx: look ? look.x : 0,
      ty: look ? look.y : 0,
      tz: look ? look.z : 0
    };
  }

  function restoreCamera(snap) {
    if (!snap || !Graph || typeof Graph.cameraPosition !== 'function') return;
    Graph.cameraPosition(
      { x: snap.x, y: snap.y, z: snap.z },
      { x: snap.tx, y: snap.ty, z: snap.tz },
      0
    );
  }

  function setGraphInteractive(on) {
    graphControlsOn = !!on;
    glbPaused = !on;
    if (on) pumpGlbQueue();
    if (!Graph) return;
    if (typeof Graph.enablePointerInteraction === 'function') {
      Graph.enablePointerInteraction(graphControlsOn);
    }
    var controls = Graph.controls && Graph.controls();
    if (controls && 'enabled' in controls) controls.enabled = graphControlsOn;
    if (on) {
      if (typeof Graph.resumeAnimation === 'function') Graph.resumeAnimation();
    } else if (typeof Graph.pauseAnimation === 'function') {
      Graph.pauseAnimation();
    }
  }

  function configureForces() {
    var charge = Graph.d3Force('charge');
    if (charge && charge.strength) {
      charge.strength(function (n) {
        if (n.type === 'artifact') return -7;
        if (n.type === 'president') return -90;
        if (n.type === 'collection') return -24;
        return -40;
      });
      if (charge.distanceMax) charge.distanceMax(70);
    }
    var linkF = Graph.d3Force('link');
    if (linkF) {
      if (linkF.distance) {
        linkF.distance(function (l) {
          var src = nodeOf(l.source);
          if (relationOf(l) === 'received' && src) return shellRadius(src.id);
          if (relationOf(l) === 'succeeded by') return 190;
          if (relationOf(l) === 'houses') return 150;
          return 80;
        });
      }
      if (linkF.strength) {
        linkF.strength(function (l) {
          if (relationOf(l) === 'received') return 0.35;
          if (relationOf(l) === 'succeeded by') return 0.28;
          return 0.12;
        });
      }
    }
    Graph.d3Force('cluster', clusterForce);
    Graph.d3Force('center', null);
    if (Graph.d3VelocityDecay) Graph.d3VelocityDecay(0.34);
    if (Graph.d3AlphaDecay) Graph.d3AlphaDecay(reduced ? 0.08 : 0.022);
    if (Graph.numDimensions) Graph.numDimensions(3);
  }

  function createGraph(host) {
    var ForceGraph3D = window.ForceGraph3D;
    var opts = {
      controlType: 'orbit',
      rendererConfig: {
        alpha: true,
        antialias: wideMQ.matches,
        powerPreference: 'high-performance',
        premultipliedAlpha: false
      }
    };
    if (typeof ForceGraph3D !== 'function') return null;
    try {
      return new ForceGraph3D(host, opts);
    } catch (err) {
      try {
        return ForceGraph3D(opts)(host);
      } catch (err2) {
        return null;
      }
    }
  }

  function startGraph(data) {
    holdGraph(true);
    Graph = createGraph(el);
    if (!Graph) {
      holdGraph(false);
      setStatus('kg.error');
      hideBoot();
      return;
    }
    nodes = (data.nodes || []).map(function (n) { return Object.assign({}, n); });
    links = (data.links || []).map(function (l) { return Object.assign({}, l); });
    byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    rebuildArtCounts();
    seedWeb();

    Graph.backgroundColor('rgba(0,0,0,0)').showNavInfo(false);
    if (typeof Graph.warmupTicks === 'function') Graph.warmupTicks(reduced ? 160 : 100);
    if (typeof Graph.cooldownTicks === 'function') Graph.cooldownTicks(reduced ? 0 : 120);
    if (typeof Graph.cooldownTime === 'function') Graph.cooldownTime(reduced ? 0 : 4500);
    Graph
      .graphData({ nodes: nodes, links: links })
      .nodeId('id')
      .nodeLabel(function () { return null; })
      .enableNodeDrag(false)
      .enablePointerInteraction(true)
      .enableNavigationControls(true)
      .showPointerCursor(true)
      .linkColor(linkColor)
      .linkWidth(0)
      .linkOpacity(1)
      .linkVisibility(linkVisible)
      .linkThreeObject(buildLink)
      .linkThreeObjectExtend(false)
      .linkPositionUpdate(function (obj, coords, link) {
        return positionTrimmedLink(obj, coords, link);
      })
      .nodeThreeObject(buildNode)
      .nodeThreeObjectExtend(false)
      .onNodeHover(function (node) {
        hoverId = node ? node.id : null;
        updateArtifactLabels();
      })
      .onNodeClick(function (node) {
        if (!node) return;
        if (node.type === 'artifact' && itemSheet) {
          itemSheet.openArtifact(node);
          return;
        }
        if (node.type === 'president' && itemSheet) {
          itemSheet.openPresident(node);
        }
      })
      .onBackgroundClick(function () {
        if (itemSheet && itemSheet.isOpen()) return;
      })
      .onEngineTick(updateArtifactLabels);

    configureForces();
    configureRenderer();
    configureControls();
    sizeGraph();
    applyLayout('web');
    try {
      queueArtifactModels();
    } catch (err) {
      /* constellation sprites still work if a model fails to queue */
    }
  }

  bindChrome();

  reducedMQ.addEventListener('change', function () {
    reduced = reducedMQ.matches;
    if (!Graph) return;
    if (typeof Graph.warmupTicks === 'function') Graph.warmupTicks(reduced ? 160 : 100);
    if (typeof Graph.cooldownTicks === 'function') Graph.cooldownTicks(reduced ? 0 : 120);
    if (typeof Graph.cooldownTime === 'function') Graph.cooldownTime(reduced ? 0 : 4500);
    configureControls();
  });
  wideMQ.addEventListener('change', function () {
    var legend = document.getElementById('kgLegend');
    if (legend) {
      if (wideMQ.matches) legend.setAttribute('open', '');
      else legend.removeAttribute('open');
    }
    if (layout === 'timeline') applyLayout('timeline');
  });
  window.addEventListener('resize', function () { sizeGraph(); }, { passive: true });
  document.addEventListener('langchange', function () {
    applyTheme(isDark());
  });

  function resolveApiBase() {
    var cfg = window.SL_KG_CONFIG || window.SL_SCAN_CONFIG || {};
    var base = String(cfg.apiBaseUrl || '').trim().replace(/\/+$/, '');
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

  function getJson(url) {
    return fetch(url, { credentials: 'omit', mode: 'cors', cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    });
  }

  function loadLiveCatalog() {
    var base = resolveApiBase();
    var prefix = base || '';
    return Promise.all([
      getJson(prefix + '/catalog/presidents'),
      getJson(prefix + '/catalog/artifacts?limit=' + CATALOG_LIMIT + '&sort=id')
    ]).then(function (pair) {
      var presidents = pair[0];
      var artifacts = pair[1];
      if (!Array.isArray(presidents) || !Array.isArray(artifacts)) throw new Error('catalog shape');
      if (!presidents.length) throw new Error('empty presidents');
      return buildCatalogGraph(presidents, artifacts, { apiBase: prefix });
    });
  }

  function loadSnapshot() {
    return getJson(GRAPH_URL);
  }

  function pruneToConstellation(data) {
    var keep = { president: 1, artifact: 1 };
    var nodes = (data.nodes || []).filter(function (n) { return keep[n.type]; });
    var ids = {};
    nodes.forEach(function (n) { ids[n.id] = 1; });
    var links = (data.links || []).filter(function (l) {
      var s = typeof l.source === 'string' ? l.source : (l.source && l.source.id);
      var t = typeof l.target === 'string' ? l.target : (l.target && l.target.id);
      return ids[s] && ids[t];
    });
    nodes.forEach(function (n) {
      if (n.type !== 'president') return;
      if (n.photo) return;
      var slug = n.slug || String(n.id || '').replace(/^pres:/, '');
      if (slug) n.photo = '/assets/presidents/' + slug + '.jpg';
    });
    return { nodes: nodes, links: links };
  }

  function preloadPhotos(data) {
    data = pruneToConstellation(data || {});
    var jobs = [];
    (data.nodes || []).forEach(function (n) {
      if (n.type === 'president' && n.photo) {
        jobs.push(loadPhoto(n.photo).then(function (img) {
          if (img) photos[n.id] = img;
        }));
      }
    });
    return Promise.all(jobs).then(function () { return data; });
  }

  loadLiveCatalog()
    .catch(function () { return loadSnapshot(); })
    .then(preloadPhotos)
    .then(startGraph)
    .catch(function () {
      holdGraph(false);
      setStatus('kg.error');
      hideBoot();
    });
})();
