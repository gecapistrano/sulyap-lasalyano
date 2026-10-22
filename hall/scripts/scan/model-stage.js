/**
 * Live Scan 3D result stage — pop-in model, auto-spin, limited orbit + zoom.
 * Catalog GLB only. Empty stage (sparkles) until the model is ready — no catalog photo.
 */
import * as THREE from 'three'
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js'

const MIN_DIST = 1.2
const MAX_DIST = 3.55
const AUTO_SPIN = 0.22
const POP_MS = 420
const IDLE_RESUME_MS = 1400
const PHI_MIN = 0.42
const PHI_MAX = 2.55

function easeOutBack(t) {
  const c = 1.70158
  const x = t - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

function fitObject(object, target = 1.35) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  object.scale.multiplyScalar(target / maxDim)
  object.position.sub(center.multiplyScalar(target / maxDim))
}

function imageToCanvas(img) {
  const w = (img && (img.width || img.videoWidth)) || 0
  const h = (img && (img.height || img.videoHeight)) || 0
  if (!w || !h) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    ctx.drawImage(img, 0, 0)
  } catch {
    return null
  }
  return canvas
}

function canvasTextureFrom(canvas) {
  const tex = new THREE.CanvasTexture(canvas)
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

const UNLIT_VERT = [
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = uv;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}',
].join('\n')

const UNLIT_FRAG = [
  'uniform sampler2D uMap;',
  'varying vec2 vUv;',
  'void main() {',
  '  gl_FragColor = texture2D(uMap, vUv);',
  '}',
].join('\n')

function basicPaint(map) {
  if (!map) {
    const painted = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    painted.userData.catalogPainted = true
    return painted
  }
  const painted = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: UNLIT_VERT,
    fragmentShader: UNLIT_FRAG,
    side: THREE.DoubleSide,
    lights: false,
    fog: false,
    toneMapped: false,
    depthWrite: true,
  })
  painted.userData.catalogPainted = true
  return painted
}

function albedoTexture(mat) {
  const tex = mat && (mat.map || mat.emissiveMap)
  if (!tex) return null
  const canvas = imageToCanvas(tex.image)
  if (canvas) return canvasTextureFrom(canvas)
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.needsUpdate = true
  return tex
}

function paintCatalogMaterial(mat) {
  if (!mat) return basicPaint(null)
  const map = albedoTexture(mat)
  return basicPaint(map)
}

function paintObjectWithCanvases(object, canvases) {
  if (!object) return object
  const list = (canvases || []).filter(Boolean)
  object.userData.catalogAlbedoCanvases = list
  let index = 0
  object.traverse((child) => {
    if (!child.isMesh) return
    if (child.geometry && child.geometry.deleteAttribute) {
      child.geometry.deleteAttribute('color')
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const next = mats.map(() => {
      const canvas = list[index] || list[0] || null
      index += 1
      return basicPaint(canvas ? canvasTextureFrom(canvas) : null)
    })
    child.material = Array.isArray(child.material) ? next : next[0]
  })
  return object
}

function prepareCatalogMaterials(object) {
  if (!object) return object
  const stored = object.userData && object.userData.catalogAlbedoCanvases
  if (stored && stored.length) return paintObjectWithCanvases(object, stored)
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (child.geometry && child.geometry.deleteAttribute) {
      child.geometry.deleteAttribute('color')
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const next = mats.map((mat) => paintCatalogMaterial(mat))
    child.material = Array.isArray(child.material) ? next : next[0]
  })
  return object
}

function readGlbJson(buffer) {
  try {
    const view = new DataView(buffer)
    if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546C67) return null
    const jsonLen = view.getUint32(12, true)
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)))
    const binStart = 20 + jsonLen + 8
    return { json, binStart, buffer }
  } catch {
    return null
  }
}

function glbImageBytes(parsed, imageIndex) {
  const image = parsed && parsed.json && parsed.json.images && parsed.json.images[imageIndex]
  const views = parsed && parsed.json && parsed.json.bufferViews
  if (!image || image.bufferView == null || !views) return null
  const bv = views[image.bufferView]
  if (!bv) return null
  const start = parsed.binStart + (bv.byteOffset || 0)
  return {
    mime: image.mimeType || 'image/jpeg',
    bytes: new Uint8Array(parsed.buffer, start, bv.byteLength).slice(),
  }
}

