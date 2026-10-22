'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PREFIX_COLOR = {
  AG: '#86efac',
  XAG: '#bbf7d0',
  RD: '#e8d48a',
  RDI: '#7dc0a0',
  AB: '#e8a0a8',
  FDR: '#c4a484',
  IR: '#9ad7c2',
}
const PRES_KEEP = 34
const ZOOM_STEP = 1.28
const MIN_DIST = 55
const MAX_DIST = 3200

function relationOf(link) {
  return link?.relation || ''
}

function isSuccession(link) {
  return relationOf(link) === 'succeeded by'
}

function rdPrefix(node) {
  return String(node?.rdCode || '').replace(/[0-9]+$/g, '') || ''
}

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function artifactColor(node) {
  const cat = String(node?.category || '').trim()
  if (cat) {
    const hue = 90 + (hashHue(cat.toLowerCase()) % 80)
    return `hsl(${hue}, 42%, 62%)`
  }
  return PREFIX_COLOR[rdPrefix(node)] || '#c4a484'
}

function hexToRgb(color) {
  if (color.charAt(0) === '#') {
    return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)]
  }
  const m = color.match(/hsl\((\d+)/)
  if (m) {
    const h = Number(m[1]) / 360
    const s = 0.42
    const l = 0.62
    const a = s * Math.min(l, 1 - l)
    const f = (n) => {
      const k = (n + h * 12) % 12
      return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
    }
    return [f(0), f(8), f(4)]
  }
  return [196, 164, 132]
}

function loadPhoto(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null)
      return
    }
    const img = new Image()
    img.decoding = 'async'
    if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

function spriteFromTexture(tex, w, h, opts = {}) {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest !== false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(w, h, 1)
  sprite.renderOrder = opts.renderOrder || 0
  return sprite
}

function shortName(node) {
  return node.shortLabel || (node.displayName || node.label || '').split(',')[0]
}

function presidentCanvas(node, focused, photo) {
  const size = 256
  const labelH = 52
  const c = document.createElement('canvas')
  c.width = size
  c.height = size + labelH
  const ctx = c.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 10
  const gold = '#C4A484'
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (photo) {
    const iw = photo.naturalWidth || 1
    const ih = photo.naturalHeight || 1
    const s = Math.max((r * 2) / iw, (r * 2) / ih)
    ctx.drawImage(photo, cx - (iw * s) / 2, cy - (ih * s) / 2, iw * s, ih * s)
  } else {
    ctx.fillStyle = '#163024'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = gold
    ctx.font = '600 72px IBM Plex Mono, ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(shortName(node).replace(/^(Br\.|Dr\.)\s+/i, '').slice(0, 2).toUpperCase(), cx, cy)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = gold
  ctx.lineWidth = focused ? 10 : 6
  ctx.stroke()
  ctx.font = '600 28px Instrument Sans, ui-sans-serif, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(247,244,239,.94)'
  ctx.fillText(shortName(node), cx, size - 4)
  return c
}

function artifactTexture(color, focused, cache) {
  const key = `${color}${focused ? ':f' : ''}`
  if (cache[key]) return cache[key]
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const rgb = hexToRgb(color)
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, `rgba(255,255,255,${focused ? 0.95 : 0.7})`)
  g.addColorStop(0.22, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`)
  g.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`)
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  cache[key] = canvasTexture(c)
  return cache[key]
}

function pillCanvas(node) {
  const text = String(node.label || node.name || node.id)
  const label = text.length > 22 ? `${text.slice(0, 20)}…` : text
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = '600 28px IBM Plex Mono, ui-monospace, monospace'
  const w = Math.ceil(ctx.measureText(label).width) + 48
  const h = 56
  c.width = w
  c.height = h
  ctx.font = '600 28px IBM Plex Mono, ui-monospace, monospace'
  ctx.beginPath()
  ctx.roundRect(1.5, 1.5, w - 3, h - 3, h / 2)
  ctx.fillStyle = '#0e281c'
  ctx.fill()
  ctx.strokeStyle = '#7dc0a0'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(247,244,239,.9)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, w / 2, h / 2)
  return c
}

function createGraph(ForceGraph3D, host) {
  const opts = {
    controlType: 'orbit',
    rendererConfig: {
      alpha: true,
      antialias: window.matchMedia('(min-width:720px)').matches,
      powerPreference: 'low-power',
      premultipliedAlpha: false,
    },
  }
  if (typeof ForceGraph3D !== 'function') return null
  try {
    return new ForceGraph3D(host, opts)
  } catch {
    try {
      return ForceGraph3D(opts)(host)
    } catch {
      return null
    }
  }
}