function albedoImageIndices(json) {
  const textures = (json && json.textures) || []
  const materials = (json && json.materials) || []
  const indices = []
  materials.forEach((mat) => {
    const texi = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture
      ? mat.pbrMetallicRoughness.baseColorTexture.index
      : undefined
    if (texi == null) return
    const src = textures[texi] && textures[texi].source
    if (src != null) indices.push(src)
  })
  if (!indices.length && json && json.images && json.images.length) indices.push(0)
  return indices
}

function decodeBytesToCanvas(bytes, mime) {
  return new Promise((resolve) => {
    const blob = new Blob([bytes], { type: mime || 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = imageToCanvas(img)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

async function canvasesFromGlb(buffer) {
  const parsed = readGlbJson(buffer)
  if (!parsed) return []
  const indices = albedoImageIndices(parsed.json)
  const canvases = []
  for (let i = 0; i < indices.length; i += 1) {
    const image = glbImageBytes(parsed, indices[i])
    if (!image) continue
    const canvas = await decodeBytesToCanvas(image.bytes, image.mime)
    if (canvas) canvases.push(canvas)
  }
  return canvases
}

function disposeObject(object) {
  if (!object) return
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    const mats = child.material
      ? (Array.isArray(child.material) ? child.material : [child.material])
      : []
    mats.forEach((mat) => {
      if (!mat) return
      Object.keys(mat).forEach((key) => {
        const value = mat[key]
        if (value && value.isTexture) value.dispose()
      })
      mat.dispose()
    })
  })
}

const MODEL_CACHE_MAX = 12
const modelBuffers = new Map()

function concatChunks(chunks, total) {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out.buffer
}

async function fetchModelBuffer(url, onProgress) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
  if (!res.ok) throw new Error('model http')
  const total = Number(res.headers.get('content-length') || 0)
  if (!res.body || typeof res.body.getReader !== 'function') {
    const buf = await res.arrayBuffer()
    if (typeof onProgress === 'function') onProgress(1)
    return buf
  }
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.byteLength
      if (total && typeof onProgress === 'function') onProgress(Math.min(0.99, received / total))
    }
  }
  if (typeof onProgress === 'function') onProgress(1)
  return concatChunks(chunks, received)
}

function rememberBuffer(key, buf) {
  if (!key || !buf) return
  modelBuffers.set(key, Promise.resolve(buf))
  while (modelBuffers.size > MODEL_CACHE_MAX) {
    const oldest = modelBuffers.keys().next().value
    if (!oldest || oldest === key) break
    modelBuffers.delete(oldest)
  }
}

export function prefetchModel(url) {
  const key = String(url || '').trim()
  if (!key) return Promise.resolve(null)
  if (modelBuffers.has(key)) return modelBuffers.get(key)
  const job = fetchModelBuffer(key).then((buf) => {
    rememberBuffer(key, buf)
    return buf
  }).catch(() => {
    modelBuffers.delete(key)
    return null
  })
  modelBuffers.set(key, job)
  return job
}

function parseGltfScene(buffer) {
  return new Promise((resolve) => {
    try {
      const loader = new GLTFLoader()
      loader.parse(
        buffer,
        '',
        (gltf) => resolve(gltf.scene || gltf.scenes?.[0] || null),
        () => resolve(null),
      )
    } catch {
      resolve(null)
    }
  })
}

async function parseGltf(buffer) {
  const scene = await parseGltfScene(buffer)
  if (!scene) return null
  const canvases = await canvasesFromGlb(buffer)
  if (canvases.length) return paintObjectWithCanvases(scene, canvases)
  return prepareCatalogMaterials(scene)
}

async function loadGltf(url, onProgress) {
  const key = String(url || '').trim()
  if (!key) return null
  let buf = null
  if (modelBuffers.has(key)) {
    buf = await modelBuffers.get(key)
    if (buf && typeof onProgress === 'function') onProgress(1)
  } else {
    try {
      buf = await fetchModelBuffer(key, onProgress)
    } catch {
      return null
    }
    if (buf) rememberBuffer(key, buf)
  }
  if (!buf) return null
  return parseGltf(buf)
}

function wrap01(v) {
  return v - Math.floor(v)
}

function createSparkleLayer(host, reducedRef) {
  const canvas = document.createElement('canvas')
  canvas.className = 'scan-sparkles'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;'
  host.insertBefore(canvas, host.firstChild)
  const ctx = canvas.getContext('2d', { alpha: true })
  const compact = typeof window !== 'undefined' && window.innerWidth < 720
  const count = compact ? 26 : 38
  const dots = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.55 + Math.random() * 1.25,
    a: 0.12 + Math.random() * 0.2,
    fill: Math.random() > 0.7 ? '232,212,176' : '247,244,239',
    vx: (0.012 + Math.random() * 0.02) * (Math.random() < 0.5 ? -1 : 1),
    vy: (0.006 + Math.random() * 0.014) * (Math.random() < 0.5 ? -1 : 1),
  }))
  let w = 1
  let h = 1
  let dpr = 1

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    w = Math.max(1, host.clientWidth)
    h = Math.max(1, host.clientHeight)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }

  function nudge(dx, dy) {
    if (!(dx || dy)) return
    const nx = dx * 0.00018
    const ny = dy * 0.00018
    for (let i = 0; i < dots.length; i += 1) {
      dots[i].x += nx
      dots[i].y += ny
    }
  }

  function tick(dt) {
    if (!ctx) return
    const reduced = reducedRef()
    if (!reduced && dt > 0) {
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i]
        d.x += d.vx * dt
        d.y += d.vy * dt
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < dots.length; i += 1) {
      const d = dots[i]
      const x = wrap01(d.x) * w
      const y = wrap01(d.y) * h
      ctx.beginPath()
      ctx.fillStyle = `rgba(${d.fill},${d.a})`
      ctx.arc(x, y, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function dispose() {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
  }

  resize()
  tick(0)
  return { resize, tick, nudge, dispose }
}

export function createModelStage(container) {
  if (!container) {
    return { show() {}, setExpanded() {}, resize() {}, dispose() {} }
  }

  const compact = typeof window !== 'undefined' && window.innerWidth < 720
  const renderer = new THREE.WebGLRenderer({
    antialias: !compact,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5))
  renderer.setClearColor(0x000000, 0)
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace
  if ('toneMapping' in renderer) renderer.toneMapping = THREE.NoToneMapping
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.zIndex = '1'
  renderer.domElement.style.touchAction = 'none'

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.12, 40)
  scene.add(new THREE.HemisphereLight(0xf4efe6, 0x1c241c, 0.62))
  scene.add(new THREE.AmbientLight(0xffffff, 0.58))
  const key = new THREE.DirectionalLight(0xffffff, 1.05)
  key.position.set(3.4, 4.2, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.38)
  fill.position.set(-4, 1.2, -2)
  scene.add(fill)
  const rim = new THREE.PointLight(0xc4a484, 0.48, 12)
  rim.position.set(-1.4, 2.2, 2.4)
  scene.add(rim)

  const root = new THREE.Group()
  scene.add(root)

  let object = null
  let loadGen = 0
  let theta = 0.55
  let phi = 1.18
  let radius = 2.35
  let dragging = false
  let lastX = 0
  let lastY = 0
  let pointers = new Map()
  let pinchStart = 0
  let pinchRadius = 0
  let interactingUntil = 0
  let popStart = 0
  let popped = false
  let scaleMul = 1
  let scaleTarget = 1
  let yShift = 0
  let yTarget = 0
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = reducedMQ.matches
  const onReduced = () => { reduced = reducedMQ.matches }
  if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', onReduced)
  else if (reducedMQ.addListener) reducedMQ.addListener(onReduced)
  let raf = 0
  let running = false
  let lastTs = 0
  const sparkles = createSparkleLayer(container, () => reduced)

  function sizeRenderer() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    sparkles.resize()
  }

  function applyCamera() {
    const x = radius * Math.sin(phi) * Math.sin(theta)
    const y = radius * Math.cos(phi)
    const z = radius * Math.sin(phi) * Math.cos(theta)
    camera.position.set(x, y, z)
    camera.lookAt(0, 0.02, 0)
  }

  function attach(next) {
    if (object) {
      root.remove(object)
      disposeObject(object)
    }
    object = next || null
    if (!object) {
      popped = true
      root.scale.setScalar(1)
      return
    }
    fitObject(object)
    root.add(object)
    popped = false
    popStart = performance.now()
    root.scale.setScalar(reduced ? 1 : 0.001)
  }

  async function show({ modelUrl, onProgress } = {}) {
    const gen = (loadGen += 1)
    attach(null)
    const glb = typeof modelUrl === 'string' ? modelUrl.trim() : ''
    if (!glb) return
    const next = await loadGltf(glb, onProgress)
    if (gen !== loadGen) return
    if (next) attach(next)
  }

  function setExpanded(open) {
    scaleTarget = open ? 0.78 : 1
    yTarget = open ? 0.22 : 0
  }

  function onPointerDown(ev) {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    renderer.domElement.setPointerCapture(ev.pointerId)
    if (pointers.size === 2) {
      const pts = [...pointers.values()]
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      pinchRadius = radius
      dragging = false
    } else if (pointers.size === 1) {
      dragging = true
      lastX = ev.clientX
      lastY = ev.clientY
    }
    interactingUntil = performance.now() + IDLE_RESUME_MS
  }

  function onPointerMove(ev) {
    if (!pointers.has(ev.pointerId)) return
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    interactingUntil = performance.now() + IDLE_RESUME_MS
    if (pointers.size >= 2 && pinchStart > 0) {
      const pts = [...pointers.values()]
      const span = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (span > 0) {
        radius = Math.min(MAX_DIST, Math.max(MIN_DIST, pinchRadius * (pinchStart / span)))
      }
      return
    }
    if (!dragging) return
    const dx = ev.clientX - lastX
    const dy = ev.clientY - lastY
    lastX = ev.clientX
    lastY = ev.clientY
    if (!reduced) sparkles.nudge(dx, dy)
    theta -= dx * 0.0075
    phi = Math.min(PHI_MAX, Math.max(PHI_MIN, phi - dy * 0.0075))
  }

  function onPointerUp(ev) {
    pointers.delete(ev.pointerId)
    if (pointers.size < 2) {
      pinchStart = 0
    }
    if (pointers.size === 0) dragging = false
    interactingUntil = performance.now() + IDLE_RESUME_MS
  }

  function onWheel(ev) {
    ev.preventDefault()
    radius = Math.min(MAX_DIST, Math.max(MIN_DIST, radius * (1 + ev.deltaY * 0.0014)))
    interactingUntil = performance.now() + IDLE_RESUME_MS
  }

  function tick(ts) {
    if (!running) return
    raf = requestAnimationFrame(tick)
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016
    lastTs = ts
    if (!reduced && !dragging && pointers.size < 2) {
      theta += AUTO_SPIN * dt
    }
    if (!popped) {
      const t = reduced ? 1 : Math.min(1, (ts - popStart) / POP_MS)
      const eased = easeOutBack(t)
      root.scale.setScalar(Math.max(0.001, eased * scaleMul))
      if (t >= 1) popped = true
    } else {
      scaleMul += (scaleTarget - scaleMul) * 0.12
      yShift += (yTarget - yShift) * 0.12
      root.scale.setScalar(scaleMul)
    }
    root.position.y = yShift
    applyCamera()
    sparkles.tick(reduced ? 0 : dt)
    renderer.render(scene, camera)
  }

  function start() {
    if (running) return
    running = true
    lastTs = 0
    sizeRenderer()
    raf = requestAnimationFrame(tick)
  }

  function stop() {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('pointerleave', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('resize', sizeRenderer)

  start()

  return {
    show,
    setExpanded,
    resize: sizeRenderer,
    dispose() {
      loadGen += 1
      stop()
      window.removeEventListener('resize', sizeRenderer)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      if (object) {
        root.remove(object)
        disposeObject(object)
        object = null
      }
      if (reducedMQ.removeEventListener) reducedMQ.removeEventListener('change', onReduced)
      else if (reducedMQ.removeListener) reducedMQ.removeListener(onReduced)
      sparkles.dispose()
      renderer.dispose()
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    },
  }
}

export { loadGltf as loadCatalogGlb, prepareCatalogMaterials, paintObjectWithCanvases }