export default function CatalogForceGraph3D({ graph, onSelect, selectedId }) {
  const hostRef = useRef(null)
  const graphRef = useRef(null)
  const stateRef = useRef({
    layout: 'web',
    hoverId: null,
    selectedId: selectedId || null,
    photos: {},
    artTextures: {},
    artCounts: {},
    nodes: [],
    links: [],
    byId: {},
  })

  useEffect(() => {
    stateRef.current.selectedId = selectedId || null
  }, [selectedId])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !graph?.nodes?.length) return undefined
    let cancelled = false
    let Graph = null
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wide = window.matchMedia('(min-width:720px)')

    const state = stateRef.current
    state.nodes = (graph.nodes || []).map((n) => ({ ...n }))
    state.links = (graph.links || []).map((l) => ({ ...l }))
    state.byId = Object.fromEntries(state.nodes.map((n) => [n.id, n]))
    state.artCounts = {}
    state.nodes.forEach((n) => {
      if (n.type === 'artifact' && n.presidentId) {
        state.artCounts[n.presidentId] = (state.artCounts[n.presidentId] || 0) + 1
      }
    })

    function shellRadius(presId) {
      const n = state.artCounts[presId] || 1
      const inner = PRES_KEEP + 8
      const grow = state.layout === 'timeline' ? 1.7 : 2.6
      const cap = state.layout === 'timeline' ? 44 : 68
      return Math.min(cap, inner + Math.sqrt(n) * grow)
    }

    function seedArtifacts() {
      const buckets = {}
      const golden = Math.PI * (3 - Math.sqrt(5))
      state.nodes.forEach((node) => {
        if (node.type !== 'artifact' || !node.presidentId) return
        ;(buckets[node.presidentId] = buckets[node.presidentId] || []).push(node)
      })
      Object.keys(buckets).forEach((id) => {
        const p = state.byId[id]
        if (!p) return
        const group = buckets[id]
        const R = shellRadius(id)
        const inner = PRES_KEEP + 8
        const px = p.fx != null ? p.fx : p.x || 0
        const py = p.fy != null ? p.fy : p.y || 0
        const pz = p.fz != null ? p.fz : p.z || 0
        const zAmp = state.layout === 'timeline' ? R * 0.18 : R * 0.22
        group.forEach((n, i) => {
          const t = (i + 0.5) / group.length
          const ang = golden * i
          const rad = inner + (R - inner) * Math.sqrt(t)
          if (state.layout === 'timeline') {
            n.x = px + Math.cos(ang) * rad * 0.95
            n.y = py + Math.sin(ang) * rad * 0.62
          } else {
            n.x = px + Math.cos(ang) * rad
            n.y = py + Math.sin(ang) * rad
          }
          n.z = pz + Math.sin(ang * 1.7 + t * 4) * zAmp
          n.vx = 0
          n.vy = 0
          n.vz = 0
        })
      })
    }

    function seedWeb() {
      const presidents = state.nodes
        .filter((n) => n.type === 'president')
        .sort((a, b) => Number(a.termStart) - Number(b.termStart))
      const count = Math.max(presidents.length, 1)
      presidents.forEach((p, i) => {
        const ang = (i / count) * Math.PI * 2 - Math.PI / 2
        p.x = p.fx = Math.cos(ang) * 320
        p.y = p.fy = Math.sin(ang) * 220
        p.z = p.fz = Math.sin(ang * 1.35 + 0.4) * 140
      })
      state.nodes.forEach((n) => {
        if (n.type === 'collection') {
          n.x = 0
          n.y = 0
          n.z = 0
          n.fx = 0
          n.fy = 0
          n.fz = 0
        }
      })
      seedArtifacts()
    }

    function clusterForce(alpha) {
      const k = (state.layout === 'timeline' ? 0.38 : 0.28) * alpha
      const inner = PRES_KEEP + 8
      state.nodes.forEach((n) => {
        if (n.type !== 'artifact' || !n.presidentId) return
        const p = state.byId[n.presidentId]
        if (!p) return
        const px = p.x || 0
        const py = p.y || 0
        const pz = p.z || 0
        const dx = n.x - px
        const dy = n.y - py
        const dist = Math.hypot(dx, dy)
        if (dist < 0.001) {
          n.x = px + inner
          n.vx = 0
          n.vy = 0
          return
        }
        const ux = dx / dist
        const uy = dy / dist
        const R = shellRadius(n.presidentId)
        const f = (dist - R) * k
        n.vx -= ux * f
        n.vy -= uy * f
        if (dist < inner) {
          const push = (inner - dist) * k * 5
          n.vx += ux * push
          n.vy += uy * push
        }
        n.vz += (pz - (n.z || 0)) * k * 0.4
      })
    }

    function buildNode(node) {
      const focused = node.id === state.hoverId || node.id === state.selectedId
      const group = new THREE.Group()
      if (node.type === 'president') {
        const canvas = presidentCanvas(node, focused, state.photos[node.id])
        const sprite = spriteFromTexture(canvasTexture(canvas), focused ? 42 : 34, focused ? 50 : 41, {
          renderOrder: 8,
          depthTest: false,
        })
        sprite.center.set(0.5, 0.42)
        group.add(sprite)
      } else if (node.type === 'artifact') {
        const size = focused ? 8 : 5.4
        group.add(
          spriteFromTexture(artifactTexture(artifactColor(node), focused, state.artTextures), size, size, {
            renderOrder: 2,
            depthTest: true,
          }),
        )
      } else if (node.type === 'collection') {
        const c = pillCanvas({ label: node.shortLabel || node.label || 'AEA-IRC' })
        group.add(spriteFromTexture(canvasTexture(c), Math.max(28, c.width * 0.12), 7, { renderOrder: 6 }))
      } else {
        const c = pillCanvas(node)
        group.add(spriteFromTexture(canvasTexture(c), Math.max(18, c.width * 0.1), 5.5, { renderOrder: 5 }))
      }
      return group
    }

    function buildLink(link) {
      if (relationOf(link) === 'received') {
        const empty = new THREE.Group()
        empty.visible = false
        return empty
      }
      const succession = isSuccession(link)
      const mat = new THREE.LineBasicMaterial({
        color: succession ? 0xc4a484 : 0x2e9b5f,
        transparent: true,
        opacity: succession ? 0.9 : 0.22,
        depthTest: true,
        depthWrite: false,
      })
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const line = new THREE.Line(geo, mat)
      line.renderOrder = 1
      line.frustumCulled = false
      return line
    }

    function positionTrimmedLink(obj, coords, link) {
      const src = typeof link.source === 'object' ? link.source : state.byId[link.source]
      const trim = src?.type === 'president' ? 22 : 8
      const dx = coords.end.x - coords.start.x
      const dy = coords.end.y - coords.start.y
      const dz = coords.end.z - coords.start.z
      const len = Math.hypot(dx, dy, dz) || 1
      const t = Math.min(trim / len, 0.4)
      coords.start.x += dx * t
      coords.start.y += dy * t
      coords.start.z += dz * t
      const geo = obj?.geometry
      const attr = geo?.getAttribute?.('position')
      if (attr?.array && attr.array.length >= 6) {
        attr.array[0] = coords.start.x
        attr.array[1] = coords.start.y || 0
        attr.array[2] = coords.start.z || 0
        attr.array[3] = coords.end.x
        attr.array[4] = coords.end.y || 0
        attr.array[5] = coords.end.z || 0
        attr.needsUpdate = true
      }
      return true
    }

    function applyLayout(next) {
      state.layout = next
      const presidents = state.nodes
        .filter((n) => n.type === 'president')
        .sort((a, b) => Number(a.termStart) - Number(b.termStart))
      const col = state.nodes.find((n) => n.type === 'collection')
      const span = Math.max(presidents.length - 1, 1)
      const spread = wide.matches ? 1560 : 1040
      state.nodes.forEach((n) => {
        n.fx = undefined
        n.fy = undefined
        n.fz = undefined
      })
      if (col) {
        col.fx = 0
        col.fy = 0
        col.fz = 0
      }
      if (next === 'timeline') {
        presidents.forEach((p, i) => {
          const tpos = i / span - 0.5
          if (wide.matches) {
            p.fx = tpos * spread
            p.fy = 40
            p.fz = 0
          } else {
            p.fx = 0
            p.fy = tpos * spread
            p.fz = 0
          }
        })
        seedArtifacts()
      } else {
        seedWeb()
      }
      if (Graph) Graph.d3ReheatSimulation()
    }

    function zoomBy(factor) {
      if (!Graph?.cameraPosition) return
      const pos = Graph.cameraPosition()
      const dist = Math.hypot(pos.x, pos.y, pos.z) || 1
      const next = Math.min(MAX_DIST, Math.max(MIN_DIST, dist / factor))
      const s = next / dist
      Graph.cameraPosition({ x: pos.x * s, y: pos.y * s, z: pos.z * s }, undefined, reduced ? 0 : 280)
    }

    host.__kgZoomIn = () => zoomBy(ZOOM_STEP)
    host.__kgZoomOut = () => zoomBy(1 / ZOOM_STEP)
    host.__kgFit = () => Graph?.zoomToFit(reduced ? 0 : 700, wide.matches ? 80 : 110)
    host.__kgLayout = (mode) => applyLayout(mode)

    seedWeb()

    function loadForceGraph3D() {
      if (typeof window.ForceGraph3D === 'function') return Promise.resolve(window.ForceGraph3D)
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-kg-force-graph]')
        if (existing) {
          existing.addEventListener('load', () => resolve(window.ForceGraph3D))
          existing.addEventListener('error', () => reject(new Error('ForceGraph3D failed to load')))
          return
        }
        window.THREE = window.THREE || THREE
        const script = document.createElement('script')
        script.src = '/vendor/3d-force-graph/3d-force-graph.min.js'
        script.async = true
        script.dataset.kgForceGraph = '1'
        script.onload = () => resolve(window.ForceGraph3D)
        script.onerror = () => reject(new Error('ForceGraph3D failed to load'))
        document.head.appendChild(script)
      })
    }

    ;(async () => {
      const ForceGraph3D = await loadForceGraph3D()
      if (cancelled) return
      Graph = createGraph(ForceGraph3D, host)
      if (!Graph) return
      graphRef.current = Graph
      Graph.backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .graphData({ nodes: state.nodes, links: state.links })
        .nodeId('id')
        .nodeLabel(() => null)
        .enableNodeDrag(false)
        .enablePointerInteraction(true)
        .enableNavigationControls(true)
        .warmupTicks(reduced ? 150 : 0)
        .cooldownTicks(reduced ? 0 : 120)
        .cooldownTime(reduced ? 0 : 4500)
        .linkWidth(0)
        .linkOpacity(1)
        .linkVisibility((l) => relationOf(l) !== 'received')
        .linkThreeObject(buildLink)
        .linkThreeObjectExtend(false)
        .linkPositionUpdate(positionTrimmedLink)
        .nodeThreeObject(buildNode)
        .nodeThreeObjectExtend(false)
        .onNodeHover((node) => {
          state.hoverId = node ? node.id : null
        })
        .onNodeClick((node) => {
          state.selectedId = node ? node.id : null
          onSelect?.(node || null)
          Graph.nodeThreeObject(buildNode)
        })
        .onBackgroundClick(() => {
          state.selectedId = null
          onSelect?.(null)
          Graph.nodeThreeObject(buildNode)
        })
        .onEngineStop(() => {
          Graph.zoomToFit(reduced ? 0 : 700, wide.matches ? 80 : 110)
        })

      const charge = Graph.d3Force('charge')
      if (charge?.strength) {
        charge.strength((n) => {
          if (n.type === 'artifact') return -7
          if (n.type === 'president') return -90
          if (n.type === 'collection') return -24
          return -40
        })
        charge.distanceMax?.(70)
      }
      const linkF = Graph.d3Force('link')
      if (linkF?.distance) {
        linkF.distance((l) => {
          const src = typeof l.source === 'object' ? l.source : state.byId[l.source]
          if (relationOf(l) === 'received' && src) return shellRadius(src.id)
          if (relationOf(l) === 'succeeded by') return 190
          if (relationOf(l) === 'houses') return 150
          return 80
        })
      }
      Graph.d3Force('cluster', clusterForce)
      Graph.d3Force('center', null)
      Graph.d3VelocityDecay?.(0.34)
      Graph.numDimensions?.(3)

      const renderer = Graph.renderer?.()
      if (renderer?.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      if (renderer?.setClearColor) renderer.setClearColor(0x000000, 0)
      const controls = Graph.controls?.()
      if (controls) {
        controls.enableDamping = !reduced
        controls.minDistance = MIN_DIST
        controls.maxDistance = MAX_DIST
        controls.enablePan = true
        controls.enableRotate = true
        controls.enableZoom = true
      }

      await Promise.all(
        state.nodes
          .filter((n) => n.type === 'president' && n.photo)
          .map(async (n) => {
            state.photos[n.id] = await loadPhoto(n.photo)
          }),
      )
      if (!cancelled) Graph.nodeThreeObject(buildNode)
    })()

    const onResize = () => {
      if (!Graph) return
      Graph.width(host.clientWidth).height(host.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      try {
        Graph?._destructor?.()
      } catch {
        host.replaceChildren()
      }
      graphRef.current = null
    }
  }, [graph, onSelect])

  return <div ref={hostRef} className="kg-graph-host" />
}
